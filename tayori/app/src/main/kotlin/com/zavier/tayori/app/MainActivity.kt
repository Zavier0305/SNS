package com.zavier.tayori.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.text.Editable
import android.text.InputFilter
import android.text.TextWatcher
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.zavier.tayori.core.DeviceId
import com.zavier.tayori.core.MessageRules
import com.zavier.tayori.core.SafetyStatus
import com.zavier.tayori.core.UnknownRecipientException
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 実験用の1画面アプリ。見た目より「実験中に状態が一目でわかること」を優先している。
 * 画面部品はXMLを使わずコードで組み立てている(ライブラリ依存を減らし、機種差の要因を増やさないため)。
 */
class MainActivity : Activity() {

    companion object {
        private const val REQ_PERMISSIONS = 1
        private const val REQ_EXPORT_CSV = 2
        private const val REFRESH_MS = 2_000L
    }

    private val ui = Handler(Looper.getMainLooper())
    private val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.JAPAN)

    private lateinit var deviceIdInput: EditText
    private lateinit var saveIdButton: Button
    private lateinit var startButton: Button
    private lateinit var statusText: TextView
    private lateinit var destInput: EditText
    private lateinit var statusGroup: RadioGroup
    private lateinit var textInput: EditText
    private lateinit var counterText: TextView
    private lateinit var inboxText: TextView
    private lateinit var sentText: TextView
    private lateinit var logText: TextView
    private lateinit var myCodeText: TextView
    private lateinit var myCodeQr: ImageView
    private lateinit var contactInput: EditText
    private lateinit var contactsText: TextView
    private var qrFor: String? = null

    private val onRuntimeChanged: () -> Unit = { ui.post { render() } }
    private val periodicRefresh = object : Runnable {
        override fun run() {
            render()
            ui.postDelayed(this, REFRESH_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        TayoriRuntime.init(this)
        setContentView(buildLayout())
        deviceIdInput.setText(TayoriRuntime.deviceId)
    }

    override fun onStart() {
        super.onStart()
        TayoriRuntime.addListener(onRuntimeChanged)
        ui.post(periodicRefresh)
    }

    override fun onStop() {
        TayoriRuntime.removeListener(onRuntimeChanged)
        ui.removeCallbacks(periodicRefresh)
        super.onStop()
    }

    // ---------------------------------------------------------------- 画面の組み立て

    private fun buildLayout(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(32))
        }
        fun section(title: String) = root.addView(
            TextView(this).apply {
                text = title
                textSize = 16f
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, dp(20), 0, dp(6))
            },
        )
        fun row(vararg views: View) = root.addView(
            LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                views.forEach { addView(it, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)) }
            },
        )

        root.addView(TextView(this).apply { text = "たより(実験版 フェーズ1)"; textSize = 22f })

        section("① この端末")
        deviceIdInput = EditText(this).apply {
            hint = "端末ID(例: A)"
            filters = arrayOf(InputFilter.LengthFilter(DeviceId.MAX_LENGTH))
            setSingleLine()
        }
        saveIdButton = Button(this).apply { text = "IDを保存"; setOnClickListener { saveDeviceId() } }
        row(deviceIdInput, saveIdButton)
        startButton = Button(this).apply { setOnClickListener { toggleRunning() } }
        root.addView(startButton)
        root.addView(
            Button(this).apply { text = "電池の最適化を解除(推奨)"; setOnClickListener { openBatterySettings() } },
        )
        statusText = TextView(this).apply { setTextIsSelectable(true) }
        root.addView(statusText)

        section("② 連絡先(送る前に、相手とコードを交換)")
        root.addView(
            TextView(this).apply {
                text = "メッセージは宛先の人だけが読めるよう暗号化されます。そのため、送る相手とあらかじめ" +
                    "「連絡先コード」を交換しておきます(QRコードをカメラで読み取るか、LINEなどで送り合う)。"
                textSize = 13f
            },
        )
        myCodeQr = ImageView(this).apply { adjustViewBounds = true }
        root.addView(myCodeQr, LinearLayout.LayoutParams(dp(200), dp(200)))
        myCodeText = TextView(this).apply { setTextIsSelectable(true); textSize = 11f }
        root.addView(myCodeText)
        row(
            Button(this).apply { text = "コードをコピー"; setOnClickListener { copyMyCode() } },
            Button(this).apply { text = "コードを送る"; setOnClickListener { shareMyCode() } },
        )
        contactInput = EditText(this).apply { hint = "相手の連絡先コードを貼り付け(TAYORI1:…)" }
        root.addView(contactInput)
        root.addView(Button(this).apply { text = "連絡先に追加"; setOnClickListener { addContact() } })
        contactsText = TextView(this)
        root.addView(contactsText)

        section("③ メッセージを送る")
        destInput = EditText(this).apply {
            hint = "宛先の端末ID"
            filters = arrayOf(InputFilter.LengthFilter(DeviceId.MAX_LENGTH))
            setSingleLine()
        }
        root.addView(destInput)
        statusGroup = RadioGroup(this).apply { orientation = RadioGroup.HORIZONTAL }
        SafetyStatus.entries.forEach { s ->
            statusGroup.addView(RadioButton(this).apply { id = View.generateViewId(); text = s.label; tag = s })
        }
        statusGroup.check(statusGroup.getChildAt(0).id)
        root.addView(statusGroup)
        textInput = EditText(this).apply {
            hint = "ひとこと(${MessageRules.MAX_TEXT_LENGTH}文字以内・省略可)"
            // 絵文字は内部的に2文字分になるので余裕を持たせ、正確な文字数チェックは送信時に行う
            filters = arrayOf(InputFilter.LengthFilter(MessageRules.MAX_TEXT_LENGTH * 2))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
                override fun afterTextChanged(s: Editable?) = renderCounter()
            })
        }
        root.addView(textInput)
        counterText = TextView(this)
        root.addView(counterText)
        root.addView(Button(this).apply { text = "送信"; setOnClickListener { sendMessage() } })

        section("④ 自分宛てに届いたメッセージ")
        inboxText = TextView(this).apply { setTextIsSelectable(true) }
        root.addView(inboxText)

        section("⑤ 自分が送ったメッセージ")
        sentText = TextView(this).apply { setTextIsSelectable(true) }
        root.addView(sentText)

        section("⑥ 実験ログ")
        logText = TextView(this)
        root.addView(logText)
        row(
            Button(this).apply { text = "CSVで書き出し"; setOnClickListener { exportCsv() } },
            Button(this).apply { text = "ログを消去"; setOnClickListener { confirmClearLog() } },
        )

        renderCounter()
        render()
        return ScrollView(this).apply { addView(root) }
    }

    private fun render() {
        val running = TayoriRuntime.running
        startButton.text = if (running) "中継を停止" else "中継を開始"
        deviceIdInput.isEnabled = !running
        saveIdButton.isEnabled = !running

        val snap = TayoriRuntime.engine?.snapshot()
        val ble = TayoriRuntime.transport?.status
        statusText.text = buildString {
            appendLine("状態: ${if (running) "動作中" else "停止中"}  /  端末ID: ${TayoriRuntime.deviceId}")
            if (running && ble != null) {
                appendLine("スキャン: ${mark(ble.scanning)}  広告: ${mark(ble.advertising)}  受信窓口: ${mark(ble.gattServer)}")
            }
            if (snap != null) {
                appendLine("近くの端末: ${snap.nearbyPeers.ifEmpty { listOf("なし") }.joinToString(", ")}")
                appendLine("累計 接触 ${snap.contactCountTotal} 回 / 送信成功 ${snap.sendCountTotal} 回 / 中継待ち ${snap.relaying.size} 件")
            }
            locationWarning()?.let { appendLine("⚠ $it") }
            ble?.problems?.forEach { appendLine("⚠ $it") }
        }.trimEnd()

        inboxText.text = snap?.inbox?.reversed()?.joinToString("\n\n") { r ->
            val m = r.letter
            val who = if (r.verified) "${m.originId}(本人確認済み)" else "${m.originId}(⚠ 未登録の送り主・本人か確認できません)"
            "【${m.status.label}】${m.text.ifEmpty { "(本文なし)" }}\n" +
                "  from $who / ${r.hop}ホップ / 送信 ${timeFormat.format(Date(m.createdAt))}"
        }?.ifEmpty { null } ?: "まだありません"

        sentText.text = snap?.sentByMe?.reversed()?.joinToString("\n\n") { o ->
            "→ ${o.letter.destId}【${o.letter.status.label}】${o.letter.text}\n" +
                "  ${timeFormat.format(Date(o.letter.createdAt))} / 渡した端末の数: " +
                (if (o.sentTo.isEmpty()) "まだ誰にも" else "${o.sentTo.size}台")
        }?.ifEmpty { null } ?: "まだありません"

        logText.text = "記録済み: ${TayoriRuntime.log.lineCount} 行" +
            if (TayoriRuntime.log.isFull) "\n⚠ 記録が上限(20MB)に達したため止まっています。書き出してから消去してください" else ""

        val code = TayoriRuntime.identity().contactCode()
        myCodeText.text = "あなたの連絡先コード(端末ID ${TayoriRuntime.deviceId}):\n$code"
        if (qrFor != code) {
            qrFor = code
            myCodeQr.setImageBitmap(qrBitmap(code, dp(200)))
        }
        val list = TayoriRuntime.contacts()
        contactsText.text = if (list.isEmpty()) "登録済みの連絡先: まだありません" else "登録済みの連絡先: " + list.joinToString(", ") { it.id }
    }

    private fun mark(ok: Boolean) = if (ok) "○" else "×"

    private fun renderCounter() {
        val n = MessageRules.textLength(textInput.text.toString())
        counterText.text = "$n / ${MessageRules.MAX_TEXT_LENGTH} 文字"
    }

    // ---------------------------------------------------------------- 操作

    private fun saveDeviceId() {
        val id = deviceIdInput.text.toString().trim()
        if (!DeviceId.isValid(id)) {
            toast("端末IDは英数字・-・_ の1〜${DeviceId.MAX_LENGTH}文字にしてください")
            return
        }
        TayoriRuntime.deviceId = id
        toast("端末IDを「$id」にしました")
        render()
    }

    private fun toggleRunning() {
        if (TayoriRuntime.running) {
            TayoriService.stop(this)
            return
        }
        val missing = requiredPermissions().filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), REQ_PERMISSIONS)
            return
        }
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter
        if (adapter == null) {
            toast("この端末はBluetoothに対応していません")
            return
        }
        if (!adapter.isEnabled) {
            @Suppress("DEPRECATION")
            startActivityForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), 0)
            toast("Bluetoothをオンにしてから、もう一度「中継を開始」を押してください")
            return
        }
        TayoriService.start(this)
    }

    /** Androidのバージョンによって必要な権限が違う。 */
    private fun requiredPermissions(): List<String> = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            add(Manifest.permission.BLUETOOTH_SCAN)
            add(Manifest.permission.BLUETOOTH_CONNECT)
            add(Manifest.permission.BLUETOOTH_ADVERTISE)
        } else {
            // Android 11以前は、BLEスキャンに「位置情報」権限が必要(BLEで位置が推定できるため)
            add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_PERMISSIONS) return
        val denied = permissions.filterIndexed { i, p ->
            grantResults.getOrNull(i) != PackageManager.PERMISSION_GRANTED &&
                p != Manifest.permission.POST_NOTIFICATIONS // 通知は拒否されても動作はする
        }
        if (denied.isEmpty()) {
            toggleRunning()
        } else {
            toast("Bluetoothの権限がないと動作できません。設定アプリから許可してください")
        }
    }

    /** Android 11以前は、端末の「位置情報」スイッチがオフだとスキャン結果が0件になる。 */
    private fun locationWarning(): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S || Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return null
        val lm = getSystemService(LocationManager::class.java) ?: return null
        return if (lm.isLocationEnabled) null else "位置情報がオフです。この機種ではオンにしないと周りの端末が見つかりません"
    }

    /**
     * 【機種差】Galaxy などは独自の省電力機能で、裏で動くアプリを止めることがある。
     * 実験中に中継が止まらないよう、この画面から最適化を解除してもらう。
     */
    private fun openBatterySettings() {
        val pm = getSystemService(PowerManager::class.java)
        if (pm?.isIgnoringBatteryOptimizations(packageName) == true) {
            toast("解除済みです。Galaxyは「設定 > バッテリー > バックグラウンドでの使用制限」も確認してください")
            return
        }
        @Suppress("BatteryLife")
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
        runCatching { startActivity(intent) }.onFailure {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }

    private fun sendMessage() {
        val engine = TayoriRuntime.engine
        if (engine == null || !TayoriRuntime.running) {
            toast("先に「中継を開始」を押してください")
            return
        }
        val dest = destInput.text.toString().trim()
        val text = textInput.text.toString().trim()
        val status = statusGroup.findViewById<RadioButton>(statusGroup.checkedRadioButtonId)?.tag as? SafetyStatus
            ?: SafetyStatus.SAFE
        when {
            !DeviceId.isValid(dest) -> toast("宛先の端末IDを入力してください")
            dest == engine.selfId -> toast("自分宛てには送れません")
            !MessageRules.isValidText(text) -> toast("本文は${MessageRules.MAX_TEXT_LENGTH}文字以内にしてください")
            else -> try {
                engine.sendMessage(dest, status, text)
                textInput.setText("")
                toast("送信待ちに入れました。近くの端末に順次渡します")
                render()
            } catch (e: UnknownRecipientException) {
                toast("「$dest」の連絡先コードが未登録です。先に②で相手とコードを交換してください")
            }
        }
    }

    private fun copyMyCode() {
        val cm = getSystemService(ClipboardManager::class.java) ?: return
        cm.setPrimaryClip(ClipData.newPlainText("たより連絡先コード", TayoriRuntime.identity().contactCode()))
        toast("連絡先コードをコピーしました")
    }

    private fun shareMyCode() {
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, TayoriRuntime.identity().contactCode())
        }
        startActivity(Intent.createChooser(send, "連絡先コードを送る"))
    }

    private fun addContact() {
        val code = contactInput.text.toString().trim()
        val c = TayoriRuntime.addContact(code)
        if (c == null) {
            toast("連絡先コードを読み取れません。TAYORI1: から始まる全体を貼り付けてください")
        } else {
            contactInput.setText("")
            toast("「${c.id}」を連絡先に追加しました")
            render()
        }
    }

    /** 文字列をQRコードの画像にする(相手のカメラで読み取ってもらう)。 */
    private fun qrBitmap(text: String, size: Int): Bitmap {
        val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size)
        val px = IntArray(m.width * m.height) { i -> if (m.get(i % m.width, i / m.width)) Color.BLACK else Color.WHITE }
        return Bitmap.createBitmap(px, m.width, m.height, Bitmap.Config.ARGB_8888)
    }

    private fun exportCsv() {
        val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.JAPAN).format(Date())
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "text/csv"
            putExtra(Intent.EXTRA_TITLE, "tayori_${TayoriRuntime.deviceId}_$stamp.csv")
        }
        @Suppress("DEPRECATION")
        startActivityForResult(intent, REQ_EXPORT_CSV)
    }

    @Deprecated("Activity の旧API(ライブラリ非依存にするため使用)")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_EXPORT_CSV || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        runCatching {
            contentResolver.openOutputStream(uri)?.use { TayoriRuntime.log.exportTo(it) }
                ?: error("保存先を開けません")
        }.onSuccess { toast("CSVを書き出しました") }
            .onFailure { toast("書き出しに失敗: ${it.message}") }
    }

    private fun confirmClearLog() {
        AlertDialog.Builder(this)
            .setTitle("ログを消去しますか?")
            .setMessage("次の試行を始める前に使います。先にCSVで書き出したか確認してください。元に戻せません。")
            .setPositiveButton("消去") { _, _ ->
                TayoriRuntime.log.clear()
                render()
            }
            .setNegativeButton("やめる", null)
            .show()
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()
}
