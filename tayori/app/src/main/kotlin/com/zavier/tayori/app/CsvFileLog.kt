package com.zavier.tayori.app

import com.zavier.tayori.core.ExperimentLog
import com.zavier.tayori.core.LogCsv
import com.zavier.tayori.core.LogEntry
import java.io.File
import java.io.FileWriter
import java.io.OutputStream

/**
 * 実験ログを端末内(アプリ専用フォルダ)のCSVファイルに1行ずつ追記する。
 * 1行ごとにファイルを閉じるので、アプリが強制終了してもそれまでのログは残る。
 */
class CsvFileLog(private val file: File) : ExperimentLog {

    @Volatile
    var lineCount: Int = countLines()
        private set

    @Synchronized
    override fun record(entry: LogEntry) {
        val isNew = !file.exists() || file.length() == 0L
        FileWriter(file, Charsets.UTF_8, true).use { w ->
            if (isNew) w.write(LogCsv.headerLine() + "\n")
            w.write(LogCsv.toLine(entry) + "\n")
        }
        lineCount++
    }

    /**
     * 書き出し。先頭にBOM(Excelに「これはUTF-8です」と伝える印)を付ける。
     * 付けないと、Excelで開いたとき日本語(ステータスの「無事」など)が文字化けする。
     */
    @Synchronized
    fun exportTo(out: OutputStream) {
        out.write(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()))
        if (file.exists()) {
            file.inputStream().use { it.copyTo(out) }
        } else {
            out.write((LogCsv.headerLine() + "\n").toByteArray(Charsets.UTF_8))
        }
    }

    @Synchronized
    fun clear() {
        file.delete()
        lineCount = 0
    }

    private fun countLines(): Int =
        if (file.exists()) file.useLines { lines -> (lines.count() - 1).coerceAtLeast(0) } else 0
}
