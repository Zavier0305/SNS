package com.zavier.tayori.core

import java.security.interfaces.ECPublicKey
import java.util.UUID
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * 安全性の検証で見つかった問題の再発防止テスト。
 * 悪意ある端末 X が、細工したパケットを送り込む場面を再現する。
 */
class SecurityTest {
    private lateinit var net: FakeNetwork
    private lateinit var b: RelayEngine
    private lateinit var bLog: InMemoryLog

    @BeforeTest
    fun setUp() {
        net = FakeNetwork()
        net.now = 1_800_000_000_000L
        bLog = InMemoryLog()
        b = RelayEngine(net.identity("B"), net.directory, net.transport("B"), bLog, clock = { net.now }).also { it.start() }
        net.identity("C")
        net.transport("X")
        net.link("X", "B")
    }

    private fun contactOf(id: String) = net.directory.find(id)!!

    /** X が作る封筒。sender を差し替えれば「なりすまし」も作れる。 */
    private fun forged(
        sender: Identity = Identity.generate("X"),
        dest: String = "C",
        from: String = "X",
        ttl: Int = 10,
        hop: Int = 1,
        createdAt: Long = net.now,
        text: String = "t",
        id: UUID = UUID.randomUUID(),
    ): Envelope {
        val recipient = net.directory.find(dest) ?: Contact(dest, Identity.generate("Q").keyPair.public as ECPublicKey)
        val l = Letter(id, sender.id, dest, SafetyStatus.NEED_RESCUE, text, createdAt)
        return Envelope(id, dest, from, ttl, hop, createdAt, Sealer.seal(l, sender, recipient))
    }

    private fun inject(e: Envelope) = injectRaw(PacketCodec.encode(e))

    private fun injectRaw(bytes: ByteArray) {
        net.transport("X").send("B", bytes) {}
        net.runUntilIdle()
    }

    private fun events(event: LogEvent) = bLog.entries().filter { it.event == event }

    @Test
    fun `1 TTLを水増ししても上限10に切り詰められる`() {
        inject(forged(ttl = 255))
        assertEquals(9, b.snapshot().relaying.single().ttl, "受け取り時に10へ切り詰め、中継コピーは9")
    }

    @Test
    fun `2 不正なID・ホップ数・古すぎる・未来の時刻は受け取らない`() {
        inject(forged(dest = "これは不正なID"))
        inject(forged(from = "=HACK"))
        inject(forged(hop = 0))
        inject(forged(hop = 200))
        inject(forged(createdAt = net.now - 25 * 3600_000L))
        inject(forged(createdAt = net.now + 2 * 3600_000L))
        assertEquals(6, events(LogEvent.REJECTED).size)
        assertTrue(b.snapshot().relaying.isEmpty())
    }

    @Test
    fun `3 CSVでは数式として動かない`() {
        assertEquals("'=HYPERLINK(1)", LogCsv.neutralize("=HYPERLINK(1)"))
        assertEquals("'+1", LogCsv.neutralize("+1"))
        assertEquals("'@SUM", LogCsv.neutralize("@SUM"))
        assertEquals("A", LogCsv.neutralize("A"))
        val line = LogCsv.toLine(
            LogEntry(logTime = 0, deviceId = "B", event = LogEvent.REJECTED, note = "=cmd|' /C calc'!A0",
                receivedAt = 0, sentAt = 5, contactCountTotal = 0, sendCountTotal = 0),
        )
        assertTrue(line.endsWith(",'=cmd|' /C calc'!A0"), line)
        assertTrue(line.contains(",5,0,-5,"), "数値の列(マイナスの遅延)はそのまま: $line")
    }

    @Test
    fun `4 1台がゴミを大量に送っても、他の人のメッセージは押し出されない`() {
        net.transport("Y"); net.link("Y", "B")
        val good = forged(sender = net.identity("A"), from = "Y")
        net.transport("Y").send("B", PacketCodec.encode(good)) {}
        net.runUntilIdle()

        repeat(1_000) { inject(forged()) }

        val kept = b.snapshot().relaying.map { it.id }
        assertTrue(good.id in kept, "正しいメッセージは残る")
        assertTrue(kept.size <= 31, "X からは1分あたり30件までしか受け取らない: ${kept.size}")
        assertTrue(events(LogEvent.REJECTED).any { it.note!!.startsWith("受信しすぎ") })
    }

    @Test
    fun `4b 預かり枠が満杯なら、一番多く持ち込んだ相手のものから捨てる`() {
        val small = RelayEngine(net.identity("S"), net.directory, net.transport("S"), InMemoryLog(),
            RelayConfig(maxBufferSize = 5, maxNewPerPeer = 100), clock = { net.now }).also { it.start() }
        net.transport("Y")
        val good = forged(sender = net.identity("A"), from = "Y")
        net.transport("Y").send("S", PacketCodec.encode(good)) {}
        repeat(20) { net.transport("X").send("S", PacketCodec.encode(forged())) {} }
        net.link("X", "S"); net.link("Y", "S"); net.runUntilIdle()
        val kept = small.snapshot().relaying.map { it.id }
        assertEquals(5, kept.size)
        assertTrue(good.id in kept)
    }

