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
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.text.InputFilter
import android.text.SpannableStringBuilder
import android.text.TextUtils
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.zavier.tayori.core.DeviceId
import com.zavier.tayori.core.MessageRules
import com.zavier.tayori.core.ReceivedLetter
import com.zavier.tayori.core.SafetyStatus
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 画面の設計方針:
 * - 主役は「大切な人の安否」ひとつ。災害時に使う人が知りたいのは「誰が無事か・誰がわからないか」だけなので、
 *   メッセージの一覧ではなく「人ごとの最新の状態」を見せる。
 * - 見る(誰が危ないか) → 比べる(状態と何分前か) → 動く(自分の無事を伝える) の順に、上から下へ並べる。
 * - 色は役割ごとに1つ: 操作=墨色、状態=緑/青/赤/灰、注意(確かめが必要なこと)=黄土色。赤は「要救助」にしか使わない。
 * - 中継の仕組み(スキャン等)は脇役。問題があるときだけ注意の帯で知らせる。
 *
 * 画面部品はXMLやライブラリを使わずコードで組み立てている(依存を増やさず、機種差の要因を減らすため)。
 */
class MainActivity : Activity() {

    companion object {
        private const val REQ_PERMISSIONS = 1
        private const val REQ_EXPORT_CSV = 2
        private const val REFRESH_MS = 2_000L

        // 色の役割(ここ以外で色を決めない)
        private val BG = Color.parseColor("#F5F5F2")
        private val INK = Color.parseColor("#1A1D1B") // 文字・操作(押せるもの)
        private val SUB = Color.parseColor("#5F6661")
        private val FAINT = Color.parseColor("#9AA09C")
        private val RULE = Color.parseColor("#E2E3DF")
        private val OK = Color.parseColor("#1D7F4E") // 状態: 無事
        private val MOVE = Color.parseColor("#2457B8") // 状態: 移動中
        private val SOS = Color.parseColor("#C0322A") // 状態: 要救助(他の意味には使わない)
        private val UNKNOWN = Color.parseColor("#8A8F8B") // 状態: まだわからない
        private val WARN = Color.parseColor("#8A6A10") // 注意: 確かめが必要なこと
        private val WARN_BG = Color.parseColor("#F6EED6")
    }

    private enum class Tab(val label: String) { SAFETY("安否"), CONTACTS("連絡先"), RECORD("記録") }

    private val ui = Handler(Looper.getMainLooper())
    private val clock = SimpleDateFormat("HH:mm", Locale.JAPAN)
    private lateinit var regular: Typeface
    private lateinit var bold: Typeface

    private var tab = Tab.SAFETY
    private lateinit var headerStatus: TextView
    private lateinit var pages: Map<Tab, LinearLayout>
    private lateinit var scrolls: Map<Tab, ScrollView>
    private lateinit var tabViews: Map<Tab, TextView>
    private lateinit var actionBar: LinearLayout
    private lateinit var actionRule: View
    private var qrFor: String? = null
    private var qrBitmap: Bitmap? = null

    /** 入力中の欄を再描画で消さないよう、連絡先と記録のタブは入力がないときだけ作り直す。 */
    private var lastRenderedTab: Tab? = null

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
        regular = runCatching { Typeface.createFromAsset(assets, "fonts/BIZUDPGothic-Regular.ttf") }.getOrDefault(Typeface.DEFAULT)
        bold = runCatching { Typeface.createFromAsset(assets, "fonts/BIZUDPGothic-Bold.ttf") }.getOrDefault(Typeface.DEFAULT_BOLD)
        @Suppress("DEPRECATION")
        window.statusBarColor = BG
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        setContentView(buildShell())
        render(force = true)
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

    // ================================================================ 骨組み

