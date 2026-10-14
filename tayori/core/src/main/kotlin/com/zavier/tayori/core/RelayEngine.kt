package com.zavier.tayori.core

import java.util.UUID

data class RelayConfig(
    /** 送信元が付けるTTL(最大中継回数)。 */
    val initialTtl: Int = MessageRules.DEFAULT_TTL,
    /**
     * この時間以上見えていなかった端末が再び見えたら「新しい接触」と数える。
     * BLEのスキャン結果は同じ端末について1秒に何度も来るので、毎回は数えない。
     * 「近くにいる」とみなす時間としても使う。
     */
    val contactGapMs: Long = 10_000,
    /** 送信失敗した相手へ再挑戦するまでの待ち時間(失敗直後に連打して電波を占有しないため)。 */
    val retryBackoffMs: Long = 5_000,
    /** 中継用に保持するメッセージの上限。超えたら古い順に捨てる。 */
    val maxBufferSize: Int = 500,
)

/** 自分が作ったメッセージ・届いたメッセージ・統計をUIに見せるためのスナップショット。 */
data class EngineSnapshot(
    val selfId: String,
    val inbox: List<Message>,
    val sentByMe: List<OutboxItem>,
    val relaying: List<OutboxItem>,
    val nearbyPeers: List<String>,
    val contactCountTotal: Int,
    val sendCountTotal: Int,
)

data class OutboxItem(val message: Message, val sentTo: Set<String>, val sendCount: Int)

/**
 * 中継ロジック本体(BLEのことは一切知らない)。
 *
 * 方式は「蓄積・運搬・転送(store-carry-forward)」型のフラッディング:
 *  1. メッセージを受け取った端末は、自分宛てでなければ手元に保持する
 *  2. 近くに端末が見えるたびに、その端末にまだ渡していないメッセージを渡す
 *  3. 一度見た Message ID は二度と中継しない(重複排除)
 *  4. TTLを使い切ったメッセージは中継しない
 * 宛先が近くにいなくても、人の移動と一緒にメッセージが運ばれていくのが狙い。
 *
 * スレッド安全: BLEのコールバックは別スレッドから来るので、状態は lock で守る。
 * Transport や listener の呼び出しは lock の外で行う(Fakeが同期的に折り返し呼んでも詰まらないように)。
 */
