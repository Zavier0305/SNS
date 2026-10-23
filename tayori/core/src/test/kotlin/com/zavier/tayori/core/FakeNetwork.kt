package com.zavier.tayori.core

/**
 * メモリ上の「偽の電波空間」。link() した端末同士だけが互いに見え、データを渡せる。
 * 送受信はキューに積んで runUntilIdle() でまとめて処理する(実機と同じく非同期にするため)。
 */
class FakeNetwork {
    var now = 1_000_000L
    private val nodes = linkedMapOf<String, FakeTransport>()
    private val links = mutableSetOf<Set<String>>()
    private val queue = ArrayDeque<() -> Unit>()

    /** 全送信の試行回数(テストで「余計な送信をしていないか」を確かめる用)。 */
    var sendAttempts = 0
        private set

    /** true の間、すべての送信を失敗させる(電波が悪い状況の模擬)。 */
    var failAllSends = false

    fun transport(id: String): FakeTransport = FakeTransport(id, this).also { nodes[id] = it }

    /** テスト用の「全員が全員の連絡先を知っている」名簿。 */
    val identities = mutableMapOf<String, Identity>()
    val directory = ContactBook { id -> identities[id]?.let { Contact(it.id, it.keyPair.public as java.security.interfaces.ECPublicKey) } }

    fun identity(id: String): Identity = identities.getOrPut(id) { Identity.generate(id) }

    fun link(a: String, b: String) {
        links += setOf(a, b)
    }

    fun unlink(a: String, b: String) {
        links -= setOf(a, b)
    }

    fun isLinked(a: String, b: String) = setOf(a, b) in links

    /** 1回分のスキャン: 電波の届く端末同士が互いを「見る」。 */
    fun scan() {
        for (pair in links.toList()) {
            val (a, b) = pair.toList()
            nodes[a]?.listener?.onPeerSeen(b)
            nodes[b]?.listener?.onPeerSeen(a)
        }
        runUntilIdle()
    }

    fun advance(ms: Long) {
        now += ms
    }

    internal fun enqueueSend(from: String, to: String, payload: ByteArray, onResult: (Boolean) -> Unit) {
        sendAttempts++
        queue.addLast {
            val target = nodes[to]
            if (!failAllSends && target?.listener != null && isLinked(from, to)) {
                target.listener!!.onPayloadReceived(payload)
                onResult(true)
            } else {
                onResult(false)
            }
        }
    }

    fun runUntilIdle() {
        var guard = 0
        while (queue.isNotEmpty()) {
            check(++guard < 100_000) { "送信が止まらない(無限中継の疑い)" }
            queue.removeFirst().invoke()
        }
    }
}

class FakeTransport(val id: String, private val network: FakeNetwork) : Transport {
    var listener: TransportListener? = null
        private set

    /** テストでは一時IDを変えず、端末IDと同じにしておく(どの端末か読みやすくするため)。 */
    override val localHandle: String get() = id

    override fun start(listener: TransportListener) {
        this.listener = listener
    }

    override fun stop() {
        listener = null
    }

    override fun send(peerId: String, payload: ByteArray, onResult: (Boolean) -> Unit) {
        network.enqueueSend(id, peerId, payload, onResult)
    }
}
