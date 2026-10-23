package com.zavier.tayori.core

import java.util.UUID

/** 定型ステータス。code は通信パケットに入れる1バイトの値(変更すると旧版と通信できなくなる)。 */
enum class SafetyStatus(val code: Int, val label: String) {
    SAFE(1, "無事"),
    NEED_RESCUE(2, "要救助"),
    MOVING(3, "移動中");

    companion object {
        fun fromCode(code: Int): SafetyStatus? = entries.firstOrNull { it.code == code }
    }
}

/**
 * 手紙の中身(暗号化される部分)。送り主と宛先の人しか読めない。
 * 中継する端末からは、送り主・状態・本文は見えない。
 */
data class Letter(
    val id: UUID,
    val originId: String,
    val destId: String,
    val status: SafetyStatus,
    val text: String,
    /** 送信元端末で作成した時刻(エポックミリ秒)。送信元端末の時計なので端末間の時刻ずれに注意。 */
    val createdAt: Long,
)

/**
 * 電波に乗る「封筒」。中継する端末に見えるのはこの外側だけ。
 *
 * - [destId]: 宛先の端末ID(届けるために必要なので見える)
 * - [fromId]: 直前に渡してきた端末の「一時ID」(定期的に変わる。送り返し防止に使う)
 * - [hop]: このコピーが届くまでに電波で何回飛んだか。A→B で 1、A→B→C で 2
 * - [ttl]: 受け取った端末があと何回中継してよいか。送信元は10で送り、中継のたびに1減る
 * - [createdAt]: 作成時刻。古すぎるメッセージを捨てるために見える(暗号の中身と一致することを確認する)
 * - [sealed]: 暗号化された中身(送り主・状態・本文・送り主の署名)
 */
data class Envelope(
    val id: UUID,
    val destId: String,
    val fromId: String,
    val ttl: Int,
    val hop: Int,
    val createdAt: Long,
    val sealed: ByteArray,
) {
    // ByteArray を含むので equals/hashCode を中身で比べる
    override fun equals(other: Any?): Boolean =
        other is Envelope && id == other.id && destId == other.destId && fromId == other.fromId &&
            ttl == other.ttl && hop == other.hop && createdAt == other.createdAt && sealed.contentEquals(other.sealed)

    override fun hashCode(): Int = id.hashCode()
}

/** 自分宛てに届き、開封できた手紙。 */
data class ReceivedLetter(
    val letter: Letter,
    val hop: Int,
    val receivedAt: Long,
    /** true = 連絡先に登録済みの送り主の署名を確認できた(本人からと確認済み)。 */
    val verified: Boolean,
)

object MessageRules {
    const val MAX_TEXT_LENGTH = 50
    const val DEFAULT_TTL = 10

    /** 「50文字」は見た目の文字数で数える(絵文字やサロゲートペアを2文字と数えないため codePoint 単位)。 */
    fun textLength(text: String): Int = text.codePointCount(0, text.length)

    fun isValidText(text: String): Boolean = textLength(text) <= MAX_TEXT_LENGTH
}
