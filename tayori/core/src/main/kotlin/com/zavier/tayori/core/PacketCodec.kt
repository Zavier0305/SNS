package com.zavier.tayori.core

import java.io.ByteArrayOutputStream
import java.nio.BufferUnderflowException
import java.nio.ByteBuffer
import java.util.UUID

/**
 * 封筒(Envelope) ⇔ バイト列 の変換(BLEで送れるのはバイト列だけなので)。
 *
 * レイアウト(v2):
 *   version(1) | messageId(16) | dest(str) | from(str) | ttl(1) | hop(1) | createdAt(8) | sealedLen(2) | sealed
 *   str = 長さ1バイト + ASCIIバイト列
 *
 * 最大でも約430バイト(本文50文字×UTF-8最大4バイトの場合)で、BLEの書き込み上限 512 バイトに収まる。
 */
object PacketCodec {
    const val VERSION: Byte = 2

    /** これより大きいデータは最初から読まない(巨大なデータを送りつける攻撃への備え)。 */
    const val MAX_PACKET_SIZE = 512

    fun encode(e: Envelope): ByteArray {
        val out = ByteArrayOutputStream(64 + e.sealed.size)
        out.write(VERSION.toInt())
        out.write(ByteBuffer.allocate(16).putLong(e.id.mostSignificantBits).putLong(e.id.leastSignificantBits).array())
        writeStr(out, e.destId)
        writeStr(out, e.fromId)
        out.write(e.ttl.coerceIn(0, 255))
        out.write(e.hop.coerceIn(0, 255))
        out.write(ByteBuffer.allocate(8).putLong(e.createdAt).array())
        out.write(ByteBuffer.allocate(2).putShort(e.sealed.size.toShort()).array())
        out.write(e.sealed)
        return out.toByteArray()
    }

    /** 壊れたデータ・大きすぎるデータ・未知のバージョンなら null(電波由来の不正データでアプリを落とさないため)。 */
    fun decode(bytes: ByteArray): Envelope? {
        if (bytes.isEmpty() || bytes.size > MAX_PACKET_SIZE) return null
        return try {
            val buf = ByteBuffer.wrap(bytes)
            if (buf.get() != VERSION) return null
            val id = UUID(buf.long, buf.long)
            val dest = readStr(buf)
            val from = readStr(buf)
            val ttl = buf.get().toInt() and 0xFF
            val hop = buf.get().toInt() and 0xFF
            val createdAt = buf.long
            val len = buf.short.toInt() and 0xFFFF
            val sealed = ByteArray(len).also { buf.get(it) }
            if (buf.hasRemaining()) null else Envelope(id, dest, from, ttl, hop, createdAt, sealed)
        } catch (e: BufferUnderflowException) {
            null
        }
    }

    private fun writeStr(out: ByteArrayOutputStream, s: String) {
        val b = s.toByteArray(Charsets.US_ASCII)
        require(b.size <= 255) { "文字列が長すぎます: ${b.size} bytes" }
        out.write(b.size)
        out.write(b)
    }

    private fun readStr(buf: ByteBuffer): String {
        val b = ByteArray(buf.get().toInt() and 0xFF)
        buf.get(b)
        return String(b, Charsets.US_ASCII)
    }
}