    private fun buildShell(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(BG)
        }
        // 見出し: ロゴ(ブランド色は使わず文字だけ)と、中継の状態を1行で
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(22), dp(14), dp(22), dp(6))
        }
        header.addView(text("たより", 15f, INK, bold).apply { letterSpacing = 0.08f })
        header.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        headerStatus = text("", 12.5f, SUB)
        header.addView(headerStatus)
        root.addView(header)

        val content = FrameLayout(this)
        val pageMap = mutableMapOf<Tab, LinearLayout>()
        val scrollMap = mutableMapOf<Tab, ScrollView>()
        Tab.entries.forEach { t ->
            val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            val sv = ScrollView(this).apply { addView(page) }
            content.addView(sv, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            pageMap[t] = page
            scrollMap[t] = sv
        }
        pages = pageMap
        scrolls = scrollMap
        root.addView(content, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        actionRule = rule()
        root.addView(actionRule)
        actionBar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(12), dp(18), dp(12))
        }
        root.addView(actionBar)

        val tabs = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val tabMap = mutableMapOf<Tab, TextView>()
        Tab.entries.forEach { t ->
            val tv = text(t.label, 13f, FAINT).apply {
                gravity = Gravity.CENTER
                setPadding(0, dp(16), 0, dp(16))
                setOnClickListener { tab = t; render(force = true) }
            }
            tabs.addView(tv, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            tabMap[t] = tv
        }
        tabViews = tabMap
        root.addView(rule())
        root.addView(tabs)
        return root
    }

    private fun render(force: Boolean = false) {
        scrolls.forEach { (t, sv) -> sv.visibility = if (t == tab) View.VISIBLE else View.GONE }
        tabViews.forEach { (t, v) ->
            v.setTextColor(if (t == tab) INK else FAINT)
            v.typeface = if (t == tab) bold else regular
        }
        renderHeader()
        // 安否タブは2秒ごとに更新(何分前の表示のため)。入力欄のあるタブは、切り替えたときと操作したときだけ作り直す
        val fresh = force || lastRenderedTab != tab
        val editing = currentFocus is EditText
        when (tab) {
            Tab.SAFETY -> renderSafety()
            Tab.CONTACTS -> if (fresh) renderContacts() // 一覧は操作したときにしか変わらない
            Tab.RECORD -> if (fresh || !editing) renderRecord()
        }
        lastRenderedTab = tab
        renderActionBar()
    }

    private fun renderHeader() {
        val snap = TayoriRuntime.engine?.snapshot()
        val p = problem()
        headerStatus.text = when {
            !TayoriRuntime.running -> "● 停止中"
            p != null -> "● 確かめが必要です"
            else -> "● 中継中・${snap?.relaying?.size ?: 0}通あずかり中"
        }
        headerStatus.setTextColor(
            when {
                !TayoriRuntime.running -> FAINT
                p != null -> WARN
                else -> OK
            },
        )
    }

    /** 注意を出すべき問題(なければ null)。中継が動いていて、仕組みのどれかが使えないとき。 */
    private fun problem(): Pair<String, String>? {
        if (!TayoriRuntime.running) return null
        locationWarning()?.let { return "位置情報がオフです" to it }
        val ble = TayoriRuntime.transport?.status ?: return null
        if (ble.problems.any { it.contains("広告") }) {
            return "この機種は「知らせる」ができません" to
                "まわりから見つけてもらえないため、安否を受け取れません。送ることと、運ぶことはできます。"
        }
        ble.problems.firstOrNull()?.let { return "Bluetoothの調子がよくありません" to it }
        if (TayoriRuntime.log.isFull) return "記録がいっぱいです" to "「記録」から書き出して消去してください。"
        return null
    }

    // ================================================================ 安否(主役)

    /** 1人分の最新の安否。 */
    private data class PersonRow(
        val id: String,
        val name: String,
        val latest: ReceivedLetter?,
        val count: Int,
        val registered: Boolean,
    )

    private fun people(): List<PersonRow> {
        val inbox = TayoriRuntime.engine?.snapshot()?.inbox.orEmpty()
        val byOrigin = inbox.groupBy { it.letter.originId }
        val contacts = TayoriRuntime.contacts()
        val rows = contacts.map { c ->
            val got = byOrigin[c.id].orEmpty()
            PersonRow(c.id, TayoriRuntime.displayName(c.id), got.maxByOrNull { it.letter.createdAt }, got.size, true)
        }
        // 連絡先にない人から届いたもの(本人か確かめられない)も、捨てずに最後に並べる
        val strangers = byOrigin.filterKeys { id -> contacts.none { it.id == id } }.map { (id, got) ->
            PersonRow(id, id, got.maxByOrNull { it.letter.createdAt }, got.size, false)
        }
        // 並び順: 要救助 → まだわからない → 移動中 → 無事。同じ状態なら新しい順
        fun rank(r: PersonRow) = when (r.latest?.letter?.status) {
            SafetyStatus.NEED_RESCUE -> 0
            null -> 1
            SafetyStatus.MOVING -> 2
            SafetyStatus.SAFE -> 3
        }
        return rows.sortedWith(compareBy<PersonRow>({ rank(it) }, { -(it.latest?.letter?.createdAt ?: 0L) })) +
            strangers.sortedByDescending { it.latest?.letter?.createdAt ?: 0L }
    }

    private fun renderSafety() {
        val page = pages.getValue(Tab.SAFETY)
        page.removeAllViews()
        problem()?.let { (title, body) -> page.addView(warnBand(title, body)) }

        val rows = people()
        val registered = rows.filter { it.registered }
        if (registered.isEmpty()) {
            renderFirstRun(page)
            return
        }
        page.addView(text("大切な人の安否", 13f, SUB).apply { setPadding(dp(22), dp(16), dp(22), dp(4)) })
        page.addView(headline(registered).apply { setPadding(dp(22), 0, dp(22), dp(14)) })
        page.addView(rule())
        rows.forEach { page.addView(personRow(it)); page.addView(rule()) }
        page.addView(View(this), LinearLayout.LayoutParams(1, dp(24)))
    }

    /** 一番大きな一文。数を数えて、いちばん大事な事実を先に言う。 */
    private fun headline(rows: List<PersonRow>): TextView {
        val n = rows.size
        val sos = rows.count { it.latest?.letter?.status == SafetyStatus.NEED_RESCUE }
        val unknown = rows.count { it.latest == null }
        val sb = SpannableStringBuilder()
        when {
            sos > 0 -> {
                if (n > 1) sb.append("${n}人中 ")
                val start = sb.length
                sb.append("${sos}人が要救助")
                sb.setSpan(ForegroundColorSpan(SOS), start, sb.length, 0)
                if (unknown > 0) sb.append("、\n${unknown}人はまだわかりません")
            }
            unknown == n -> sb.append(if (n == 1) "まだわかりません" else "${n}人とも\nまだわかりません")
            unknown > 0 -> sb.append("${n}人中 ${unknown}人は\nまだわかりません")
            else -> sb.append(if (n == 1) "届いています" else "${n}人全員から\n届いています")
        }
        return text("", 26f, INK, bold).apply {
            setLineSpacing(0f, 1.2f)
            text = sb
        }
    }

    private fun personRow(r: PersonRow): View {
        val received = r.latest
        val l = received?.letter
        val now = System.currentTimeMillis()
        val stale = l != null && now - l.createdAt > 24 * 3600_000L
        val color = when {
            l == null || stale -> UNKNOWN
            l.status == SafetyStatus.NEED_RESCUE -> SOS
            l.status == SafetyStatus.MOVING -> MOVE
            else -> OK
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(dp(22), dp(14), dp(22), dp(14))
        }
        row.addView(
            View(this).apply { background = rounded(color, dp(3)) },
            LinearLayout.LayoutParams(dp(6), ViewGroup.LayoutParams.MATCH_PARENT).apply { rightMargin = dp(14) },
        )
        val mid = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        mid.addView(text(r.name, 17f, INK, bold).apply { maxLines = 1; ellipsize = TextUtils.TruncateAt.END })
        val stateText = when {
            l == null -> "まだ届いていない"
            stale -> "前回: ${l.status.label}"
            else -> l.status.label
        }
        mid.addView(text(stateText, 14f, color, bold))
        if (l != null && l.text.isNotEmpty()) mid.addView(text(l.text, 13.5f, INK).apply { setPadding(0, dp(3), 0, 0) })
        if (received != null) {
            val via = if (received.hop <= 1) "直接届いた" else "${received.hop - 1}回中継されて届いた"
            val many = if (r.count > 1) "・${r.count}通" else ""
            mid.addView(text(via + many, 11.5f, FAINT).apply { setPadding(0, dp(3), 0, 0) })
        }
        if (!r.registered) {
            mid.addView(text("⚠ 連絡先にない人から。本人か確かめられません", 11.5f, WARN).apply { setPadding(0, dp(3), 0, 0) })
        } else if (TayoriRuntime.contactName(r.id) == null) {
            mid.addView(text("名前が未設定です(連絡先で付けられます)", 11.5f, FAINT).apply { setPadding(0, dp(3), 0, 0) })
        }
        row.addView(mid, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        val ago = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.END }
        ago.addView(text(if (l == null) "—" else agoText(now - l.createdAt), 13f, SUB).apply { gravity = Gravity.END })
        if (stale) ago.addView(text("古い情報", 11f, FAINT).apply { gravity = Gravity.END })
        row.addView(ago)
        return row
    }

    private fun renderFirstRun(page: LinearLayout) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(30), dp(36), dp(30), dp(24))
        }
        box.addView(text("まず、家族と\nコードを交換しましょう", 22f, INK, bold).apply { setLineSpacing(0f, 1.2f) })
        box.addView(
            text("災害が起きてからでは交換できません。ふだんのうちに、安否を届けたい人と連絡先コードを交換しておきます。", 14f, SUB).apply {
                setLineSpacing(0f, 1.5f)
                setPadding(0, dp(12), 0, dp(18))
            },
        )
        listOf(
            "相手に自分のQRコードを見せる(または連絡先コードを送る)",
            "相手のコードを登録して、名前を付ける",
            "あとは何もしなくて大丈夫。災害時に開けば使えます",
        ).forEachIndexed { i, s ->
            val r = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; setPadding(0, 0, 0, dp(12)) }
            r.addView(
                text("${i + 1}", 12f, INK, bold).apply { gravity = Gravity.CENTER; background = outline(INK, dp(12)) },
                LinearLayout.LayoutParams(dp(24), dp(24)).apply { rightMargin = dp(12) },
            )
            r.addView(text(s, 14f, INK), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            box.addView(r)
        }
        page.addView(box)
    }

    // ================================================================ 下の行動(画面ごとに1つだけ)

    private fun renderActionBar() {
        actionBar.removeAllViews()
        val show = tab == Tab.SAFETY
        actionBar.visibility = if (show) View.VISIBLE else View.GONE
        actionRule.visibility = actionBar.visibility
        if (!show) return
        when {
            TayoriRuntime.contacts().isEmpty() ->
                actionBar.addView(primaryButton("QRコードを交換する", null) { tab = Tab.CONTACTS; render(force = true) })
            !TayoriRuntime.running ->
                actionBar.addView(primaryButton("中継を開始する", "開始すると、安否を送ったり受け取ったりできます") { startRelay() })
            else -> {
                val n = TayoriRuntime.contacts().size
                actionBar.addView(
                    primaryButton("自分は無事と伝える", "${n}人全員へ・近くにスマホが来たら自動で渡します") {
                        broadcast(SafetyStatus.SAFE, "")
                    },
                )
                val alt = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER
                    setPadding(0, dp(6), 0, 0)
                }
                alt.addView(link("要救助を伝える") { compose(SafetyStatus.NEED_RESCUE) })
                alt.addView(View(this), LinearLayout.LayoutParams(dp(28), 1))
                alt.addView(link("移動中を伝える") { compose(SafetyStatus.MOVING) })
                actionBar.addView(alt)
            }
        }
    }

    /** 要救助・移動中は、ひとことを添えられるようにする(無事はワンタップ)。 */
    private fun compose(status: SafetyStatus) {
        val input = EditText(this).apply {
            hint = if (status == SafetyStatus.NEED_RESCUE) "例: 2階にいる。階段がこわれた" else "例: 中央体育館へ向かっています"
            filters = arrayOf(InputFilter.LengthFilter(MessageRules.MAX_TEXT_LENGTH * 2))
            typeface = regular
        }
        AlertDialog.Builder(this)
            .setTitle("「${status.label}」を伝える")
            .setMessage("${TayoriRuntime.contacts().size}人全員へ送ります。ひとことは${MessageRules.MAX_TEXT_LENGTH}文字以内・省略可。")
            .setView(FrameLayout(this).apply { setPadding(dp(20), dp(8), dp(20), 0); addView(input) })
            .setPositiveButton("伝える") { _, _ -> broadcast(status, input.text.toString().trim()) }
            .setNegativeButton("やめる", null)
            .show()
    }

    private fun broadcast(status: SafetyStatus, text: String) {
        val engine = TayoriRuntime.engine
        if (engine == null || !TayoriRuntime.running) return toast("先に中継を開始してください")
        if (!MessageRules.isValidText(text)) return toast("ひとことは${MessageRules.MAX_TEXT_LENGTH}文字以内にしてください")
        val sent = TayoriRuntime.contacts().count { c -> runCatching { engine.sendMessage(c.id, status, text) }.isSuccess }
        toast("「${status.label}」を${sent}人へ送る準備ができました。近くにスマホが来たら自動で渡します")
        render(force = true)
    }

    // ================================================================ 連絡先

    private fun renderContacts() {
        val page = pages.getValue(Tab.CONTACTS)
        page.removeAllViews()
        val pad = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(14), dp(22), dp(24))
        }
        page.addView(pad)

        // 自分のコード(相手に見せる)
        val code = TayoriRuntime.identity().contactCode()
        if (qrFor != code) {
            qrFor = code
            qrBitmap = qrBitmap(code, dp(220))
        }
        pad.addView(text("あなたの連絡先コード", 13f, SUB))
        pad.addView(
            ImageView(this).apply { setImageBitmap(qrBitmap); setPadding(0, dp(8), 0, dp(8)) },
            LinearLayout.LayoutParams(dp(220), dp(236)).apply { gravity = Gravity.CENTER_HORIZONTAL },
        )
        pad.addView(text("端末ID ${TayoriRuntime.deviceId}", 13f, INK, bold).apply { gravity = Gravity.CENTER })
        val share = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER; setPadding(0, dp(4), 0, dp(20)) }
        share.addView(link("コードをコピー") { copyMyCode() })
        share.addView(View(this), LinearLayout.LayoutParams(dp(28), 1))
        share.addView(link("コードを送る") { shareMyCode() })
        pad.addView(share)

        // 相手のコードを登録
        pad.addView(text("相手のコードを登録", 13f, SUB))
        val codeIn = EditText(this).apply { hint = "相手の連絡先コードを貼り付け(TAYORI1:…)"; typeface = regular; textSize = 14f }
        val nameIn = EditText(this).apply {
            hint = "名前(例: 母・おばあちゃん)"
            typeface = regular
            filters = arrayOf(InputFilter.LengthFilter(TayoriRuntime.MAX_NAME_LENGTH))
            setSingleLine()
        }
        pad.addView(codeIn)
        pad.addView(nameIn)
        pad.addView(
            secondaryButton("登録する") {
                val c = TayoriRuntime.addContact(codeIn.text.toString())
                if (c == null) {
                    toast("コードを読み取れません。TAYORI1: から始まる全体を貼り付けてください")
                } else {
                    TayoriRuntime.setContactName(c.id, nameIn.text.toString())
                    toast("「${TayoriRuntime.displayName(c.id)}」を登録しました")
                    currentFocus?.clearFocus()
                    render(force = true)
                }
            },
        )

        // 登録済みの一覧
        val list = TayoriRuntime.contacts()
        pad.addView(text("登録済み(${list.size}人)", 13f, SUB).apply { setPadding(0, dp(24), 0, dp(4)) })
        if (list.isEmpty()) pad.addView(text("まだいません", 14f, FAINT))
        list.forEach { c ->
            pad.addView(rule())
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, dp(12), 0, dp(12))
            }
            val names = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            names.addView(text(TayoriRuntime.displayName(c.id), 16f, INK, bold).apply { maxLines = 1; ellipsize = TextUtils.TruncateAt.END })
            names.addView(text("端末ID ${c.id}", 11.5f, FAINT))
            row.addView(names, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            row.addView(link("名前") { rename(c.id) })
            row.addView(View(this), LinearLayout.LayoutParams(dp(18), 1))
            row.addView(link("削除") { confirmRemove(c.id) })
            pad.addView(row)
        }
    }

    private fun rename(id: String) {
        val input = EditText(this).apply {
            setText(TayoriRuntime.contactName(id) ?: "")
            filters = arrayOf(InputFilter.LengthFilter(TayoriRuntime.MAX_NAME_LENGTH))
            setSingleLine()
            typeface = regular
        }
        AlertDialog.Builder(this)
            .setTitle("名前を付ける(端末ID $id)")
            .setView(FrameLayout(this).apply { setPadding(dp(20), dp(8), dp(20), 0); addView(input) })
            .setPositiveButton("保存") { _, _ -> TayoriRuntime.setContactName(id, input.text.toString()); render(force = true) }
            .setNegativeButton("やめる", null)
            .show()
    }

    private fun confirmRemove(id: String) {
        AlertDialog.Builder(this)
            .setTitle("「${TayoriRuntime.displayName(id)}」を削除しますか？")
            .setMessage("削除すると、この人には送れなくなり、届いた安否も本人か確かめられなくなります。")
            .setPositiveButton("削除") { _, _ -> TayoriRuntime.removeContact(id); render(force = true) }
            .setNegativeButton("やめる", null)
            .show()
    }

    // ================================================================ 記録(実験と設定)

    private fun renderRecord() {
        val page = pages.getValue(Tab.RECORD)
        page.removeAllViews()
        val pad = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(22), dp(14), dp(22), dp(24))
        }
        page.addView(pad)
        val running = TayoriRuntime.running
        val snap = TayoriRuntime.engine?.snapshot()
        val ble = TayoriRuntime.transport?.status

        pad.addView(text("中継", 13f, SUB))
        pad.addView(secondaryButton(if (running) "中継を停止する" else "中継を開始する") { if (running) TayoriService.stop(this) else startRelay() })
        if (running && ble != null) {
            pad.addView(kv("探す(スキャン)", mark(ble.scanning)))
            pad.addView(kv("知らせる(広告)", mark(ble.advertising)))
            pad.addView(kv("受け取る(受信窓口)", mark(ble.gattServer)))
            ble.problems.forEach { pad.addView(text("⚠ $it", 12f, WARN)) }
        }
        if (snap != null) {
            pad.addView(kv("近くの端末", "${snap.nearbyPeers.size}台"))
            pad.addView(kv("接触(累計)", "${snap.contactCountTotal}回"))
            pad.addView(kv("渡せた数(累計)", "${snap.sendCountTotal}回"))
            pad.addView(kv("あずかり中", "${snap.relaying.size}通"))
        }

        pad.addView(text("送った安否", 13f, SUB).apply { setPadding(0, dp(22), 0, dp(4)) })
        val sent = snap?.sentByMe.orEmpty().sortedByDescending { it.letter.createdAt }.take(20)
        if (sent.isEmpty()) pad.addView(text("まだありません", 14f, FAINT))
        sent.forEach { s ->
            pad.addView(rule())
            val passed = if (s.sentTo.isEmpty()) "まだ誰にも渡していない" else "${s.sentTo.size}台に渡した"
            pad.addView(
                text("${TayoriRuntime.displayName(s.letter.destId)}へ「${s.letter.status.label}」 ${clock.format(Date(s.letter.createdAt))}", 14f, INK)
                    .apply { setPadding(0, dp(8), 0, 0) },
            )
            pad.addView(text(passed + if (s.letter.text.isNotEmpty()) "・${s.letter.text}" else "", 12f, FAINT).apply { setPadding(0, 0, 0, dp(8)) })
        }

        pad.addView(text("この端末", 13f, SUB).apply { setPadding(0, dp(22), 0, dp(4)) })
        val idIn = EditText(this).apply {
            setText(TayoriRuntime.deviceId)
            filters = arrayOf(InputFilter.LengthFilter(DeviceId.MAX_LENGTH))
            setSingleLine()
            typeface = regular
            isEnabled = !running
        }
        pad.addView(idIn)
        pad.addView(
            secondaryButton(if (running) "端末IDの変更は中継を止めてから" else "端末IDを保存") {
                if (running) return@secondaryButton
                val id = idIn.text.toString().trim()
                if (!DeviceId.isValid(id)) return@secondaryButton toast("端末IDは英数字・-・_ の1〜${DeviceId.MAX_LENGTH}文字にしてください")
                TayoriRuntime.deviceId = id
                toast("端末IDを「$id」にしました。連絡先コードも変わるので、相手に送り直してください")
                currentFocus?.clearFocus()
                render(force = true)
            },
        )
        pad.addView(secondaryButton("電池の最適化を解除する(推奨)") { openBatterySettings() })

        pad.addView(text("実験ログ", 13f, SUB).apply { setPadding(0, dp(22), 0, dp(4)) })
        pad.addView(kv("記録済み", "${TayoriRuntime.log.lineCount}行"))
        if (TayoriRuntime.log.isFull) pad.addView(text("⚠ 上限(20MB)に達したため記録が止まっています", 12f, WARN))
        pad.addView(secondaryButton("CSVで書き出す") { exportCsv() })
        pad.addView(secondaryButton("ログを消去する") { confirmClearLog() })
    }

    private fun mark(ok: Boolean) = if (ok) "○" else "×"

    // ================================================================ 中継の開始と権限

    private fun startRelay() {
        val missing = requiredPermissions().filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) {
            requestPermissions(missing.toTypedArray(), REQ_PERMISSIONS)
            return
        }
        val adapter = getSystemService(BluetoothManager::class.java)?.adapter ?: return toast("この端末はBluetoothに対応していません")
        if (!adapter.isEnabled) {
            @Suppress("DEPRECATION")
            startActivityForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), 0)
            return toast("Bluetoothをオンにしてから、もう一度押してください")
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_PERMISSIONS) return
        val denied = permissions.filterIndexed { i, p ->
            grantResults.getOrNull(i) != PackageManager.PERMISSION_GRANTED && p != Manifest.permission.POST_NOTIFICATIONS
        }
        if (denied.isEmpty()) startRelay() else toast("Bluetoothの権限がないと動作できません。設定アプリから許可してください")
    }

    /** Android 11以前は、端末の「位置情報」スイッチがオフだとスキャン結果が0件になる。 */
    private fun locationWarning(): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S || Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return null
        val lm = getSystemService(LocationManager::class.java) ?: return null
        return if (lm.isLocationEnabled) null else "この機種では、位置情報をオンにしないと周りのスマホが見つかりません。"
    }

    /** 【機種差】Galaxy などは独自の省電力機能で、裏で動くアプリを止めることがある。 */
    private fun openBatterySettings() {
        val pm = getSystemService(PowerManager::class.java)
        if (pm?.isIgnoringBatteryOptimizations(packageName) == true) {
            return toast("解除済みです。Galaxyは「設定 > バッテリー > バックグラウンドでの使用制限」も確認してください")
        }
        @Suppress("BatteryLife")
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
        runCatching { startActivity(intent) }.onFailure { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
    }

    // ================================================================ コードの共有・記録の書き出し

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

    /** 文字列をQRコードの画像にする(相手のカメラで読み取ってもらう)。 */
    private fun qrBitmap(text: String, size: Int): Bitmap {
        val m = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size)
        val px = IntArray(m.width * m.height) { i -> if (m.get(i % m.width, i / m.width)) INK else BG }
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
            contentResolver.openOutputStream(uri)?.use { TayoriRuntime.log.exportTo(it) } ?: error("保存先を開けません")
        }.onSuccess { toast("CSVを書き出しました") }
            .onFailure { toast("書き出しに失敗: ${it.message}") }
    }

    private fun confirmClearLog() {
        AlertDialog.Builder(this)
            .setTitle("ログを消去しますか？")
            .setMessage("次の試行を始める前に使います。先にCSVで書き出したか確認してください。元に戻せません。")
            .setPositiveButton("消去") { _, _ -> TayoriRuntime.log.clear(); render(force = true) }
            .setNegativeButton("やめる", null)
            .show()
    }

    // ================================================================ 部品

    private fun text(s: String, sp: Float, color: Int, face: Typeface = regular) = TextView(this).apply {
        text = s
        textSize = sp
        setTextColor(color)
        typeface = face
    }

    private fun rule() = View(this).apply {
        setBackgroundColor(RULE)
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1))
    }

    private fun kv(k: String, v: String) = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        setPadding(0, dp(6), 0, dp(6))
        addView(text(k, 14f, SUB), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        addView(text(v, 14f, INK, bold))
    }

    /** 画面で一番重い行動。墨色の塗り(操作色)。 */
    private fun primaryButton(label: String, sub: String?, onClick: () -> Unit) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        background = rounded(INK, dp(14))
        setPadding(dp(12), dp(15), dp(12), dp(15))
        addView(text(label, 18f, Color.WHITE, bold).apply { gravity = Gravity.CENTER })
        if (sub != null) addView(text(sub, 11.5f, Color.parseColor("#C8CCC9")).apply { gravity = Gravity.CENTER; setPadding(0, dp(3), 0, 0) })
        setOnClickListener { onClick() }
    }

    /** 二番目の行動。線だけ(同じ操作色)。 */
    private fun secondaryButton(label: String, onClick: () -> Unit) = text(label, 15f, INK, bold).apply {
        gravity = Gravity.CENTER
        background = outline(INK, dp(12))
        setPadding(dp(12), dp(13), dp(12), dp(13))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) }
        setOnClickListener { onClick() }
    }

    /** 三番目の行動。下線の文字だけ。 */
    private fun link(label: String, onClick: () -> Unit) = text(label, 14f, INK, bold).apply {
        paintFlags = paintFlags or Paint.UNDERLINE_TEXT_FLAG
        setPadding(dp(4), dp(8), dp(4), dp(8))
        setOnClickListener { onClick() }
    }

    private fun warnBand(title: String, body: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = rounded(WARN_BG, dp(10))
        setPadding(dp(12), dp(10), dp(12), dp(10))
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            setMargins(dp(22), dp(10), dp(22), 0)
        }
        addView(text(title, 13.5f, WARN, bold))
        addView(text(body, 12.5f, WARN).apply { setLineSpacing(0f, 1.4f) })
    }

    private fun rounded(color: Int, radius: Int) = GradientDrawable().apply { setColor(color); cornerRadius = radius.toFloat() }

    private fun outline(color: Int, radius: Int) = GradientDrawable().apply {
        setColor(Color.TRANSPARENT)
        setStroke(dp(1.5f), color)
        cornerRadius = radius.toFloat()
    }

    private fun agoText(ms: Long): String {
        val m = ms / 60_000
        return when {
            m < 1 -> "いま"
            m < 60 -> "${m}分前"
            m < 24 * 60 -> "${m / 60}時間前"
            else -> "${m / (24 * 60)}日前"
        }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun dp(v: Float) = (v * resources.displayMetrics.density).toInt()
}
