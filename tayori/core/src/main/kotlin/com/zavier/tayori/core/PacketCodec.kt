package com.zavier.tayori.core

import java.io.ByteArrayOutputStream
import java.nio.BufferUnderflowException
import java.nio.ByteBuffer
import java.util.UUID

/**
 * Message ⇔ バイト列 の変換(BLEで送れるのはバイト列だけなので)。
 *
 * JSONではなく固定順のバイナリにしているのは、BLEの1回の書き込みサイズ(MTU)が小さい端末でも
 * 収まりやすくするため。最大でも約260バイト(本文50文字×UTF-8最大4バイト=200バイト+ヘッダ)。
 *
 * レイアウト(v1):
 *   version(1) | messageId(16) | origin(str) | dest(str) | from(str)
 *   | status(1) | ttl(1) | hop(1) | createdAt(8) | text(str)
 *   str = 長さ1バイト + UTF-8バイト列
 */
object PacketCodec {
    const val VERSION: Byte = 1

    fun encode(m: Message): ByteArray {
        val out = ByteArrayOutputStream(64 + m.text.length * 3)
        out.write(VERSION.toInt())
        val idBuf = ByteBuffer.allocate(16)
            .putLong(m.id.mostSignificantBits)
            .putLong(m.id.leastSignificantBits)
        out.write(idBuf.array())
        writeStr(out, m.originId)
        writeStr(out, m.destId)
        writeStr(out, m.fromId)
        out.write(m.status.code)
        out.write(m.ttl.coerceIn(0, 255))
        out.write(m.hop.coerceIn(0, 255))
        out.write(ByteBuffer.allocate(8).putLong(m.createdAt).array())
        writeStr(out, m.text)
        return out.toByteArray()
    }

    /** 壊れたデータや未知のバージョンなら null(例外にしないのは、電波由来の不正データでアプリを落とさないため)。 */
    fun decode(bytes: ByteArray): Message? = try {
        val buf = ByteBuffer.wrap(bytes)
        if (buf.get() != VERSION) {
            null
        } else {
            val id = UUID(buf.long, buf.long)
            val origin = readStr(buf)
            val dest = readStr(buf)
            val from = readStr(buf)
            val status = SafetyStatus.fromCode(buf.get().toInt() and 0xFF)
            val ttl = buf.get().toInt() and 0xFF
            val hop = buf.get().toInt() and 0xFF
            val createdAt = buf.long
            val text = readStr(buf)
            if (status == null || buf.hasRemaining()) null
            else Message(id, origin, dest, from, status, text, createdAt, ttl, hop)
        }
    } catch (e: BufferUnderflowException) {
        null
    } catch (e: IllegalArgumentException) {
        null
    }

    private fun writeStr(out: ByteArrayOutputStream, s: String) {
        val b = s.toByteArray(Charsets.UTF_8)
        require(b.size <= 255) { "文字列が長すぎます: ${b.size} bytes" }
        out.write(b.size)
        out.write(b)
    }

    private fun readStr(buf: ByteBuffer): String {
        val len = buf.get().toInt() and 0xFF
        val b = ByteArray(len)
        buf.get(b)
        return String(b, Charsets.UTF_8)
    }
}
