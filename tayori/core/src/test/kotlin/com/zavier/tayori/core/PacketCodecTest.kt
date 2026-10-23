package com.zavier.tayori.core

import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PacketCodecTest {
    private val alice = Identity.generate("A")
    private val carol = Identity.generate("C")
    private val carolContact = Contact("C", carol.keyPair.public as java.security.interfaces.ECPublicKey)

    private fun envelope(text: String = "避難所へ向かっています🏃", origin: Identity = alice): Envelope {
        val l = Letter(UUID.randomUUID(), origin.id, "C", SafetyStatus.MOVING, text, 1_760_000_000_123L)
        return Envelope(l.id, "C", "B", 9, 2, l.createdAt, Sealer.seal(l, origin, carolContact))
    }

    @Test
    fun `往復変換で元に戻る`() {
        val e = envelope()
        assertEquals(e, PacketCodec.decode(PacketCodec.encode(e)))
    }

    @Test
    fun `最大サイズでも 512 バイトに収まる`() {
        val big = Identity.generate("ABCDEFGH")
        val l = Letter(UUID.randomUUID(), big.id, "C", SafetyStatus.MOVING, "🏃".repeat(MessageRules.MAX_TEXT_LENGTH), 0)
        val e = Envelope(l.id, "C", "ABCDEFGH", 10, 1, 0, Sealer.seal(l, big, carolContact))
        val bytes = PacketCodec.encode(e)
        assertTrue(bytes.size <= PacketCodec.MAX_PACKET_SIZE, "size=${bytes.size}")
        assertEquals(e, PacketCodec.decode(bytes))
    }

    @Test
    fun `壊れたデータ・大きすぎるデータは null`() {
        val ok = PacketCodec.encode(envelope())
        assertNull(PacketCodec.decode(byteArrayOf()))
        assertNull(PacketCodec.decode(ok.copyOf(ok.size - 1)))
        assertNull(PacketCodec.decode(ok + byteArrayOf(0)))
        assertNull(PacketCodec.decode(ok.clone().also { it[0] = 1 }))
        assertNull(PacketCodec.decode(ByteArray(10_000)))
    }

    @Test
    fun `連絡先コードの往復と不正なコード`() {
        val c = assertNotNull(ContactCode.decode(alice.contactCode()))
        assertEquals("A", c.id)
        assertTrue(c.publicRaw.contentEquals(alice.publicRaw))
        assertNull(ContactCode.decode("hello"))
        assertNull(ContactCode.decode(ContactCode.PREFIX + "AAAA"))
        val restored = assertNotNull(Identity.restore("A", alice.privateBytes(), alice.publicRaw))
        assertEquals(alice.contactCode(), restored.contactCode())
    }

    @Test
    fun `文字数は見た目の文字で数える`() {
        assertEquals(1, MessageRules.textLength("🏃"))
        assertTrue(MessageRules.isValidText("🏃".repeat(50)))
    }

    @Test
    fun `端末IDの形式`() {
        assertTrue(DeviceId.isValid("A"))
        assertTrue(DeviceId.isValid("phone-01"))
        assertTrue(!DeviceId.isValid(""))
        assertTrue(!DeviceId.isValid("123456789"))
        assertTrue(!DeviceId.isValid("あ"))
        assertTrue(DeviceId.isValid(DeviceId.random()))
    }

    @Test
    fun `CSV はカンマや改行を含む値をエスケープする`() {
        assertEquals("abc", LogCsv.escape("abc"))
        assertEquals("\"a,b\"", LogCsv.escape("a,b"))
        assertEquals("\"say \"\"hi\"\"\"", LogCsv.escape("say \"hi\""))
        val line = LogCsv.toLine(
            LogEntry(
                logTime = 0, deviceId = "C", event = LogEvent.DELIVERED, messageId = "m",
                sentAt = 100, receivedAt = 350, hop = 2, contactCountTotal = 3, sendCountTotal = 0,
                note = "x,y",
            ),
            ZoneOffset.UTC,
        )
        assertTrue(line.startsWith("1970-01-01 00:00:00.000,0,C,DELIVERED,m,"))
        assertTrue(line.contains(",100,350,250,2,"), line)
    }
}
