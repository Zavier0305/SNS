package com.zavier.tayori.app

import android.content.Context
import android.util.Base64
import com.zavier.tayori.core.Contact
import com.zavier.tayori.core.ContactBook
import com.zavier.tayori.core.ContactCode
import com.zavier.tayori.core.DeviceId
import com.zavier.tayori.core.Identity
import com.zavier.tayori.core.RelayEngine
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
        prefs.edit().putStringSet(KEY_CONTACTS, rest).apply()
        notifyChanged()
    }

    // ---------------------------------------------------------------- 開始・停止

    /** TayoriService から呼ぶ。 */
    @Synchronized
    fun start() {
        if (running) return
        val id = deviceId
        // 端末IDが同じなら前回のエンジンを使い回す(停止→再開しても受信済みIDを忘れず、重複排除が続くように)
        val e = engine?.takeIf { it.selfId == id } ?: run {
            val t = BleTransport(appContext)
            t.onStatusChanged = ::notifyChanged
            transport = t
            RelayEngine(identity(), book, t, log).also { it.onChanged = ::notifyChanged }
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

    private fun b64e(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)

    private fun b64d(s: String): ByteArray = Base64.decode(s, Base64.NO_WRAP)
}
