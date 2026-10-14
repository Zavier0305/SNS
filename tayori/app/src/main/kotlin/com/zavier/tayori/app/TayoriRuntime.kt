package com.zavier.tayori.app

import android.content.Context
import com.zavier.tayori.core.DeviceId
import com.zavier.tayori.core.RelayEngine
import java.io.File
import java.util.concurrent.CopyOnWriteArraySet

/**
 * アプリ全体で1つだけ持つ「本体」。画面(MainActivity)と常駐サービス(TayoriService)の両方から使う。
 * 画面を閉じてもサービスが動いている限り、ここにある RelayEngine が中継を続ける。
 */
object TayoriRuntime {
    private const val PREFS = "tayori"
    private const val KEY_DEVICE_ID = "device_id"

    private lateinit var appContext: Context
    lateinit var log: CsvFileLog
        private set

    @Volatile
    var engine: RelayEngine? = null
        private set

    @Volatile
    var transport: BleTransport? = null
        private set

    @Volatile
    var running = false
        private set

    private val listeners = CopyOnWriteArraySet<() -> Unit>()

    @Synchronized
    fun init(context: Context) {
        if (::appContext.isInitialized) return
        appContext = context.applicationContext
        log = CsvFileLog(File(appContext.filesDir, "tayori_log.csv"))
    }

    var deviceId: String
        get() {
            val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            return prefs.getString(KEY_DEVICE_ID, null) ?: DeviceId.random().also { deviceId = it }
        }
        set(value) {
            require(DeviceId.isValid(value))
            check(!running) { "動作中は端末IDを変更できません" }
            appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_DEVICE_ID, value).apply()
        }

    /** TayoriService から呼ぶ。 */
    @Synchronized
    fun start() {
        if (running) return
        val id = deviceId
        // 端末IDが同じなら前回のエンジンを使い回す(停止→再開しても受信済みIDを忘れず、重複排除が続くように)
        val e = engine?.takeIf { it.selfId == id } ?: run {
            val t = BleTransport(appContext, id)
            t.onStatusChanged = ::notifyChanged
            transport = t
            RelayEngine(id, t, log).also { it.onChanged = ::notifyChanged }
        }
        engine = e
        e.start()
        running = true
        notifyChanged()
    }

    @Synchronized
    fun stop() {
        if (!running) return
        engine?.stop()
        running = false
        notifyChanged()
    }

    fun addListener(l: () -> Unit) = listeners.add(l)

    fun removeListener(l: () -> Unit) = listeners.remove(l)

    private fun notifyChanged() = listeners.forEach { it() }
}
