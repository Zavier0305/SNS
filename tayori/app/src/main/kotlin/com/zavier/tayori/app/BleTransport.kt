package com.zavier.tayori.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.ParcelUuid
import android.os.SystemClock
import android.util.Log
import com.zavier.tayori.core.DeviceId
import com.zavier.tayori.core.PacketCodec
import com.zavier.tayori.core.Transport
import com.zavier.tayori.core.TransportListener
import java.io.ByteArrayOutputStream
import java.util.UUID

/**
 * BLE(Bluetooth Low Energy)による Transport の実装。
 *
 * 役割分担(用語の補足):
 * - 広告(Advertise): 「ここに たより端末がいます」と周囲に知らせる電波。端末IDだけを載せる。
 *   メッセージ本文は載せない(広告パケット方式は不採用)。
 * - スキャン(Scan): 周囲の広告を聞き取って、近くの端末を見つける。
 * - GATTサーバー: 他の端末からの「書き込み」を受け付ける窓口。ここでメッセージを受信する。
 * - GATTクライアント: 相手のGATTサーバーに接続して「書き込み」する側。ここでメッセージを送信する。
 * 1台の端末がこの4つを同時に行うことで、送信・中継・受信の3役を兼ねる。
 *
 * スレッド: BLE操作はすべて専用スレッド [handler] 上で順番に行う。
 * Android の BLE は同時に複数の操作をすると失敗しやすいため、送信の接続も1件ずつ処理する。
 *
 * 権限チェックは MainActivity で済ませてから start() する前提なので、ここでは警告を抑制している。
 */
