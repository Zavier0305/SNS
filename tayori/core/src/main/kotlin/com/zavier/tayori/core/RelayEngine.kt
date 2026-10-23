package com.zavier.tayori.core

import java.util.UUID

data class RelayConfig(
    /** 送信元が付けるTTL(最大中継回数)。受け取ったTTLがこれを超えていたら、ここまで切り詰める。 */
    val initialTtl: Int = MessageRules.DEFAULT_TTL,
    /**
     * この時間以上見えていなかった端末が再び見えたら「新しい接触」と数える。
     * BLEのスキャン結果は同じ端末について1秒に何度も来るので、毎回は数えない。
     * 「近くにいる」とみなす時間としても使う。
     */
    val contactGapMs: Long = 10_000,
    /** 送信失敗した相手へ再挑戦するまでの待ち時間(失敗直後に連打して電波を占有しないため)。 */
    val retryBackoffMs: Long = 5_000,
    /** 中継用に保持するメッセージの上限。超えたら、一番多く持ち込んだ相手の古いものから捨てる。 */
    val maxBufferSize: Int = 500,
    /** これより古いメッセージは受け取らない(大昔のメッセージの再送や、記憶の溜まりすぎを防ぐ)。 */
    val maxAgeMs: Long = 24 * 60 * 60 * 1000L,
    /** これより未来の時刻のメッセージは受け取らない(端末の時計ずれを見込んで1時間まで許す)。 */
    val maxFutureMs: Long = 60 * 60 * 1000L,
    /** 1つの相手から [rateWindowMs] の間に受け取る新しいメッセージの上限(大量に送りつける攻撃への備え)。 */
    val maxNewPerPeer: Int = 30,
    val rateWindowMs: Long = 60_000,
    /** 受信済みIDを覚えておく上限件数(古いものから忘れる。[maxAgeMs] より古いものは自然に捨てる)。 */
    val maxSeen: Int = 20_000,
)

/** 自分が送ったメッセージの状況。 */
data class SentItem(val letter: Letter, val sentTo: Set<String>, val sendCount: Int)

/** 自分が中継のために預かっているメッセージ(中身は読めないので、外側の情報だけ)。 */
data class RelayItem(val id: UUID, val destId: String, val hop: Int, val ttl: Int, val sentTo: Set<String>, val sendCount: Int)

/** UIに見せるためのスナップショット。 */
data class EngineSnapshot(
    val selfId: String,
    val inbox: List<ReceivedLetter>,
    val sentByMe: List<SentItem>,
    val relaying: List<RelayItem>,
    val nearbyPeers: List<String>,
    val contactCountTotal: Int,
    val sendCountTotal: Int,
)

/** 宛先が連絡先に登録されていないので、暗号化できず送れない。 */
class UnknownRecipientException(val destId: String) : IllegalArgumentException("宛先「$destId」は連絡先に登録されていません")

/**
 * 中継ロジック本体(BLEのことは一切知らない)。
 *
 * 方式は「蓄積・運搬・転送(store-carry-forward)」型のフラッディング:
 *  1. メッセージを受け取った端末は、自分宛てでなければ手元に保持する
 *  2. 近くに端末が見えるたびに、その端末にまだ渡していないメッセージを渡す
 *  3. 一度見た Message ID は二度と中継しない(重複排除)
 *  4. TTLを使い切ったメッセージは中継しない
 *
 * 安全のための決まり:
 *  - 中身(送り主・状態・本文)は宛先の公開鍵で暗号化し、送り主の署名を付ける(Sealer)
 *  - 届いた封筒は、IDの形式・TTL・作成時刻・受信ペースを確かめ、ルール違反は捨てる
 *  - 預かり枠が満杯のときは、一番多く持ち込んだ相手のものから捨てる(自分のメッセージは捨てない)
 *
 * スレッド安全: BLEのコールバックは別スレッドから来るので、状態は lock で守る。
 * Transport や listener の呼び出しは lock の外で行う(Fakeが同期的に折り返し呼んでも詰まらないように)。
 */
