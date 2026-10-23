package com.zavier.tayori.core

import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.nio.ByteBuffer
import java.security.KeyFactory
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.SecureRandom
import java.security.Signature
import java.security.interfaces.ECPrivateKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import java.security.spec.PKCS8EncodedKeySpec
import java.util.Base64
import java.util.UUID
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.KeyAgreement
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/*
 * 暗号の仕組み(用語の補足):
 * - 公開鍵暗号: 「公開鍵」で鍵をかけると、対になる「秘密鍵」を持つ本人しか開けられない。
 *   公開鍵は人に渡してよく、秘密鍵はスマホの中から出さない。
 * - 電子署名: 送り主が秘密鍵で「署名」を付けると、公開鍵を持つ人は「本人が書いた・書き換えられていない」と確かめられる。
 * - 連絡先コード: 自分の端末IDと公開鍵をまとめた文字列(QRコードにして交換する)。
 *
 * 使っている方式は、AndroidとPCのJavaのどちらにも最初から入っている標準のものだけ:
 * 楕円曲線 P-256(ECDH で鍵を共有、ECDSA で署名)+ HKDF-SHA256 + AES-256-GCM。
 */

/** P-256 の公開鍵 ⇔ 65バイト(0x04 + X 32バイト + Y 32バイト)の変換。 */
object P256 {
    private val P = BigInteger("ffffffff00000001000000000000000000000000ffffffffffffffffffffffff", 16)
    private val A = P.subtract(BigInteger.valueOf(3))
    private val B = BigInteger("5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b", 16)
    const val RAW_SIZE = 65

    val params: ECParameterSpec by lazy {
        val kpg = KeyPairGenerator.getInstance("EC")
        kpg.initialize(ECGenParameterSpec("secp256r1"))
        (kpg.generateKeyPair().public as ECPublicKey).params
    }

    fun generate(random: SecureRandom = SecureRandom()): KeyPair =
        KeyPairGenerator.getInstance("EC").apply { initialize(ECGenParameterSpec("secp256r1"), random) }.generateKeyPair()

    fun encode(key: ECPublicKey): ByteArray {
        val out = ByteArray(RAW_SIZE)
        out[0] = 4
        fixed32(key.w.affineX).copyInto(out, 1)
        fixed32(key.w.affineY).copyInto(out, 33)
        return out
    }

    /**
     * 65バイト → 公開鍵。曲線の上にない点は必ず拒否する。
     * (相手から届いた点をそのまま鍵共有に使うと、こちらの秘密鍵が少しずつ漏れる「不正曲線攻撃」があるため)
     */
    fun decode(raw: ByteArray): ECPublicKey? {
        if (raw.size != RAW_SIZE || raw[0] != 4.toByte()) return null
        val x = BigInteger(1, raw.copyOfRange(1, 33))
        val y = BigInteger(1, raw.copyOfRange(33, 65))
        if (x >= P || y >= P) return null
        val lhs = y.modPow(BigInteger.valueOf(2), P)
        val rhs = x.modPow(BigInteger.valueOf(3), P).add(A.multiply(x)).add(B).mod(P)
        if (lhs != rhs) return null
        return runCatching {
            KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(ECPoint(x, y), params)) as ECPublicKey
        }.getOrNull()
    }

    private fun fixed32(v: BigInteger): ByteArray {
        val b = v.toByteArray()
        return when {
            b.size == 32 -> b
            b.size > 32 -> b.copyOfRange(b.size - 32, b.size)
            else -> ByteArray(32 - b.size) + b
        }
    }
}

/** 自分の身元(端末ID + 鍵のペア)。秘密鍵はこの端末の外に出さない。 */
class Identity(val id: String, val keyPair: KeyPair) {
    init {
        require(DeviceId.isValid(id))
    }

    val publicRaw: ByteArray get() = P256.encode(keyPair.public as ECPublicKey)

    fun contactCode(): String = ContactCode.encode(id, publicRaw)

    /** 保存用: 秘密鍵(PKCS#8形式)のバイト列。 */
    fun privateBytes(): ByteArray = keyPair.private.encoded

