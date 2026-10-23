package com.zavier.tayori.core

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** ログの出来事の種類。CSVの event 列にこの名前がそのまま入る。 */
enum class LogEvent {
    /** 自分がメッセージを作成した(送信ボタン)。 */
    CREATED,
    /** 他端末と「接触」した(しばらく見えていなかった端末が見えた)。送信の有無とは無関係。 */
    CONTACT,
    /** メッセージを相手端末へ実際に送れた(相手の受信確認あり)。 */
    SENT,
    /** 送ろうとしたが失敗した(接続失敗・途中で圏外など)。 */
    SEND_FAILED,
    /** 他人宛てのメッセージを受け取り、中継用に保持した。 */
    RECEIVED,
    /** 自分宛てのメッセージが届いた。 */
    DELIVERED,
    /** 既に受け取ったことのある Message ID が再び届いた(重複排除で破棄)。 */
    DUPLICATE,
    /** TTLを使い切っているので、受け取ったが中継しない。 */
    TTL_EXPIRED,
    /** 中継用バッファが満杯で古いメッセージを捨てた。 */
    BUFFER_EVICTED,
    /** 解読できないデータが届いた。 */
    INVALID_PACKET,
    /** 形式は読めたが、ルール違反(不正なID・古すぎる・未来の時刻・受信しすぎ)なので捨てた。 */
    REJECTED,
    /** 自分宛てだが開封できなかった(自分の鍵で暗号化されていない・書き換えられている)。 */
    UNREADABLE,
    /** 登録済みの送り主を名乗っているのに署名が合わない(なりすまし)ので捨てた。 */
    SPOOFED,
}

/**
 * ログ1行分。CSVの列と1対1に対応する。該当しない列は null(CSVでは空欄)。
 *
 * 「接触回数」と「送信回数」を分けて記録しているのがポイント:
 * - contactCountTotal / peerContactCount … 端末同士が出会った回数(送れたかどうかは関係ない)
 * - sendCountMessage / sendCountTotal …… 実際にメッセージを送れた回数
 */
data class LogEntry(
    val logTime: Long,
    val deviceId: String,
    val event: LogEvent,
    val messageId: String? = null,
    val originId: String? = null,
    val destId: String? = null,
    val status: SafetyStatus? = null,
    /** 相手端末(送信先・受信元・接触相手)。 */
    val peerId: String? = null,
    /** 送信時刻 = 送信元端末でメッセージを作った時刻。 */
    val sentAt: Long? = null,
    /** 受信時刻 = この端末で受け取った時刻。 */
    val receivedAt: Long? = null,
    val hop: Int? = null,
    val ttl: Int? = null,
    /** この端末の累計接触回数(全相手の合計)。 */
    val contactCountTotal: Int,
    /** peerId の相手との累計接触回数。 */
    val peerContactCount: Int? = null,
    /** このメッセージをこの端末が送れた回数。 */
    val sendCountMessage: Int? = null,
    /** この端末の累計送信成功回数(全メッセージの合計)。 */
    val sendCountTotal: Int,
    val note: String? = null,
)

/** ログの保存先の抽象。Androidではファイル、テストではメモリ。 */
interface ExperimentLog {
    fun record(entry: LogEntry)
}

class InMemoryLog : ExperimentLog {
    private val list = mutableListOf<LogEntry>()

    @Synchronized
    override fun record(entry: LogEntry) {
        list += entry
    }

    @Synchronized
    fun entries(): List<LogEntry> = list.toList()
}

object LogCsv {
    val HEADER = listOf(
        "log_time_local", "log_time_ms", "device_id", "event", "message_id",
        "origin_id", "dest_id", "status", "peer_id",
        "sent_at_ms", "received_at_ms", "latency_ms", "hop", "ttl",
        "contact_count_total", "peer_contact_count",
        "send_count_message", "send_count_total", "note",
    )

    private val FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.SSS")

    fun headerLine(): String = HEADER.joinToString(",")

    fun toLine(e: LogEntry, zone: ZoneId = ZoneId.systemDefault()): String {
        // latency_ms は端末間の時計ずれをそのまま含む(実験前に全端末の時刻を自動設定にしておくこと)
        val latency = if (e.sentAt != null && e.receivedAt != null) e.receivedAt - e.sentAt else null
        // 文字の列(他の端末から届いた値が入りうる)は数式として動かないよう無害化する。数値の列はそのまま
        val t = { v: String? -> escape(neutralize(v ?: "")) }
        val n = { v: Number? -> v?.toString() ?: "" }
        return listOf(
            t(FORMATTER.format(Instant.ofEpochMilli(e.logTime).atZone(zone))),
            n(e.logTime), t(e.deviceId), t(e.event.name), t(e.messageId),
            t(e.originId), t(e.destId), t(e.status?.label), t(e.peerId),
            n(e.sentAt), n(e.receivedAt), n(latency), n(e.hop), n(e.ttl),
            n(e.contactCountTotal), n(e.peerContactCount),
            n(e.sendCountMessage), n(e.sendCountTotal), t(e.note),
        ).joinToString(",")
    }

    /**
     * CSVインジェクション対策: = + - @ などで始まる文字は、Excelが数式として実行してしまう。
     * 先頭に ' を付けて「ただの文字」として扱わせる。
     */
    fun neutralize(value: String): String =
        if (value.isNotEmpty() && value[0] in "=+-@\t\r") "'$value" else value

    /** CSVのエスケープ: カンマ・改行・ダブルクォートを含む値は "..." で囲み、" は "" にする。 */
    fun escape(value: String): String =
        if (value.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) {
            "\"" + value.replace("\"", "\"\"") + "\""
        } else {
            value
        }
}
