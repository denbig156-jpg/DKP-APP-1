package com.omnirotate.fourway

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.View
import android.view.WindowManager

class RotationOverlayService : Service() {

    companion object {
        const val CHANNEL_ID = "omni_rotate_bg_channel"
        const val NOTIFICATION_ID = 4001
        const val ACTION_SET_MODE = "com.omnirotate.fourway.ACTION_SET_MODE"
        const val ACTION_STOP_SERVICE = "com.omnirotate.fourway.ACTION_STOP_SERVICE"
        const val EXTRA_MODE = "extra_rotation_mode"

        const val MODE_FULL_SENSOR = "FULL_SENSOR"
        const val MODE_REVERSE_PORTRAIT = "REVERSE_PORTRAIT"
        const val MODE_LANDSCAPE = "LANDSCAPE"
        const val MODE_REVERSE_LANDSCAPE = "REVERSE_LANDSCAPE"
        const val MODE_PORTRAIT = "PORTRAIT"

        var currentMode: String = MODE_FULL_SENSOR
        var isRunning: Boolean = false
    }

    private lateinit var windowManager: WindowManager
    private var overlayView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_SERVICE) {
            stopSelf()
            return START_NOT_STICKY
        }

        val requestedMode = intent?.getStringExtra(EXTRA_MODE) ?: currentMode
        currentMode = requestedMode

        startForeground(NOTIFICATION_ID, buildBackgroundNotification(currentMode))
        applySystemWideOrientation(currentMode)

        return START_STICKY
    }

    private fun mapModeToOrientationFlag(mode: String): Int {
        return when (mode) {
            MODE_FULL_SENSOR -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            MODE_REVERSE_PORTRAIT -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
            MODE_LANDSCAPE -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            MODE_REVERSE_LANDSCAPE -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
            MODE_PORTRAIT -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            else -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        }
    }

    private fun applySystemWideOrientation(mode: String) {
        val orientationFlag = mapModeToOrientationFlag(mode)

        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_SYSTEM_OVERLAY
        }

        val flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN

        if (overlayView == null) {
            overlayView = View(this)
            layoutParams = WindowManager.LayoutParams(
                0,
                0,
                overlayType,
                flags,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                screenOrientation = orientationFlag
            }
            windowManager.addView(overlayView, layoutParams)
        } else {
            layoutParams?.let { params ->
                params.screenOrientation = orientationFlag
                windowManager.updateViewLayout(overlayView, params)
            }
        }

        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildBackgroundNotification(mode))
    }

    private fun buildBackgroundNotification(mode: String): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        fun switchModeIntent(targetMode: String, reqCode: Int): PendingIntent {
            val i = Intent(this, RotationOverlayService::class.java).apply {
                action = ACTION_SET_MODE
                putExtra(EXTRA_MODE, targetMode)
            }
            return PendingIntent.getService(
                this, reqCode, i,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        val stopIntent = PendingIntent.getService(
            this, 99,
            Intent(this, RotationOverlayService::class.java).apply {
                action = ACTION_STOP_SERVICE
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val modeTitle = when (mode) {
            MODE_FULL_SENSOR -> "หมุนอัตโนมัติ 4 ทิศ (รวมกลับหัว 180°)"
            MODE_REVERSE_PORTRAIT -> "ล็อกกลับหัว 180°"
            MODE_LANDSCAPE -> "ล็อกแนวนอน 90°"
            MODE_REVERSE_LANDSCAPE -> "ล็อกแนวนอน 270°"
            else -> "ล็อกแนวตั้ง 0°"
        }

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("OmniRotate 4-Way (ทำงานเบื้องหลัง)")
            .setContentText("โหมด: $modeTitle — เข้าแอปอื่นได้เลย")
            .setSmallIcon(android.R.drawable.ic_menu_always_landscape_portrait)
            .setContentIntent(openAppIntent)
            .setOngoing(true)
            .addAction(0, "4 ทิศอัตโนมัติ", switchModeIntent(MODE_FULL_SENSOR, 1))
            .addAction(0, "กลับหัว 180°", switchModeIntent(MODE_REVERSE_PORTRAIT, 2))
            .addAction(0, "ปิดเบื้องหลัง", stopIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "บริการหมุนจอเบื้องหลัง 4 ทิศทาง",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "ควบคุมการหมุนจออยู่เบื้องหลังขณะใช้งานแอปอื่น"
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        isRunning = false
        overlayView?.let {
            try {
                windowManager.removeView(it)
            } catch (_: Exception) {}
        }
        overlayView = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