    companion object {
        fun generate(id: String): Identity = Identity(id, P256.generate())

        fun restore(id: String, privatePkcs8: ByteArray, publicRaw: ByteArray): Identity? = runCatching {
            val priv = KeyFactory.getInstance("EC").generatePrivate(PKCS8EncodedKeySpec(privatePkcs8)) as ECPrivateKey
            val pub = P256.decode(publicRaw) ?: return null
            Identity(id, KeyPair(pub, priv))
        }.getOrNull()
    }
}

/** 連絡先(相手の端末IDと公開鍵)。 */
data class Contact(val id: String, val publicKey: ECPublicKey) {
    val publicRaw: ByteArray get() = P256.encode(publicKey)
}

/** 連絡先の検索。アプリでは端末内に保存した一覧、テストではメモリ上の一覧。 */
fun interface ContactBook {
    fun find(id: String): Contact?
}

/** 連絡先コード = "TAYORI1:" + Base64(IDの長さ + ID + 公開鍵65バイト)。QRコードにして交換する。 */
object ContactCode {
    const val PREFIX = "TAYORI1:"

    fun encode(id: String, publicRaw: ByteArray): String {
        val idb = id.toByteArray(Charsets.US_ASCII)
        return PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(byteArrayOf(idb.size.toByte()) + idb + publicRaw)
    }

    fun decode(code: String): Contact? = runCatching {
        val s = code.trim()
        if (!s.startsWith(PREFIX)) return null
        val b = Base64.getUrlDecoder().decode(s.removePrefix(PREFIX))
        val n = b[0].toInt() and 0xFF
        if (b.size != 1 + n + P256.RAW_SIZE) return null
        val id = String(b, 1, n, Charsets.US_ASCII)
        if (!DeviceId.isValid(id)) return null
        val key = P256.decode(b.copyOfRange(1 + n, b.size)) ?: return null
        Contact(id, key)
    }.getOrNull()
}

/** 開封の結果。 */
sealed interface OpenResult {
    data class Ok(val letter: Letter, val verified: Boolean) : OpenResult
    /** 宛先が自分でない、または中身が壊れている・書き換えられている。 */
    data object Unreadable : OpenResult
    /** 登録済みの送り主を名乗っているのに署名が合わない = なりすまし。 */
    data class Spoofed(val claimedOrigin: String) : OpenResult
}

/**
 * 手紙の封入(暗号化+署名)と開封(復号+署名確認)。
 *
 * 封入: 使い捨ての鍵ペアを作り、宛先の公開鍵と ECDH で共有の秘密を作る → HKDF で AES 鍵にする
 *       → 中身(送り主・状態・本文・署名)を AES-GCM で暗号化。
 *       封筒の外側(ID・宛先・作成時刻)も「追加認証データ」として一緒に守るので、中継者が書き換えると開封に失敗する。
 */
object Sealer {
    private const val SIG_LABEL = "tayori-sig-v2"
    private const val KDF_INFO = "tayori-seal-v2"
    private const val NONCE = 12
    private val random = SecureRandom()