class RelayEngine(
    val selfId: String,
    private val transport: Transport,
    private val log: ExperimentLog,
    private val config: RelayConfig = RelayConfig(),
    private val clock: () -> Long = System::currentTimeMillis,
    private val newId: () -> UUID = UUID::randomUUID,
) : TransportListener {

    /** 状態が変わったときに呼ばれる(UI更新用)。どのスレッドから呼ばれるかは不定。 */
    @Volatile
    var onChanged: (() -> Unit)? = null

    private class Outgoing(
        /** 送るときのコピー(hop/ttl は送信用に調整済み)。fromId は送信時に自分のIDで上書きする。 */
        val packet: Message,
        val receivedFrom: String?,
        val isMine: Boolean,
    ) {
        val sentTo = mutableSetOf<String>()
        var sendCount = 0
    }

    private class PeerState {
        var lastSeen = Long.MIN_VALUE
        var contacts = 0
        var retryAfter = Long.MIN_VALUE
    }

    private val lock = Any()
    private val seen = HashSet<UUID>()
    private val outbox = LinkedHashMap<UUID, Outgoing>()
    private val peers = HashMap<String, PeerState>()
    private val inFlight = HashSet<Pair<String, UUID>>()
    private val inbox = mutableListOf<Message>()
    private var contactTotal = 0
    private var sendTotal = 0

    fun start() = transport.start(this)

    fun stop() = transport.stop()

    /** 自分からメッセージを送る。近くに端末がいればすぐ渡し、いなければ出会うまで保持する。 */
    fun sendMessage(destId: String, status: SafetyStatus, text: String): Message {
        require(DeviceId.isValid(destId)) { "宛先IDが不正です" }
        require(destId != selfId) { "自分宛てには送れません" }
        require(MessageRules.isValidText(text)) { "本文は${MessageRules.MAX_TEXT_LENGTH}文字以内です" }

        val now = clock()
        // 送信元が渡すコピーは hop=1(1回飛んで相手に届く)、ttl=初期値(まだ中継していない)
        val msg = Message(newId(), selfId, destId, selfId, status, text, now, config.initialTtl, 1)
        val nearby = synchronized(lock) {
            seen += msg.id
            addToOutbox(msg.id, Outgoing(msg, receivedFrom = null, isMine = true))
            record(LogEvent.CREATED, msg, sentAt = msg.createdAt, hop = 0, ttl = msg.ttl)
            nearbyPeersLocked(now)
        }
        nearby.forEach(::dispatchTo)
        notifyChanged()
        return msg
    }

    override fun onPeerSeen(peerId: String) {
        if (peerId == selfId || !DeviceId.isValid(peerId)) return
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
        val msg = PacketCodec.decode(payload)
        if (msg == null) {
            synchronized(lock) { record(LogEvent.INVALID_PACKET, null, note = "${payload.size} bytes") }
            return
        }
        val nearby: List<String> = synchronized(lock) {
            if (!seen.add(msg.id)) {
                record(LogEvent.DUPLICATE, msg, peerId = msg.fromId, sentAt = msg.createdAt,
                    receivedAt = now, hop = msg.hop, ttl = msg.ttl)
                return
            }
            when {
                msg.destId == selfId -> {
                    inbox += msg
                    record(LogEvent.DELIVERED, msg, peerId = msg.fromId, sentAt = msg.createdAt,
                        receivedAt = now, hop = msg.hop, ttl = msg.ttl)
                    emptyList()
                }
                msg.ttl <= 0 -> {
                    record(LogEvent.TTL_EXPIRED, msg, peerId = msg.fromId, sentAt = msg.createdAt,
                        receivedAt = now, hop = msg.hop, ttl = msg.ttl)
                    emptyList()
                }
                else -> {
                    record(LogEvent.RECEIVED, msg, peerId = msg.fromId, sentAt = msg.createdAt,
                        receivedAt = now, hop = msg.hop, ttl = msg.ttl)
                    // 中継するコピーは「もう1回飛ぶ」ので hop+1、「中継を1回使う」ので ttl-1
                    val relayCopy = msg.copy(hop = msg.hop + 1, ttl = msg.ttl - 1)
                    addToOutbox(msg.id, Outgoing(relayCopy, receivedFrom = msg.fromId, isMine = false))
                    nearbyPeersLocked(now)
                }
            }
        }
        nearby.forEach(::dispatchTo)
        notifyChanged()
    }

    fun snapshot(): EngineSnapshot = synchronized(lock) {
        val items = outbox.values.map { OutboxItem(it.packet, it.sentTo.toSet(), it.sendCount) to it.isMine }
        EngineSnapshot(
            selfId = selfId,
            inbox = inbox.toList(),
            sentByMe = items.filter { it.second }.map { it.first },
            relaying = items.filter { !it.second }.map { it.first },
            nearbyPeers = nearbyPeersLocked(clock()),
            contactCountTotal = contactTotal,
            sendCountTotal = sendTotal,
        )
    }

    /** [peerId] にまだ渡していないメッセージをまとめて送る。 */
    private fun dispatchTo(peerId: String) {
        val jobs: List<Message> = synchronized(lock) {
            outbox.values
                .filter { o ->
                    peerId != o.receivedFrom &&
                        peerId != o.packet.originId &&
                        peerId !in o.sentTo &&
                        (peerId to o.packet.id) !in inFlight
                }
                .map { o ->
                    inFlight += peerId to o.packet.id
                    o.packet.copy(fromId = selfId)
                }
        }
        for (m in jobs) {
            transport.send(peerId, PacketCodec.encode(m)) { ok -> onSendResult(peerId, m, ok) }
        }
    }

    private fun onSendResult(peerId: String, m: Message, ok: Boolean) {
        synchronized(lock) {
            inFlight -= peerId to m.id
            val o = outbox[m.id]
            val p = peers.getOrPut(peerId) { PeerState() }
            if (ok) {
                sendTotal++
                o?.let { it.sentTo += peerId; it.sendCount++ }
                record(LogEvent.SENT, m, peerId = peerId, sentAt = m.createdAt, hop = m.hop, ttl = m.ttl,
                    peerContacts = p.contacts, sendCountMessage = o?.sendCount)
            } else {
                p.retryAfter = clock() + config.retryBackoffMs
                record(LogEvent.SEND_FAILED, m, peerId = peerId, sentAt = m.createdAt, hop = m.hop, ttl = m.ttl,
                    peerContacts = p.contacts, sendCountMessage = o?.sendCount)
            }
        }
        notifyChanged()
    }

    private fun addToOutbox(id: UUID, o: Outgoing) {
        outbox[id] = o
        while (outbox.size > config.maxBufferSize) {
            val oldest = outbox.entries.first()
            outbox.remove(oldest.key)
            record(LogEvent.BUFFER_EVICTED, oldest.value.packet)
        }
    }

    private fun nearbyPeersLocked(now: Long): List<String> =
        peers.filter { now - it.value.lastSeen < config.contactGapMs }.keys.sorted()

    private fun record(
        event: LogEvent,
        m: Message?,
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
                messageId = m?.id?.toString(),
                originId = m?.originId,
                destId = m?.destId,
                status = m?.status,
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
