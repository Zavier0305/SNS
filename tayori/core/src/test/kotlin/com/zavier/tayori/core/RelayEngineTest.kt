package com.zavier.tayori.core

import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
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
        val e = RelayEngine(net.identity(id), net.directory, net.transport(id), log, config, clock = { net.now })
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

        val sent = a.sendMessage("C", SafetyStatus.NEED_RESCUE, "3階にいます")
        net.scan()

        val got = c.snapshot().inbox.single()
        assertEquals(sent.id, got.letter.id)
        assertEquals("3階にいます", got.letter.text)
        assertEquals(SafetyStatus.NEED_RESCUE, got.letter.status)
        assertEquals("A", got.letter.originId)
        assertEquals(2, got.hop, "A→B→C は2ホップ")
        assertTrue(got.verified, "A の署名を確認できる")

        val delivered = events("C", LogEvent.DELIVERED).single()
        assertEquals("A", delivered.originId)
        assertEquals(sent.createdAt, delivered.sentAt)
        assertEquals(net.now, delivered.receivedAt)
        val relayed = events("B", LogEvent.RECEIVED).single()
        assertNull(relayed.originId, "中継した B には送り主が見えない")
        assertNull(relayed.status, "中継した B には状態も見えない")
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
        val a = node("A"); node("B"); val c = node("C"); node("D"); net.identity("E")
        net.link("A", "B"); net.link("A", "D"); net.link("B", "C"); net.link("D", "C"); net.link("B", "D")
        a.sendMessage("E", SafetyStatus.MOVING, "駅へ移動")
        repeat(3) { net.scan() }

        assertEquals(1, events("C", LogEvent.RECEIVED).size)
        assertTrue(events("C", LogEvent.DUPLICATE).isNotEmpty())
        assertEquals(1, c.snapshot().relaying.size)
        assertTrue(a.snapshot().relaying.isEmpty(), "送信元に戻ってきても DUPLICATE 扱い")
    }

    @Test
    fun `同じ相手には同じメッセージを1回しか送らない`() {
        val a = node("A"); node("B"); net.identity("Z")
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

        val expired = events("N11", LogEvent.TTL_EXPIRED).single()
        assertEquals(11, expired.hop)
        assertEquals(0, expired.ttl)
        assertTrue(events("N12", LogEvent.DELIVERED).isEmpty())
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

        net.link("A", "B"); net.scan()
        net.unlink("A", "B"); net.advance(60_000)
        net.link("B", "C"); net.scan()

        assertEquals("無事です", c.snapshot().inbox.single().letter.text)
    }

    @Test
    fun `接触回数と送信回数は別々に数える`() {
        val a = node("A", RelayConfig(contactGapMs = 10_000)); node("B"); net.identity("Z")
        net.link("A", "B")

        net.scan()
        net.advance(1_000); net.scan()
        assertEquals(1, events("A", LogEvent.CONTACT).size)

        net.advance(15_000); net.scan()
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
    fun `壊れたデータは記録して無視する`() {
        node("A")
        net.transport("X").send("A", byteArrayOf(9, 9, 9)) {}
        net.link("X", "A")
        net.runUntilIdle()
        assertEquals(1, events("A", LogEvent.INVALID_PACKET).size)
    }

    @Test
    fun `入力チェック`() {
        val a = node("A"); net.identity("B")
        assertFailsWith<IllegalArgumentException> { a.sendMessage("A", SafetyStatus.SAFE, "") }
        assertFailsWith<IllegalArgumentException> { a.sendMessage("", SafetyStatus.SAFE, "") }
        assertFailsWith<IllegalArgumentException> { a.sendMessage("B", SafetyStatus.SAFE, "あ".repeat(51)) }
        assertFailsWith<UnknownRecipientException> { a.sendMessage("NOBODY", SafetyStatus.SAFE, "") }
        a.sendMessage("B", SafetyStatus.SAFE, "あ".repeat(50))
    }
}