    fun seal(letter: Letter, sender: Identity, recipient: Contact): ByteArray {
        require(letter.destId == recipient.id)
        val signature = Signature.getInstance("SHA256withECDSA").run {
            initSign(sender.keyPair.private)
            update(signedBytes(letter))
            sign()
        }
        val inner = ByteArrayOutputStream().apply {
            writeStr(this, letter.originId)
            write(letter.status.code)
            writeStr(this, letter.text)
            write(signature.size)
            write(signature)
        }.toByteArray()

        val eph = P256.generate(random)
        val key = deriveKey(eph.private as ECPrivateKey, recipient.publicKey, letter.id)
        val nonce = ByteArray(NONCE).also(random::nextBytes)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply {
            init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce))
            updateAAD(aad(letter.id, letter.destId, letter.createdAt))
        }
        return P256.encode(eph.public as ECPublicKey) + nonce + cipher.doFinal(inner)
    }

    fun open(envelope: Envelope, me: Identity, contacts: ContactBook): OpenResult {
        val s = envelope.sealed
        if (s.size < P256.RAW_SIZE + NONCE + 16) return OpenResult.Unreadable
        val ephPub = P256.decode(s.copyOfRange(0, P256.RAW_SIZE)) ?: return OpenResult.Unreadable
        val nonce = s.copyOfRange(P256.RAW_SIZE, P256.RAW_SIZE + NONCE)
        val body = s.copyOfRange(P256.RAW_SIZE + NONCE, s.size)
        val inner = try {
            val key = deriveKey(me.keyPair.private as ECPrivateKey, ephPub, envelope.id)
            Cipher.getInstance("AES/GCM/NoPadding").run {
                init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(128, nonce))
                updateAAD(aad(envelope.id, envelope.destId, envelope.createdAt))
                doFinal(body)
            }
        } catch (e: AEADBadTagException) {
            return OpenResult.Unreadable
        } catch (e: java.security.GeneralSecurityException) {
            return OpenResult.Unreadable
        }
        val buf = ByteBuffer.wrap(inner)
        val parsed = runCatching {
            val origin = readStr(buf)
            val status = SafetyStatus.fromCode(buf.get().toInt() and 0xFF) ?: return OpenResult.Unreadable
            val text = readStr(buf)
            val sig = ByteArray(buf.get().toInt() and 0xFF).also { buf.get(it) }
            if (buf.hasRemaining()) return OpenResult.Unreadable
            Triple(Letter(envelope.id, origin, envelope.destId, status, text, envelope.createdAt), sig, origin)
        }.getOrNull() ?: return OpenResult.Unreadable
        val (letter, sig, origin) = parsed
        if (!DeviceId.isValid(origin) || !MessageRules.isValidText(letter.text)) return OpenResult.Unreadable

        val contact = contacts.find(origin) ?: return OpenResult.Ok(letter, verified = false)
        val ok = runCatching {
            Signature.getInstance("SHA256withECDSA").run {
                initVerify(contact.publicKey)
                update(signedBytes(letter))
                verify(sig)
            }
        }.getOrDefault(false)
        return if (ok) OpenResult.Ok(letter, verified = true) else OpenResult.Spoofed(origin)
    }

    /** 署名する中身: ID・宛先・送り主・状態・作成時刻・本文。どれか1つでも変わると署名が合わなくなる。 */
    private fun signedBytes(l: Letter): ByteArray = ByteArrayOutputStream().apply {
        write(SIG_LABEL.toByteArray())
        write(uuidBytes(l.id))
        writeStr(this, l.destId)
        writeStr(this, l.originId)
        write(l.status.code)
        write(ByteBuffer.allocate(8).putLong(l.createdAt).array())
        writeStr(this, l.text)
    }.toByteArray()

    private fun aad(id: UUID, dest: String, createdAt: Long): ByteArray =
        uuidBytes(id) + dest.toByteArray(Charsets.US_ASCII) + ByteBuffer.allocate(8).putLong(createdAt).array()

    private fun deriveKey(priv: ECPrivateKey, pub: ECPublicKey, id: UUID): ByteArray {
        val shared = KeyAgreement.getInstance("ECDH").run {
            init(priv)
            doPhase(pub, true)
            generateSecret()
        }
        return hkdf(shared, salt = uuidBytes(id), info = KDF_INFO.toByteArray(), length = 32)
    }

    /** HKDF-SHA256(RFC 5869)。共有の秘密から暗号用の鍵を取り出す。 */
    internal fun hkdf(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int): ByteArray {
        val prk = Mac.getInstance("HmacSHA256").run { init(SecretKeySpec(salt, "HmacSHA256")); doFinal(ikm) }
        val out = ByteArrayOutputStream()
        var t = ByteArray(0)
        var i = 1
        while (out.size() < length) {
            t = Mac.getInstance("HmacSHA256").run {
                init(SecretKeySpec(prk, "HmacSHA256")); update(t); update(info); update(i.toByte()); doFinal()
            }
            out.write(t)
            i++
        }
        return out.toByteArray().copyOf(length)
    }

    private fun uuidBytes(id: UUID): ByteArray =
        ByteBuffer.allocate(16).putLong(id.mostSignificantBits).putLong(id.leastSignificantBits).array()

    private fun writeStr(out: ByteArrayOutputStream, s: String) {
        val b = s.toByteArray(Charsets.UTF_8)
        require(b.size <= 255)
        out.write(b.size)
        out.write(b)
    }

    private fun readStr(buf: ByteBuffer): String {
        val b = ByteArray(buf.get().toInt() and 0xFF)
        buf.get(b)
        return String(b, Charsets.UTF_8)
    }
}
