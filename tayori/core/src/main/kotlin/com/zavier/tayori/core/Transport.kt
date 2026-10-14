package com.zavier.tayori.core

/**
 * 「通信路」の抽象。中継ロジック(RelayEngine)はこのインターフェースしか知らない。
 *
 * - 本番: Android の BLE GATT 実装(app モジュールの BleTransport)
 * - テスト: メモリ上で電波の届く範囲を模擬する FakeTransport(core のテスト側)
 *
 * こうして分けておくと、実機1台しかなくても中継ロジックをPC上で何台分でも検証できる。
 */
interface Transport {
    /** 周囲の探索・受信待ちを開始する。以後のイベントは [listener] に通知する。 */
    fun start(listener: TransportListener)

    fun stop()

    /**
     * [peerId] の端末へ [payload] を1件届ける。結果は [onResult] で非同期に返す。
     * true = 相手端末が受信を確認した(GATTの書き込み応答が成功した)。
     * 実装は同じ相手への送信を順番に処理すること(BLEは同時操作に弱いため)。
     */
    fun send(peerId: String, payload: ByteArray, onResult: (Boolean) -> Unit)
}

interface TransportListener {
    /** 近くに [peerId] の端末が見えた。スキャン結果のたびに何度も呼ばれてよい。 */
    fun onPeerSeen(peerId: String)

    /** どこかの端末からデータが届いた。 */
    fun onPayloadReceived(payload: ByteArray)
}
