package com.zavier.tayori.core

import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PacketCodecTest {
    private val sample = Message(
        id = UUID.fromString("123e4567-e89b-12d3-a456-426614174000"),
        originId = "A", destId = "C", fromId = "B",
        status = SafetyStatus.MOVING, text = "避難所へ向かっています🏃",
        createdAt = 1_760_000_000_123L, ttl = 9, hop = 2,
    )

    @Test
    fun `往復変換で元に戻る`() {
        assertEquals(sample, PacketCodec.decode(PacketCodec.encode(sample)))
    }

    @Test
    fun `最大サイズでも 512 バイトに収まる`() {
        val big = sample.copy(
            originId = "ABCDEFGH", destId = "ABCDEFGH", fromId = "ABCDEFGH",
            text = "🏃".repeat(MessageRules.MAX_TEXT_LENGTH),
        )
        val bytes = PacketCodec.encode(big)
        assertTrue(bytes.size <= 512, "size=${bytes.size}")
        assertEquals(big, PacketCodec.decode(bytes))
    }

    @Test
    fun `壊れたデータは null`() {
        val ok = PacketCodec.encode(sample)
        assertNull(PacketCodec.decode(byteArrayOf()))
        assertNull(PacketCodec.decode(ok.copyOf(ok.size - 1)))
        assertNull(PacketCodec.decode(ok + byteArrayOf(0)))
        assertNull(PacketCodec.decode(ok.clone().also { it[0] = 2 }))
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
        val cols = line.split(",")
        assertEquals(LogCsv.HEADER.size, cols.size - 1, "note のカンマはクォートされるので1列多く割れる")
        assertTrue(line.startsWith("1970-01-01 00:00:00.000,0,C,DELIVERED,m,"))
        assertTrue(line.contains(",100,350,250,2,"), line)
    }
}
