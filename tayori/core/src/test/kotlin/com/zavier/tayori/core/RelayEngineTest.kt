package com.zavier.tayori.core

import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class RelayEngineTest {
    private lateinit var net: FakeNetwork
    private val logs = mutableMapOf<String, InMemoryLog>()
    private val engines = mutableMapOf<String, RelayEngine>()

    @BeforeTest
    fun setUp() {
        net = FakeNetwork()
        logs.clear()
        engines.clear()
    }

    private fun node(id: String, config: RelayConfig = RelayConfig()): RelayEngine {
        val log = InMemoryLog()
        val e = RelayEngine(id, net.transport(id), log, config, clock = { net.now })
        e.start()
        logs[id] = log
        engines[id] = e
        return e
    }

    private fun events(id: String, event: LogEvent) = logs.getValue(id).entries().filter { it.event == event }

    @Test
    fun `フェーズ1のゴール A から直接届かない C へ B 経由で届く`() {
        val a = node("A"); node("B"); val c = node("C")
        net.link("A", "B")
        net.link("B", "C") // A と C はつながっていない

        val msg = a.sendMessage("C", SafetyStatus.NEED_RESCUE, "3階にいます")
        net.scan()

        val inbox = c.snapshot().inbox
        assertEquals(1, inbox.size)
        assertEquals(msg.id, inbox[0].id)
        assertEquals("3階にいます", inbox[0].text)
        assertEquals(SafetyStatus.NEED_RESCUE, inbox[0].status)
        assertEquals(2, inbox[0].hop, "A→B→C は2ホップ")
        assertEquals("B", inbox[0].fromId)

        val delivered = events("C", LogEvent.DELIVERED).single()
        assertEquals("A", delivered.originId)
        assertEquals(msg.createdAt, delivered.sentAt)
        assertEquals(net.now, delivered.receivedAt)
        assertEquals(1, events("B", LogEvent.RECEIVED).size)
    }

    @Test
    fun `宛先は受け取ったメッセージをそれ以上中継しない`() {
        val a = node("A"); node("B"); node("D")
        net.link("A", "B")
        net.link("B", "D")
        a.sendMessage("B", SafetyStatus.SAFE, "")
        net.scan()
        net.scan()

        assertEquals(1, events("B", LogEvent.DELIVERED).size)
        assertTrue(events("B", LogEvent.SENT).isEmpty())
        assertTrue(engines.getValue("D").snapshot().relaying.isEmpty())
    }

    @Test
    fun `同じ Message ID は二度受け取っても再中継しない`() {
        // ひし形: A-B, A-D, B-C, D-C → C には B と D の2経路から届く
        val a = node("A"); node("B"); val c = node("C"); node("D"); node("E")
        net.link("A", "B"); net.link("A", "D"); net.link("B", "C"); net.link("D", "C")
        net.link("B", "D") // B と D も互いに見えるので、相手から同じものを受け取る可能性がある
        a.sendMessage("E", SafetyStatus.MOVING, "駅へ移動")
        repeat(3) { net.scan() }

        // C は最初の1回だけ RECEIVED、2回目以降は DUPLICATE
        assertEquals(1, events("C", LogEvent.RECEIVED).size)
        assertTrue(events("C", LogEvent.DUPLICATE).isNotEmpty())
        // 重複を受け取っても中継用バッファには1件だけ
        assertEquals(1, c.snapshot().relaying.size)
        // 送信元 A には自分のメッセージが戻ってきても DUPLICATE 扱い(再中継しない)
        assertTrue(a.snapshot().relaying.isEmpty())
    }

    @Test
    fun `同じ相手には同じメッセージを1回しか送らない`() {
        val a = node("A"); node("B")
        net.link("A", "B")
        a.sendMessage("Z", SafetyStatus.SAFE, "")
        repeat(5) { net.scan(); net.advance(20_000) }

        assertEquals(1, events("A", LogEvent.SENT).size)
        assertEquals(1, net.sendAttempts, "B は A から受け取ったので A に送り返さない")
    }

    @Test
    fun `TTL 10 なので中継は最大10回 hop は最大11`() {
        val ids = (0..12).map { "N$it" }
        ids.forEach { node(it) }
        ids.zipWithNext().forEach { (x, y) -> net.link(x, y) }

        engines.getValue("N0").sendMessage("N12", SafetyStatus.SAFE, "遠く")
        repeat(15) { net.scan() }

        // N11 は hop=11, ttl=0 で受け取り、中継しない
        val expired = events("N11", LogEvent.TTL_EXPIRED).single()
        assertEquals(11, expired.hop)
        assertEquals(0, expired.ttl)
        assertTrue(events("N12", LogEvent.DELIVERED).isEmpty())
        // 中継した端末は N1〜N10 の10台
        val relayers = ids.filter { events(it, LogEvent.SENT).isNotEmpty() } - "N0"
        assertEquals(10, relayers.size)
    }

    @Test
    fun `TTL ぎりぎりの距離なら届く`() {
        val ids = (0..11).map { "N$it" }
        ids.forEach { node(it) }
        ids.zipWithNext().forEach { (x, y) -> net.link(x, y) }

        engines.getValue("N0").sendMessage("N11", SafetyStatus.SAFE, "")
        repeat(15) { net.scan() }

        assertEquals(11, events("N11", LogEvent.DELIVERED).single().hop)
    }

    @Test
    fun `近くに誰もいなくても保持して、後で出会った相手に渡す(蓄積運搬)`() {
        val a = node("A"); node("B"); val c = node("C")
        a.sendMessage("C", SafetyStatus.SAFE, "無事です")
        net.scan()
        assertEquals(0, net.sendAttempts)

        net.link("A", "B"); net.scan()       // A と B が出会う
        net.unlink("A", "B"); net.advance(60_000)
        net.link("B", "C"); net.scan()       // B が移動して C と出会う

        assertEquals(1, c.snapshot().inbox.size)
    }

    @Test
    fun `接触回数と送信回数は別々に数える`() {
        val a = node("A", RelayConfig(contactGapMs = 10_000)); node("B")
        net.link("A", "B")

        net.scan()                  // 接触1(送るものはない)
        net.advance(1_000); net.scan() // 見え続けているだけなので接触は増えない
        assertEquals(1, events("A", LogEvent.CONTACT).size)

        net.advance(15_000); net.scan() // しばらく空いたので接触2
        a.sendMessage("Z", SafetyStatus.SAFE, "")
        net.runUntilIdle()

        val sent = events("A", LogEvent.SENT).single()
        assertEquals(2, sent.contactCountTotal)
        assertEquals(2, sent.peerContactCount)
        assertEquals(1, sent.sendCountMessage)
        assertEquals(1, sent.sendCountTotal)
    }

    @Test
    fun `送信に失敗したら待ち時間の後に再挑戦する`() {
        val a = node("A", RelayConfig(retryBackoffMs = 5_000)); node("B")
        net.link("A", "B")
        net.failAllSends = true
        a.sendMessage("B", SafetyStatus.SAFE, "")
        net.scan()
        assertEquals(1, events("A", LogEvent.SEND_FAILED).size)

        net.failAllSends = false
        net.advance(1_000); net.scan()
        assertEquals(1, net.sendAttempts, "待ち時間中は再挑戦しない")

        net.advance(5_000); net.scan()
        assertEquals(1, events("B", LogEvent.DELIVERED).size)
    }

    @Test
    fun `バッファ上限を超えたら古いものから捨てる`() {
        val a = node("A", RelayConfig(maxBufferSize = 2))
        repeat(3) { a.sendMessage("Z", SafetyStatus.SAFE, "$it") }
        assertEquals(listOf("1", "2"), a.snapshot().sentByMe.map { it.message.text })
        assertEquals(1, events("A", LogEvent.BUFFER_EVICTED).size)
    }

    @Test
    fun `壊れたデータは記録して無視する`() {
        node("A")
        net.transport("X").send("A", byteArrayOf(9, 9, 9)) {}
        net.link("X", "A")
        net.runUntilIdle()
        assertEquals(1, events("A", LogEvent.INVALID_PACKET).size)
    }

    @Test
    fun `入力チェック`() {
        val a = node("A")
        assertFailsWith<IllegalArgumentException> { a.sendMessage("A", SafetyStatus.SAFE, "") }
        assertFailsWith<IllegalArgumentException> { a.sendMessage("", SafetyStatus.SAFE, "") }
        assertFailsWith<IllegalArgumentException> { a.sendMessage("B", SafetyStatus.SAFE, "あ".repeat(51)) }
        a.sendMessage("B", SafetyStatus.SAFE, "あ".repeat(50))
    }
}
