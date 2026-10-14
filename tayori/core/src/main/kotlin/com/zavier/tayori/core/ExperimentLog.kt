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
        return listOf(
            FORMATTER.format(Instant.ofEpochMilli(e.logTime).atZone(zone)),
            e.logTime, e.deviceId, e.event.name, e.messageId,
            e.originId, e.destId, e.status?.label, e.peerId,
            e.sentAt, e.receivedAt, latency, e.hop, e.ttl,
            e.contactCountTotal, e.peerContactCount,
            e.sendCountMessage, e.sendCountTotal, e.note,
        ).joinToString(",") { escape(it?.toString() ?: "") }
    }

    /** CSVのエスケープ: カンマ・改行・ダブルクォートを含む値は "..." で囲み、" は "" にする。 */
    fun escape(value: String): String =
        if (value.any { it == ',' || it == '"' || it == '\n' || it == '\r' }) {
            "\"" + value.replace("\"", "\"\"") + "\""
        } else {
            value
        }
}