    @Test
    fun `5 受信済みIDの記憶は上限で頭打ちになり、古いものは忘れる`() {
        val mLog = InMemoryLog()
        val e = RelayEngine(net.identity("M"), net.directory, net.transport("M"), mLog,
            RelayConfig(maxSeen = 100, maxNewPerPeer = 100_000, maxBufferSize = 10), clock = { net.now }).also { it.start() }
        net.link("X", "M")
        val first = forged(dest = "C")
        val send = { env: Envelope -> net.transport("X").send("M", PacketCodec.encode(env)) {}; net.runUntilIdle() }
        send(first)
        send(first)
        val idStr = first.id.toString()
        assertEquals(1, mLog.entries().count { it.event == LogEvent.DUPLICATE && it.messageId == idStr }, "直後は覚えている")
        repeat(500) { send(forged()) }
        send(first)
        // 上限100件を超えた分は忘れるので、最初のIDは「新しいもの」として受け取り直される(=記憶が増え続けていない)
        assertEquals(2, mLog.entries().count { it.event == LogEvent.RECEIVED && it.messageId == idStr })
        assertTrue(e.snapshot().relaying.size <= 10)

        // 古いものは時間でも忘れる: 25時間後に同じIDが来ても「古すぎる」で捨てる(重複排除の穴にならない)
        net.advance(25 * 3600_000L)
        send(first)
        assertTrue(mLog.entries().last().event == LogEvent.REJECTED)
    }

    @Test
    fun `7 登録済みの人になりすますと SPOOFED として捨てられる`() {
        val cLog = InMemoryLog()
        val c = RelayEngine(net.identity("C"), net.directory, net.transport("C"), cLog, clock = { net.now }).also { it.start() }
        net.identity("A") // C は A の連絡先を知っている
        net.link("X", "C")
        val fakeA = Identity.generate("A") // X が勝手に作った「A」の鍵
        net.transport("X").send("C", PacketCodec.encode(forged(sender = fakeA))) {}
        net.runUntilIdle()
        assertTrue(c.snapshot().inbox.isEmpty())
        assertEquals(1, cLog.entries().count { it.event == LogEvent.SPOOFED })
    }

    @Test
    fun `7b 未登録の送り主からは届くが「本人確認できない」と表示される`() {
        val c = RelayEngine(net.identity("C"), net.directory, net.transport("C"), InMemoryLog(), clock = { net.now }).also { it.start() }
        net.link("X", "C")
        net.transport("X").send("C", PacketCodec.encode(forged(sender = Identity.generate("STRANGER")))) {}
        net.runUntilIdle()
        assertFalse(c.snapshot().inbox.single().verified)
    }

    @Test
    fun `8 本文は電波に乗らず、宛先以外は開けず、封筒の書き換えも見破る`() {
        val env = forged(sender = net.identity("A"), text = "3階の西側にいます")
        val bytes = PacketCodec.encode(env)
        assertFalse(String(bytes, Charsets.UTF_8).contains("3階の西側にいます"), "本文が平文で乗っていない")
        assertFalse(String(bytes, Charsets.UTF_8).contains("NEED_RESCUE"))

        val carol = net.identity("C")
        assertIs<OpenResult.Ok>(Sealer.open(env, carol, net.directory))
        assertIs<OpenResult.Unreadable>(Sealer.open(env, net.identity("B"), net.directory), "中継役の B は開けない")
        assertIs<OpenResult.Unreadable>(Sealer.open(env.copy(createdAt = env.createdAt + 1), carol, net.directory), "作成時刻の改ざん")
        val flipped = env.sealed.clone().also { it[it.size - 1] = (it[it.size - 1].toInt() xor 1).toByte() }
        assertIs<OpenResult.Unreadable>(Sealer.open(env.copy(sealed = flipped), carol, net.directory), "中身の改ざん")
    }

    @Test
    fun `8b 曲線の上にない点(不正曲線攻撃)は鍵として受け付けない`() {
        val good = net.identity("A").publicRaw
        val bad = good.clone().also { it[64] = (it[64].toInt() xor 1).toByte() }
        assertTrue(P256.decode(good) != null)
        assertNull(P256.decode(bad))
        assertNull(P256.decode(ByteArray(65).also { it[0] = 4 }))
    }

    @Test
    fun `大きすぎるデータは読まずに捨てる`() {
        injectRaw(ByteArray(100_000))
        assertEquals(1, events(LogEvent.INVALID_PACKET).size)
    }

    @Test
    fun `送信元に戻ってきた自分のメッセージや、関係ない宛先も中身は見えない`() {
        val c = contactOf("C")
        assertEquals("C", c.id)
        inject(forged(sender = net.identity("A")))
        val r = bLog.entries().single { it.event == LogEvent.RECEIVED }
        assertNull(r.originId)
        assertNull(r.status)
    }
}
