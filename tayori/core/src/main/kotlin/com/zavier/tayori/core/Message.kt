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
 * 端末間でやり取りする1通のメッセージ(=通信パケットの中身)。
 *
 * - [hop]: このコピーが届くまでに「電波で何回飛んだか」。A→B で 1、A→B→C で 2。
 * - [ttl]: このコピーを受け取った端末が、あと何回「中継」してよいか。
 *   送信元は ttl=10 で送り、中継のたびに 1 減る。ttl=0 で受け取った端末はもう中継しない。
 *   → 中継は最大10回、hop は最大11。
 * - [fromId]: 直前にこのパケットを送ってきた端末(中継元)。送り返しを防ぐために使う。
 */
data class Message(
    val id: UUID,
    val originId: String,
    val destId: String,
    val fromId: String,
    val status: SafetyStatus,
    val text: String,
    /** 送信元端末で作成した時刻(エポックミリ秒)。送信元端末の時計なので端末間の時刻ずれに注意。 */
    val createdAt: Long,
    val ttl: Int,
    val hop: Int,
)

object MessageRules {
    const val MAX_TEXT_LENGTH = 50
    const val DEFAULT_TTL = 10

    /** 「50文字」は見た目の文字数で数える(絵文字やサロゲートペアを2文字と数えないため codePoint 単位)。 */
    fun textLength(text: String): Int = text.codePointCount(0, text.length)

    fun isValidText(text: String): Boolean = textLength(text) <= MAX_TEXT_LENGTH
}
