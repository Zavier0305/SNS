package com.zavier.tayori.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.zavier.tayori.core.Contact
import com.zavier.tayori.core.ContactBook
import com.zavier.tayori.core.ContactCode
import com.zavier.tayori.core.DeviceId
import com.zavier.tayori.core.Identity
import com.zavier.tayori.core.RelayConfig
import com.zavier.tayori.core.RelayEngine
import com.zavier.tayori.core.SafetyStatus
import java.io.File
import java.util.concurrent.CopyOnWriteArraySet

/**
 * アプリ全体で1つだけ持つ「本体」。画面(MainActivity)と常駐サービス(TayoriService)の両方から使う。
 * 画面を閉じてもサービスが動いている限り、ここにある RelayEngine が中継を続ける。
 *
 * 保存しているもの(どれもアプリ専用の領域で、他のアプリからは読めない):
 * - 端末ID / 自分の鍵ペア(秘密鍵はこの端末から出さない)
 * - 連絡先(相手の端末IDと公開鍵)
 */
object TayoriRuntime {
    private const val PREFS = "tayori"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_PRIVATE = "private_key"
    private const val KEY_PUBLIC = "public_key"
    private const val KEY_CONTACTS = "contacts"
    private const val KEY_EXPERIMENT = "experiment_mode"
    private const val KEY_AUTO_DEST = "auto_dest"
    private const val KEY_AUTO_INTERVAL = "auto_interval_sec"

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

    /** いまの engine が実験モードで作られたか。 */
    private var engineExperiment = false

    @Synchronized
    fun init(context: Context) {
        if (::appContext.isInitialized) return
        appContext = context.applicationContext
        log = CsvFileLog(File(appContext.filesDir, "tayori_log.csv"))
    }

    private val prefs get() = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    var deviceId: String
        get() = prefs.getString(KEY_DEVICE_ID, null) ?: DeviceId.random().also { deviceId = it }
        set(value) {
            require(DeviceId.isValid(value))
            check(!running) { "動作中は端末IDを変更できません" }
            prefs.edit().putString(KEY_DEVICE_ID, value).apply()
        }

    /** 自分の身元。鍵ペアは初回に作って保存し、端末IDを変えても同じ鍵を使い続ける。 */
    @Synchronized
    fun identity(): Identity {
        val id = deviceId
        val priv = prefs.getString(KEY_PRIVATE, null)
        val pub = prefs.getString(KEY_PUBLIC, null)
        if (priv != null && pub != null) {
            Identity.restore(id, b64d(priv), b64d(pub))?.let { return it }
        }
        val fresh = Identity.generate(id)
        prefs.edit().putString(KEY_PRIVATE, b64e(fresh.privateBytes())).putString(KEY_PUBLIC, b64e(fresh.publicRaw)).apply()
        return fresh
    }

    // ---------------------------------------------------------------- 連絡先

    /** 登録済みの連絡先(端末ID → 連絡先)。 */
    fun contacts(): List<Contact> =
        prefs.getStringSet(KEY_CONTACTS, emptySet()).orEmpty().mapNotNull(ContactCode::decode).sortedBy { it.id }

    private val book = ContactBook { id -> contacts().firstOrNull { it.id == id } }

    /** 連絡先コードを登録する。同じ端末IDがあれば上書き。成功したら登録した連絡先を返す。 */
    @Synchronized
    fun addContact(code: String): Contact? {
        val c = ContactCode.decode(code) ?: return null
        if (c.id == deviceId) return null
        val others = contacts().filter { it.id != c.id }.map { ContactCode.encode(it.id, it.publicRaw) }
        prefs.edit().putStringSet(KEY_CONTACTS, (others + ContactCode.encode(c.id, c.publicRaw)).toSet()).apply()
        notifyChanged()
        return c
    }

    @Synchronized
    fun removeContact(id: String) {
        val rest = contacts().filter { it.id != id }.map { ContactCode.encode(it.id, it.publicRaw) }.toSet()
        prefs.edit().putStringSet(KEY_CONTACTS, rest).remove(KEY_NAME_PREFIX + id).apply()
        notifyChanged()
    }

    /** 連絡先に付けた名前(この端末の中だけで使う。相手には伝わらない)。未設定なら null。 */
    fun contactName(id: String): String? = prefs.getString(KEY_NAME_PREFIX + id, null)?.takeIf { it.isNotBlank() }

    /** 画面に出す名前: 付けた名前があればそれ、なければ端末ID。 */
    fun displayName(id: String): String = contactName(id) ?: id

    fun setContactName(id: String, name: String) {
        val n = name.trim().take(MAX_NAME_LENGTH)
        prefs.edit().apply { if (n.isEmpty()) remove(KEY_NAME_PREFIX + id) else putString(KEY_NAME_PREFIX + id, n) }.apply()
        notifyChanged()
    }

    const val MAX_NAME_LENGTH = 20
    private const val KEY_NAME_PREFIX = "contact_name_"

    // ---------------------------------------------------------------- 実験モード