@SuppressLint("MissingPermission")
class BleTransport(
    private val context: Context,
    /**
     * 周りに知らせる一時IDを変える間隔。同じIDを出し続けると、IDを聞き続けた人に居場所を追跡されうるため。
     * 実験で「同じ相手との接触回数」を数えるときは、この間隔ごとに別の相手として数えられる点に注意。
     */
    private val handleRotationMs: Long = 15 * 60 * 1000L,
) : Transport {

    companion object {
        private const val TAG = "TayoriBle"

        /** たより専用のサービスUUID(他アプリと区別するための識別子。適当に作った固有値)。 */
        val SERVICE_UUID: UUID = UUID.fromString("6b1e7a10-3c4d-4e5f-9a1b-7c2d3e4f5a60")

        /** メッセージを書き込む「受信箱」キャラクタリスティック。 */
        val INBOX_UUID: UUID = UUID.fromString("6b1e7a11-3c4d-4e5f-9a1b-7c2d3e4f5a60")

        /** 接続〜書き込みの各段階で、これ以上待っても応答がなければ失敗とみなす時間。 */
        private const val STEP_TIMEOUT_MS = 10_000L

        /** MTU交渉の応答を待つ時間。返ってこない機種があるので、来なくても先へ進む。 */
        private const val MTU_TIMEOUT_MS = 3_000L

        /**
         * 【機種差・OS制限】Android 7以降、30分以上続くスキャンは自動的に低頻度モードに落とされる。
         * そうなる前に自分で止めて再開する。
         */
        private const val SCAN_RESTART_MS = 25 * 60 * 1000L

        /**
         * 【機種差・OS制限】Android 7以降、30秒間に5回を超えてスキャンを開始すると、
         * エラーも出さずにスキャンが黙って無効化される。再開回数をこの範囲に抑える。
         */
        private const val SCAN_START_WINDOW_MS = 30_000L
        private const val SCAN_START_LIMIT = 4

        private const val RETRY_DELAY_MS = 10_000L

        /** 1件のデータの上限。これを超える書き込みは途中で打ち切る(巨大なデータでメモリを使い果たす攻撃への備え)。 */
        private const val MAX_PAYLOAD = PacketCodec.MAX_PACKET_SIZE

        /** 分割書き込みを同時に組み立てる相手の数の上限。 */
        private const val MAX_PENDING_WRITERS = 8

        /** 1台の相手から受け付ける量の上限: [RATE_WINDOW_MS] あたり [RATE_MAX_BYTES] バイトまで(約18件分)。 */
        private const val RATE_WINDOW_MS = 10_000L
        private const val RATE_MAX_BYTES = 8_192

        private const val HANDLE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        private val random = java.security.SecureRandom()

        /** 8文字のランダムな一時ID(端末IDの形式に合わせる)。 */
        fun newHandle(): String = (1..8).map { HANDLE_CHARS[random.nextInt(HANDLE_CHARS.length)] }.joinToString("")
    }

    @Volatile
    override var localHandle: String = newHandle()
        private set

    /** UIに表示するための状態(「広告: 非対応」など)。 */
    data class Status(
        val scanning: Boolean = false,
        val advertising: Boolean = false,
        val gattServer: Boolean = false,
        val problems: List<String> = emptyList(),
    )

    @Volatile
    var status = Status()
        private set

    @Volatile
    var onStatusChanged: (() -> Unit)? = null

    private val thread = HandlerThread("tayori-ble").apply { start() }
    private val handler = Handler(thread.looper)
    private val manager = context.getSystemService(BluetoothManager::class.java)

    private var listener: TransportListener? = null
    private var running = false
    @Volatile
    private var gattServer: BluetoothGattServer? = null

    /** 端末ID → 最後にスキャンで見えた BluetoothDevice(MACアドレスは定期的に変わるので毎回上書き)。 */
    private val peerDevices = HashMap<String, BluetoothDevice>()

    // ---------------------------------------------------------------- 開始・停止

    override fun start(listener: TransportListener) {
        handler.post {
            if (running) return@post
            this.listener = listener
            running = true
            status = Status()
            val adapter = manager?.adapter
            if (adapter == null || !adapter.isEnabled) {
                addProblem("Bluetoothがオフ、またはこの端末にBluetoothがありません")
                return@post
            }
            openGattServer() // 成功したら onServiceAdded から広告を開始する
            startScan()
            handler.postDelayed(rotateHandle, handleRotationMs)
        }
    }

    /** 一時IDを新しくして、広告を出し直す。 */
    private val rotateHandle: Runnable = Runnable {
        if (!running) return@Runnable
        localHandle = newHandle()
        if (status.advertising) {
            stopAdvertising()
            startAdvertising()
        }
        handler.postDelayed(rotateHandle, handleRotationMs)
    }

    override fun stop() {
        handler.post {
            if (!running) return@post
            running = false
            handler.removeCallbacksAndMessages(null)
            stopScan()
            stopAdvertising()
            gattServer?.close()
            gattServer = null
            current?.finish(success = false)
            failAll(queue.toList())
            queue.clear()
            listener = null
            status = Status()
            notifyStatus()
        }
    }

    // ---------------------------------------------------------------- 広告(自分の存在を知らせる)

    private val advertiseCallback = object : AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
            handler.post { updateStatus { it.copy(advertising = true) } }
        }

        override fun onStartFailure(errorCode: Int) {
            // 【機種差】ERROR_FEATURE_UNSUPPORTED(5) や ERROR_TOO_MANY_ADVERTISERS(2) は機種・他アプリ依存
            handler.post {
                updateStatus { it.copy(advertising = false) }
                addProblem("広告の開始に失敗 (error=$errorCode)。この端末は他の端末から見つけてもらえません")
                if (running && errorCode != ADVERTISE_FAILED_FEATURE_UNSUPPORTED) {
                    handler.postDelayed({ if (running) startAdvertising() }, RETRY_DELAY_MS)
                }
            }
        }
    }

    private fun startAdvertising() {
        val adapter = manager?.adapter ?: return
        // 【機種差】BLEの「広告を出す」機能(ペリフェラル機能)を持たない古い端末・安価な端末がある。
        // その端末は「送信・中継(スキャンして相手に書き込む)」はできるが、他から見つけてもらえない=受信できない。
        val advertiser = adapter.bluetoothLeAdvertiser
        if (advertiser == null || !adapter.isMultipleAdvertisementSupported) {
            addProblem("この端末はBLE広告に非対応です(受信役になれません)")
            return
        }
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY) // 電池より見つけてもらいやすさ優先
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0)
            .build()
        // 広告パケットは31バイトまで。128bitのサービスUUID(18バイト)だけを入れる。
        val data = AdvertiseData.Builder()
            .addServiceUuid(ParcelUuid(SERVICE_UUID))
            .setIncludeDeviceName(false)
            .setIncludeTxPowerLevel(false)
            .build()
        // 端末IDは「スキャン応答」(相手がスキャンしたときに追加で返す31バイト)に入れる。
        // 【機種差】スキャン応答を返すのが遅い/返さない機種だと、相手からIDが読めず見つけてもらえない。
        val scanResponse = AdvertiseData.Builder()
            .addServiceData(ParcelUuid(SERVICE_UUID), localHandle.toByteArray(Charsets.US_ASCII))
            .setIncludeDeviceName(false)
            .build()
        advertiser.startAdvertising(settings, data, scanResponse, advertiseCallback)
    }

    private fun stopAdvertising() {
        runCatching { manager?.adapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback) }
        updateStatus { it.copy(advertising = false) }
    }

    // ---------------------------------------------------------------- スキャン(周りの端末を探す)

    private val scanStartTimes = ArrayDeque<Long>()

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            handler.post { handleScanResult(result) }
        }

        override fun onBatchScanResults(results: MutableList<ScanResult>) {
            handler.post { results.forEach(::handleScanResult) }
        }

        override fun onScanFailed(errorCode: Int) {
            // 【機種差】SCAN_FAILED_APPLICATION_REGISTRATION_FAILED(2) は一部機種で頻発する。時間をおいて再試行。
            handler.post {
                updateStatus { it.copy(scanning = false) }
                addProblem("スキャン失敗 (error=$errorCode)。${RETRY_DELAY_MS / 1000}秒後に再試行します")
                handler.postDelayed({ if (running) startScan() }, RETRY_DELAY_MS)
            }
        }
    }

    private val restartScan = Runnable {
        if (running) {
            stopScan()
            startScan()
        }
    }

    private fun startScan() {
        val scanner = manager?.adapter?.bluetoothLeScanner ?: run {
            addProblem("スキャナーを取得できません(Bluetoothがオフ?)")
            return
        }
        val now = SystemClock.elapsedRealtime()
        while (scanStartTimes.isNotEmpty() && now - scanStartTimes.first() > SCAN_START_WINDOW_MS) {
            scanStartTimes.removeFirst()
        }
        if (scanStartTimes.size >= SCAN_START_LIMIT) {
            // 短時間に開始しすぎるとOSにスキャンを黙って止められるので、少し待ってから開始する
            handler.postDelayed({ if (running) startScan() }, SCAN_START_WINDOW_MS)
            return
        }
        scanStartTimes.addLast(now)

        // フィルタ(たよりのサービスUUIDを持つ広告だけ)を必ず付ける。
        // 【OS制限】フィルタなしのスキャンは画面オフ時に結果が届かなくなる。
        val filters = listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(SERVICE_UUID)).build())
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY) // 取りこぼし防止を最優先(電池消費は大きい)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
            .setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
            .setReportDelay(0)
            .build()
        scanner.startScan(filters, settings, scanCallback)
        updateStatus { it.copy(scanning = true) }
        handler.removeCallbacks(restartScan)
        handler.postDelayed(restartScan, SCAN_RESTART_MS)
    }

    private fun stopScan() {
        handler.removeCallbacks(restartScan)
        runCatching { manager?.adapter?.bluetoothLeScanner?.stopScan(scanCallback) }
        updateStatus { it.copy(scanning = false) }
    }

    private fun handleScanResult(result: ScanResult) {
        if (!running) return
        // 端末IDはスキャン応答側に入っている。広告だけ先に届いた結果ではIDが読めないので、次の結果を待つ。
        val bytes = result.scanRecord?.getServiceData(ParcelUuid(SERVICE_UUID)) ?: return
        val peerId = String(bytes, Charsets.US_ASCII)
        if (!DeviceId.isValid(peerId) || peerId == localHandle) return
        peerDevices[peerId] = result.device
        listener?.onPeerSeen(peerId)
    }

    // ---------------------------------------------------------------- GATTサーバー(受信)

    /** 長いデータは「分割書き込み(prepared write)」で届くので、端末ごとに組み立てる。BLEの受信スレッドから触るので lock で守る。 */
    private val preparedWrites = HashMap<String, ByteArrayOutputStream>()

    /** 相手ごとの受信量の記録(受け取った時刻, バイト数)。 */
    private val received = HashMap<String, ArrayDeque<Pair<Long, Int>>>()

    /**
     * 受信窓口は、仕組み上どの機器からでも書き込める(見知らぬ人同士で使うため、事前のペアリングができない)。
     * そこで、1台から受け付ける量と大きさに上限を設けて、悪用されても被害が広がらないようにする。
     */
    private fun admit(address: String, size: Int): Boolean = synchronized(received) {
        val now = SystemClock.elapsedRealtime()
        if (received.size > 64) received.entries.removeIf { now - (it.value.lastOrNull()?.first ?: 0) > RATE_WINDOW_MS }
        val q = received.getOrPut(address) { ArrayDeque() }
        while (q.isNotEmpty() && now - q.first().first > RATE_WINDOW_MS) q.removeFirst()
        if (q.sumOf { it.second } + size > RATE_MAX_BYTES) return false
        q.addLast(now to size)
        true
    }

    private val serverCallback = object : BluetoothGattServerCallback() {
        override fun onServiceAdded(status: Int, service: BluetoothGattService) {
            handler.post {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    updateStatus { it.copy(gattServer = true) }
                    startAdvertising()
                } else {
                    addProblem("GATTサービスの登録に失敗 (status=$status)。受信役になれません")
                }
            }
        }

        override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                synchronized(preparedWrites) { preparedWrites.remove(device.address) }
            }
        }

        override fun onCharacteristicWriteRequest(
            device: BluetoothDevice,
            requestId: Int,
            characteristic: BluetoothGattCharacteristic,
            preparedWrite: Boolean,
            responseNeeded: Boolean,
            offset: Int,
            value: ByteArray?,
        ) {
            val server = gattServer ?: return
            val bytes = value ?: ByteArray(0)
            fun reply(status: Int, echo: ByteArray?) {
                if (responseNeeded) server.sendResponse(device, requestId, status, offset, echo)
            }
            if (characteristic.uuid != INBOX_UUID) return reply(BluetoothGatt.GATT_FAILURE, null)
            if (!admit(device.address, bytes.size)) return reply(BluetoothGatt.GATT_FAILURE, null)

            if (preparedWrite) {
                // 分割書き込みの途中。まだ届け先(エンジン)には渡さず、溜めておく。
                val status = synchronized(preparedWrites) {
                    val buf = preparedWrites[device.address]
                        ?: if (preparedWrites.size >= MAX_PENDING_WRITERS) null
                        else ByteArrayOutputStream().also { preparedWrites[device.address] = it }
                    when {
                        buf == null -> BluetoothGatt.GATT_FAILURE
                        offset != buf.size() -> { preparedWrites.remove(device.address); BluetoothGatt.GATT_INVALID_OFFSET }
                        buf.size() + bytes.size > MAX_PAYLOAD -> {
                            preparedWrites.remove(device.address); BluetoothGatt.GATT_INVALID_ATTRIBUTE_LENGTH
                        }
                        else -> { buf.write(bytes); BluetoothGatt.GATT_SUCCESS }
                    }
                }
                // 分割書き込みの応答は、受け取った値をそのまま返すのが仕様
                reply(status, if (status == BluetoothGatt.GATT_SUCCESS) bytes else null)
            } else {
                if (offset != 0 || bytes.size > MAX_PAYLOAD) return reply(BluetoothGatt.GATT_INVALID_ATTRIBUTE_LENGTH, null)
                reply(BluetoothGatt.GATT_SUCCESS, null)
                handler.post { listener?.onPayloadReceived(bytes) }
            }
        }

        override fun onExecuteWrite(device: BluetoothDevice, requestId: Int, execute: Boolean) {
            gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
            val buf = synchronized(preparedWrites) { preparedWrites.remove(device.address) }
            if (execute && buf != null) {
                val data = buf.toByteArray()
                handler.post { listener?.onPayloadReceived(data) }
            }
        }
    }

    private fun openGattServer() {
        // 【機種差】GATTサーバーを開けない(null が返る)機種・状態がある。その場合は受信役になれない。
        val server = manager?.openGattServer(context, serverCallback) ?: run {
            addProblem("GATTサーバーを開けません。この端末は受信役になれません")
            return
        }
        gattServer = server
        val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        service.addCharacteristic(
            BluetoothGattCharacteristic(
                INBOX_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE,
                BluetoothGattCharacteristic.PERMISSION_WRITE,
            ),
        )
        server.addService(service)
    }

    // ---------------------------------------------------------------- GATTクライアント(送信)

    private class SendJob(val peerId: String, val payload: ByteArray, val onResult: (Boolean) -> Unit)

    private val queue = ArrayDeque<SendJob>()
    private var current: Connection? = null

    override fun send(peerId: String, payload: ByteArray, onResult: (Boolean) -> Unit) {
        handler.post {
            val job = SendJob(peerId, payload, onResult)
            if (!running) {
                onResult(false)
                return@post
            }
            val c = current
            if (c != null && c.peerId == peerId && c.acceptsMoreJobs) {
                c.jobs.addLast(job) // 既に接続中の相手なら、同じ接続で続けて書き込む
            } else {
                queue.addLast(job)
                pump()
            }
        }
    }

    /** 待ち行列の先頭の相手に接続する。接続は同時に1本だけ。 */
    private fun pump() {
        if (current != null || queue.isEmpty() || !running) return
        val peerId = queue.first().peerId
        val jobs = queue.filter { it.peerId == peerId }
        queue.removeAll { it.peerId == peerId }
        val device = peerDevices[peerId]
        if (device == null) {
            failAll(jobs)
            pump()
            return
        }
        current = Connection(peerId, device, ArrayDeque(jobs)).also { it.begin() }
    }

    private fun failAll(jobs: List<SendJob>) = jobs.forEach { it.onResult(false) }

    /**
     * 1回の接続のライフサイクル: 接続 → MTU交渉 → サービス探索 → 書き込み(複数可) → 切断。
     * どの段階でも応答がなければタイムアウトで失敗にする(失敗したメッセージは RelayEngine が後で再送する)。
     */
    private inner class Connection(
        val peerId: String,
        private val device: BluetoothDevice,
        val jobs: ArrayDeque<SendJob>,
    ) {
        private var gatt: BluetoothGatt? = null
        private var inbox: BluetoothGattCharacteristic? = null
        private var writing: SendJob? = null
        private var finished = false
        var acceptsMoreJobs = true
            private set

        private val timeout = Runnable {
            Log.w(TAG, "timeout peer=$peerId")
            finish(success = false)
        }
        private val mtuTimeout = Runnable { discover() }

        fun begin() {
            armTimeout()
            // callback を [handler] のスレッドで受け取る(API 26+)。autoConnect=false は「今すぐ接続」の意味。
            gatt = device.connectGatt(
                context, false, callback, BluetoothDevice.TRANSPORT_LE, BluetoothDevice.PHY_LE_1M_MASK, handler,
            )
            if (gatt == null) finish(success = false)
        }

        private fun armTimeout() {
            handler.removeCallbacks(timeout)
            handler.postDelayed(timeout, STEP_TIMEOUT_MS)
        }

        private val callback = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
                if (finished) return
                if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                    armTimeout()
                    // MTU = 1回の書き込みで送れる大きさ。最大を要求する(初期値は20バイトしかない)。
                    // 【機種差】MTU交渉に応じない/応答しない機種がある。その場合も分割書き込みで送れる。
                    if (!g.requestMtu(517)) {
                        discover()
                    } else {
                        handler.postDelayed(mtuTimeout, MTU_TIMEOUT_MS)
                    }
                } else {
                    // status=133 (GATT_ERROR) は多くの機種で「なんとなく失敗」を意味する。再試行に任せる。
                    Log.w(TAG, "connection state peer=$peerId status=$status state=$newState")
                    finish(success = false)
                }
            }

            override fun onMtuChanged(g: BluetoothGatt, mtu: Int, status: Int) {
                if (finished) return
                handler.removeCallbacks(mtuTimeout)
                discover()
            }

            override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
                if (finished) return
                inbox = g.getService(SERVICE_UUID)?.getCharacteristic(INBOX_UUID)
                if (status != BluetoothGatt.GATT_SUCCESS || inbox == null) {
                    // 【機種差】相手のGATTサーバーが起動していない、または古いサービス情報がキャッシュされている
                    Log.w(TAG, "service not found peer=$peerId status=$status")
                    finish(success = false)
                } else {
                    writeNext()
                }
            }

            override fun onCharacteristicWrite(g: BluetoothGatt, ch: BluetoothGattCharacteristic, status: Int) {
                if (finished) return
                val job = writing ?: return
                writing = null
                job.onResult(status == BluetoothGatt.GATT_SUCCESS)
                if (status == BluetoothGatt.GATT_SUCCESS) writeNext() else finish(success = false)
            }
        }

        private fun discover() {
            if (finished) return
            handler.removeCallbacks(mtuTimeout)
            armTimeout()
            if (gatt?.discoverServices() != true) finish(success = false)
        }

        private fun writeNext() {
            if (finished) return
            val job = jobs.removeFirstOrNull()
            if (job == null) {
                finish(success = true)
                return
            }
            val g = gatt ?: return finish(success = false)
            val ch = inbox ?: return finish(success = false)
            writing = job
            armTimeout()
            // WRITE_TYPE_DEFAULT = 相手の受信確認つき書き込み。MTUを超える長さなら Android が自動で分割書き込みにする。
            val started = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                g.writeCharacteristic(ch, job.payload, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) ==
                    BluetoothStatusCodes.SUCCESS
            } else {
                @Suppress("DEPRECATION")
                ch.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                @Suppress("DEPRECATION")
                ch.value = job.payload
                @Suppress("DEPRECATION")
                g.writeCharacteristic(ch)
            }
            if (!started) finish(success = false)
        }

        fun finish(success: Boolean) {
            if (finished) return
            finished = true
            acceptsMoreJobs = false
            handler.removeCallbacks(timeout)
            handler.removeCallbacks(mtuTimeout)
            writing?.onResult(false)
            writing = null
            failAll(jobs.toList())
            jobs.clear()
            // close() まで呼ばないと接続枠が解放されず、数回で接続できなくなる機種がある
            gatt?.let {
                runCatching { it.disconnect() }
                runCatching { it.close() }
            }
            gatt = null
            if (current === this) current = null
            if (!success) Log.i(TAG, "connection to $peerId ended with failure")
            // 切断直後にすぐ次の接続をすると失敗しやすい機種があるので少し待つ
            handler.postDelayed({ pump() }, 300)
        }
    }

    // ---------------------------------------------------------------- 状態表示

    private fun updateStatus(change: (Status) -> Status) {
        status = change(status)
        notifyStatus()
    }

    private fun addProblem(message: String) {
        Log.w(TAG, message)
        updateStatus { s -> if (message in s.problems) s else s.copy(problems = (s.problems + message).takeLast(5)) }
    }

    private fun notifyStatus() {
        onStatusChanged?.invoke()
    }
}