class RelayEngine(
    val identity: Identity,
    private val contacts: ContactBook,
    private val transport: Transport,
    private val log: ExperimentLog,
    private val config: RelayConfig = RelayConfig(),
    private val clock: () -> Long = System::currentTimeMillis,
    private val newId: () -> UUID = UUID::randomUUID,
) : TransportListener {

    val selfId: String get() = identity.id

    /** 状態が変わったときに呼ばれる(UI更新用)。どのスレッドから呼ばれるかは不定。 */
    @Volatile
    var onChanged: (() -> Unit)? = null

    private class Outgoing(
        /** 送るときの封筒(hop/ttl は送信用に調整済み)。fromId は送信時に自分の一時IDで上書きする。 */
        val envelope: Envelope,
        val receivedFrom: String?,
        /** 自分が書いた手紙なら中身、中継なら null。 */
        val letter: Letter?,
    ) {
        val sentTo = mutableSetOf<String>()
        var sendCount = 0
    }

    private class PeerState {
        var lastSeen = Long.MIN_VALUE
        var contacts = 0
        var retryAfter = Long.MIN_VALUE
        val recentNew = ArrayDeque<Long>()
    }

    private val lock = Any()
    /** 受信済みID → 覚えた時刻(挿入順。古いものから忘れる)。 */
    private val seen = LinkedHashMap<UUID, Long>()
    private val outbox = LinkedHashMap<UUID, Outgoing>()
    private val peers = HashMap<String, PeerState>()
    private val inFlight = HashSet<Pair<String, UUID>>()
    private val inbox = mutableListOf<ReceivedLetter>()
    private var contactTotal = 0
    private var sendTotal = 0

    fun start() = transport.start(this)

    fun stop() = transport.stop()

    /** 自分からメッセージを送る。宛先の連絡先が必要(その公開鍵で暗号化するため)。 */
    fun sendMessage(destId: String, status: SafetyStatus, text: String): Letter {
        require(DeviceId.isValid(destId)) { "宛先IDが不正です" }
        require(destId != selfId) { "自分宛てには送れません" }
        require(MessageRules.isValidText(text)) { "本文は${MessageRules.MAX_TEXT_LENGTH}文字以内です" }
        val recipient = contacts.find(destId) ?: throw UnknownRecipientException(destId)

        val now = clock()
        val letter = Letter(newId(), selfId, destId, status, text, now)
        val sealed = Sealer.seal(letter, identity, recipient)
        // 送信元が渡すコピーは hop=1(1回飛んで相手に届く)、ttl=初期値(まだ中継していない)
        val env = Envelope(letter.id, destId, transport.localHandle, config.initialTtl, 1, now, sealed)
        val nearby = synchronized(lock) {
            remember(letter.id, now)
            addToOutbox(letter.id, Outgoing(env, receivedFrom = null, letter = letter))
            record(LogEvent.CREATED, letter.id, origin = selfId, dest = destId, status = status, sentAt = now, hop = 0, ttl = env.ttl)
            nearbyPeersLocked(now)
        }
        nearby.forEach(::dispatchTo)
        notifyChanged()
        return letter
    }

    override fun onPeerSeen(peerId: String) {
        if (peerId == transport.localHandle || !DeviceId.isValid(peerId)) return
        val now = clock()
        val canSend = synchronized(lock) {
            val p = peers.getOrPut(peerId) { PeerState() }
            val isNewContact = p.lastSeen == Long.MIN_VALUE || now - p.lastSeen >= config.contactGapMs
            p.lastSeen = now
            if (isNewContact) {
                p.contacts++
                contactTotal++
                record(LogEvent.CONTACT, null, peerId = peerId, peerContacts = p.contacts)
            }
            now >= p.retryAfter
        }
        if (canSend) dispatchTo(peerId)
    }

    override fun onPayloadReceived(payload: ByteArray) {
        val now = clock()
        val raw = PacketCodec.decode(payload)
        if (raw == null) {
            synchronized(lock) { record(LogEvent.INVALID_PACKET, null, note = "${payload.size} bytes") }
            return
        }
        // 自分宛ての開封(暗号の計算)は少し重いので lock の外で行う
        val mine = raw.destId == selfId
        val opened = if (mine) Sealer.open(raw, identity, contacts) else null

        val nearby: List<String> = synchronized(lock) {
            val reason = rejectReason(raw, now)
            if (reason != null) {
                record(LogEvent.REJECTED, raw.id, dest = raw.destId, peerId = raw.fromId, sentAt = raw.createdAt,
                    receivedAt = now, hop = raw.hop, ttl = raw.ttl, note = reason)
                return
            }
            // TTLの水増し対策: 決まった上限を超えていたら切り詰める
            val env = if (raw.ttl > config.initialTtl) raw.copy(ttl = config.initialTtl) else raw
            if (seen.containsKey(env.id)) {
                record(LogEvent.DUPLICATE, env.id, dest = env.destId, peerId = env.fromId, sentAt = env.createdAt,
                    receivedAt = now, hop = env.hop, ttl = env.ttl)
                return
            }
            if (!allowNewFrom(env.fromId, now)) {
                record(LogEvent.REJECTED, env.id, dest = env.destId, peerId = env.fromId, note = "受信しすぎ(1分あたり${config.maxNewPerPeer}件まで)")
                return
            }
            remember(env.id, now)
            when {
                mine -> {
                    when (opened) {
                        is OpenResult.Ok -> {
                            val l = opened.letter
                            inbox += ReceivedLetter(l, env.hop, now, opened.verified)
                            record(LogEvent.DELIVERED, env.id, origin = l.originId, dest = l.destId, status = l.status,
                                peerId = env.fromId, sentAt = l.createdAt, receivedAt = now, hop = env.hop, ttl = env.ttl,
                                note = if (opened.verified) "本人確認済み" else "未登録の送り主")
                        }
                        is OpenResult.Spoofed -> record(LogEvent.SPOOFED, env.id, origin = opened.claimedOrigin, dest = env.destId,
                            peerId = env.fromId, sentAt = env.createdAt, receivedAt = now, hop = env.hop, note = "署名が合わない")
                        else -> record(LogEvent.UNREADABLE, env.id, dest = env.destId, peerId = env.fromId,
                            sentAt = env.createdAt, receivedAt = now, hop = env.hop)
                    }
                    emptyList()
                }
                env.ttl <= 0 -> {
                    record(LogEvent.TTL_EXPIRED, env.id, dest = env.destId, peerId = env.fromId, sentAt = env.createdAt,
                        receivedAt = now, hop = env.hop, ttl = env.ttl)
                    emptyList()
                }
                else -> {
                    record(LogEvent.RECEIVED, env.id, dest = env.destId, peerId = env.fromId, sentAt = env.createdAt,
                        receivedAt = now, hop = env.hop, ttl = env.ttl)
                    // 中継するコピーは「もう1回飛ぶ」ので hop+1、「中継を1回使う」ので ttl-1
                    val relayCopy = env.copy(hop = env.hop + 1, ttl = env.ttl - 1)
                    addToOutbox(env.id, Outgoing(relayCopy, receivedFrom = env.fromId, letter = null))
                    nearbyPeersLocked(now)
                }
            }
        }
        nearby.forEach(::dispatchTo)
        notifyChanged()
    }

    fun snapshot(): EngineSnapshot = synchronized(lock) {
        EngineSnapshot(
            selfId = selfId,
            inbox = inbox.toList(),
            sentByMe = outbox.values.mapNotNull { o -> o.letter?.let { SentItem(it, o.sentTo.toSet(), o.sendCount) } },
            relaying = outbox.values.filter { it.letter == null }.map { o ->
                RelayItem(o.envelope.id, o.envelope.destId, o.envelope.hop, o.envelope.ttl, o.sentTo.toSet(), o.sendCount)
            },
            nearbyPeers = nearbyPeersLocked(clock()),
            contactCountTotal = contactTotal,
            sendCountTotal = sendTotal,
        )
    }

    /** 受け取ってはいけない封筒なら理由を返す。 */
    private fun rejectReason(e: Envelope, now: Long): String? = when {
        !DeviceId.isValid(e.destId) -> "宛先IDの形式が不正"
        !DeviceId.isValid(e.fromId) -> "中継元IDの形式が不正"
        e.hop < 1 || e.hop > config.initialTtl + 1 -> "ホップ数が不正(${e.hop})"
        now - e.createdAt > config.maxAgeMs -> "古すぎる"
        e.createdAt - now > config.maxFutureMs -> "未来の時刻"
        else -> null
    }

    /** 同じ相手から短時間に大量の新しいメッセージが来ていないか。 */
    private fun allowNewFrom(fromId: String, now: Long): Boolean {
        if (peers.size > MAX_PEERS) prunePeers(now)
        val p = peers.getOrPut(fromId) { PeerState() }
        while (p.recentNew.isNotEmpty() && now - p.recentNew.first() > config.rateWindowMs) p.recentNew.removeFirst()
        if (p.recentNew.size >= config.maxNewPerPeer) return false
        p.recentNew.addLast(now)
        return true
    }

    /** 一時IDを次々に変えて送ってくる相手で、相手の記録が溜まりすぎないように、しばらく音沙汰のない相手を忘れる。 */
    private fun prunePeers(now: Long) {
        val idle = config.rateWindowMs.coerceAtLeast(config.contactGapMs)
        peers.entries.removeIf { (_, p) ->
            (p.lastSeen == Long.MIN_VALUE || now - p.lastSeen > idle) &&
                (p.recentNew.isEmpty() || now - p.recentNew.last() > idle)
        }
    }

    private companion object {
        const val MAX_PEERS = 1_000
    }

    /** 受信済みIDを覚える。古いもの・多すぎる分は忘れる(どのみち古いメッセージは受け取らないので安全)。 */
    private fun remember(id: UUID, now: Long) {
        seen[id] = now
        val it = seen.entries.iterator()
        while (it.hasNext()) {
            val e = it.next()
            if (now - e.value > config.maxAgeMs + config.maxFutureMs || seen.size > config.maxSeen) it.remove() else break
        }
    }

    /** [peerId] にまだ渡していないメッセージをまとめて送る。 */
    private fun dispatchTo(peerId: String) {
        val handle = transport.localHandle
        val jobs: List<Envelope> = synchronized(lock) {
            outbox.values
                .filter { o ->
                    peerId != o.receivedFrom &&
                        peerId !in o.sentTo &&
                        (peerId to o.envelope.id) !in inFlight
                }
                .map { o ->
                    inFlight += peerId to o.envelope.id
                    o.envelope.copy(fromId = handle)
                }
        }
        for (e in jobs) {
            transport.send(peerId, PacketCodec.encode(e)) { ok -> onSendResult(peerId, e, ok) }
        }
    }

    private fun onSendResult(peerId: String, e: Envelope, ok: Boolean) {
        synchronized(lock) {
            inFlight -= peerId to e.id
            val o = outbox[e.id]
            val p = peers.getOrPut(peerId) { PeerState() }
            val mineLetter = o?.letter
            if (ok) {
                sendTotal++
                o?.let { it.sentTo += peerId; it.sendCount++ }
                record(LogEvent.SENT, e.id, origin = mineLetter?.originId, dest = e.destId, status = mineLetter?.status,
                    peerId = peerId, sentAt = e.createdAt, hop = e.hop, ttl = e.ttl, peerContacts = p.contacts, sendCountMessage = o?.sendCount)
            } else {
                p.retryAfter = clock() + config.retryBackoffMs
                record(LogEvent.SEND_FAILED, e.id, origin = mineLetter?.originId, dest = e.destId, status = mineLetter?.status,
                    peerId = peerId, sentAt = e.createdAt, hop = e.hop, ttl = e.ttl, peerContacts = p.contacts, sendCountMessage = o?.sendCount)
            }
        }
        notifyChanged()
    }

    /**
     * 預かり枠に入れる。満杯なら、中継品の中で「一番たくさん持ち込んだ相手」の一番古いものを捨てる。
     * こうすると、1台が大量のゴミを送ってきても、他の人のメッセージは押し出されにくい。自分のメッセージは捨てない。
     */
    private fun addToOutbox(id: UUID, o: Outgoing) {
        outbox[id] = o
        while (outbox.size > config.maxBufferSize) {
            val relayed = outbox.values.filter { it.letter == null }
            if (relayed.isEmpty()) break
            val heaviest = relayed.groupingBy { it.receivedFrom }.eachCount().maxBy { it.value }.key
            val victim = relayed.first { it.receivedFrom == heaviest }
            outbox.remove(victim.envelope.id)
            record(LogEvent.BUFFER_EVICTED, victim.envelope.id, dest = victim.envelope.destId, peerId = victim.receivedFrom)
        }
    }

    private fun nearbyPeersLocked(now: Long): List<String> =
        peers.filter { it.value.lastSeen != Long.MIN_VALUE && now - it.value.lastSeen < config.contactGapMs }.keys.sorted()

    private fun record(
        event: LogEvent,
        id: UUID?,
        origin: String? = null,
        dest: String? = null,
        status: SafetyStatus? = null,
        peerId: String? = null,
        sentAt: Long? = null,
        receivedAt: Long? = null,
        hop: Int? = null,
        ttl: Int? = null,
        peerContacts: Int? = peerId?.let { peers[it]?.contacts },
        sendCountMessage: Int? = null,
        note: String? = null,
    ) {
        log.record(
            LogEntry(
                logTime = clock(),
                deviceId = selfId,
                event = event,
                messageId = id?.toString(),
                originId = origin,
                destId = dest,
                status = status,
                peerId = peerId,
                sentAt = sentAt,
                receivedAt = receivedAt,
                hop = hop,
                ttl = ttl,
                contactCountTotal = contactTotal,
                peerContactCount = peerContacts,
                sendCountMessage = sendCountMessage,
                sendCountTotal = sendTotal,
                note = note,
            ),
        )
    }

    private fun notifyChanged() {
        onChanged?.invoke()
    }
}