    /**
     * 実験モード: 周りに見せるIDを端末IDに固定し(15分ごとに変えない)、電波の強さを5秒ごとに記録する。
     * 追跡されやすくなるので普段はオフ。切り替えは中継を止めているときだけ(動作中の通信路の設定は変えられないため)。
     */
    var experimentMode: Boolean
        get() = prefs.getBoolean(KEY_EXPERIMENT, false)
        set(value) {
            check(!running) { "動作中は切り替えられません" }
            prefs.edit().putBoolean(KEY_EXPERIMENT, value).apply()
            notifyChanged()
        }

    private const val RSSI_SAMPLE_MS = 5_000L
    const val MIN_AUTO_INTERVAL_SEC = 10
    const val MAX_AUTO_INTERVAL_SEC = 3_600
    /** 1回の自動送信で送る上限。自分のメッセージは預かり枠から捨てないので、送りすぎて溜まり続けないように止める。 */
    const val MAX_AUTO_COUNT = 200

    private val main = Handler(Looper.getMainLooper())

    /** 自動送信の宛先。null なら止まっている。 */
    @Volatile
    var autoDest: String? = null
        private set

    @Volatile
    var autoCount = 0
        private set

    var autoIntervalSec: Int
        get() = prefs.getInt(KEY_AUTO_INTERVAL, 30)
        private set(value) = prefs.edit().putInt(KEY_AUTO_INTERVAL, value).apply()

    /** 前回の自動送信の宛先(入力欄の初期値)。 */
    val lastAutoDest: String get() = prefs.getString(KEY_AUTO_DEST, "").orEmpty()

    private val autoTick = object : Runnable {
        override fun run() {
            val dest = autoDest ?: return
            val e = engine
            if (!running || e == null) return stopAutoSend("中継が止まったため")
            if (autoCount >= MAX_AUTO_COUNT) return stopAutoSend("上限の${MAX_AUTO_COUNT}通を送ったため")
            autoCount++
            val failure = runCatching { e.sendMessage(dest, SafetyStatus.SAFE, "自動#$autoCount", logNote = "自動送信 #$autoCount") }.exceptionOrNull()
            if (failure != null) return stopAutoSend("送れなかったため(${failure.message})")
            main.postDelayed(this, autoIntervalSec * 1000L)
        }
    }

    /**
     * [dest] へ [intervalSec] 秒ごとに「無事」を自動で送る(すぐに1通目を送る)。
     * 実験モードで中継中のときだけ使える。宛先が連絡先にないなどで送れなければ null 以外の理由を返す。
     */
    fun startAutoSend(dest: String, intervalSec: Int): String? {
        if (!running || !experimentMode) return "実験モードで中継を開始してから使えます"
        if (contacts().none { it.id == dest }) return "「$dest」は連絡先に登録されていません"
        if (intervalSec !in MIN_AUTO_INTERVAL_SEC..MAX_AUTO_INTERVAL_SEC) return "間隔は${MIN_AUTO_INTERVAL_SEC}〜${MAX_AUTO_INTERVAL_SEC}秒にしてください"
        main.removeCallbacks(autoTick)
        autoIntervalSec = intervalSec
        prefs.edit().putString(KEY_AUTO_DEST, dest).apply()
        autoCount = 0
        autoStopReason = null
        autoDest = dest
        main.post(autoTick)
        notifyChanged()
        return null
    }

    /** 自動送信が最後に止まった理由(自分で止めたときは null)。 */
    @Volatile
    var autoStopReason: String? = null
        private set

    fun stopAutoSend(reason: String? = null) {
        main.removeCallbacks(autoTick)
        if (autoDest == null) return
        autoDest = null
        autoStopReason = reason
        notifyChanged()
    }

    // ---------------------------------------------------------------- 開始・停止

    /** TayoriService から呼ぶ。 */
    @Synchronized
    fun start() {
        if (running) return
        val id = deviceId
        val exp = experimentMode
        // 端末IDと実験モードが同じなら前回のエンジンを使い回す(停止→再開しても受信済みIDを忘れず、重複排除が続くように)
        val e = engine?.takeIf { it.selfId == id && engineExperiment == exp } ?: run {
            val t = BleTransport(appContext, fixedHandle = if (exp) id else null)
            t.onStatusChanged = ::notifyChanged
            transport = t
            val config = RelayConfig(rssiSampleMs = if (exp) RSSI_SAMPLE_MS else 0)
            RelayEngine(identity(), book, t, log, config).also { it.onChanged = ::notifyChanged }
        }
        engine = e
        engineExperiment = exp
        e.start()
        running = true
        notifyChanged()
    }

    @Synchronized
    fun stop() {
        if (!running) return
        stopAutoSend("中継を止めたため")
        engine?.stop()
        running = false
        notifyChanged()
    }

    fun addListener(l: () -> Unit) = listeners.add(l)

    fun removeListener(l: () -> Unit) = listeners.remove(l)

    private fun notifyChanged() = listeners.forEach { it() }

    private fun b64e(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)

    private fun b64d(s: String): ByteArray = Base64.decode(s, Base64.NO_WRAP)
}
