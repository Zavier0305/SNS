package com.zavier.tayori.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

/**
 * 常駐サービス(フォアグラウンドサービス)。
 * 通知を出し続けることで「この処理は利用者が意図して動かしている」とOSに伝え、
 * 画面を消しても・他のアプリを開いても、スキャンと中継を止められにくくする。
 */
class TayoriService : Service() {

    companion object {
        private const val CHANNEL_ID = "tayori_relay"
        private const val NOTIFICATION_ID = 1

        fun start(context: Context) {
            val intent = Intent(context, TayoriService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, TayoriService::class.java))
        }
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        TayoriRuntime.init(this)
        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        // 画面オフでもCPUを眠らせない(接続のタイムアウト処理などを遅らせないため)。精度優先で電池を使う。
        if (wakeLock == null) {
            wakeLock = getSystemService(PowerManager::class.java)
                ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tayori:relay")
                ?.apply { acquire() }
        }
        TayoriRuntime.start()
        // OSに強制終了されても、余裕ができたら自動で再起動してもらう
        return START_STICKY
    }

    override fun onDestroy() {
        TayoriRuntime.stop()
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm?.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "中継の動作状況", NotificationManager.IMPORTANCE_LOW),
            )
        }
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setContentTitle("たより: 中継中")
            .setContentText("端末ID ${TayoriRuntime.deviceId} / 周囲の端末を探しています")
            .setOngoing(true)
            .setContentIntent(open)
            .build()
    }
}
