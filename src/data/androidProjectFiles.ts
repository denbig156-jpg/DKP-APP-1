import { ZipEntryFile } from '../utils/zipBuilder';

export interface ApkConfigOptions {
  appName: string;
  packageName: string;
  defaultMode: 'FULL_SENSOR' | 'REVERSE_PORTRAIT' | 'PORTRAIT' | 'LANDSCAPE' | 'REVERSE_LANDSCAPE';
  autoStartOnBoot: boolean;
  autoExitOnStart: boolean;
}

export interface AndroidSourceFile extends ZipEntryFile {
  title: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'yaml' | 'markdown';
  description: string;
}

export function generateAndroidProjectFiles(config: ApkConfigOptions): AndroidSourceFile[] {
  const pkgPath = config.packageName.replace(/\./g, '/');

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${config.packageName}">

    <!-- สิทธิ์สำหรับทำงานเบื้องหลังและสร้างแผ่นใส 0x0 px ทับหน้าจอระบบ เพื่อให้แอปอื่นหมุนตามได้ทั้ง 4 ทิศ -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:allowBackup="true"
        android:label="${config.appName}"
        android:supportsRtl="true"
        android:theme="@android:style/Theme.DeviceDefault.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:excludeFromRecents="false"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- บริการเบื้องหลัง (Background ForegroundService) ทำงานตลอดเวลาแม้กดปิดหน้าต่างแอปไปแล้ว -->
        <service
            android:name=".RotationOverlayService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Background system orientation controller across all external apps" />
        </service>

        <!-- ปุ่มลัดบนแถบแจ้งเตือนด้านบน (Quick Settings Tile) สั่งเปิด/ปิดเบื้องหลังได้โดยไม่ต้องเข้าแอป -->
        <service
            android:name=".QuickRotateTileService"
            android:exported="true"
            android:label="หมุนจอ 4 ทิศ"
            android:icon="@android:drawable/ic_menu_always_landscape_portrait"
            android:permission="android.permission.BIND_QUICK_SETTINGS_TILE">
            <intent-filter>
                <action android:name="android.service.quicksettings.action.QS_TILE" />
            </intent-filter>
        </service>

        <!-- เริ่มทำงานเบื้องหลังอัตโนมัติตั้งแต่เปิดเครื่องโดยไม่ต้องกดเข้าแอป -->
        <receiver
            android:name=".BootReceiver"
            android:enabled="${config.autoStartOnBoot ? 'true' : 'false'}"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>`;

  const serviceKt = `package ${config.packageName}

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

/**
 * RotationOverlayService (บริการทำงานเบื้องหลัง 100%)
 * เมื่อผู้ใช้กดเปิดในแอปแล้วกดปิด/ออกจากแอปไปเข้าแอปอื่น (เช่น YouTube, Netflix, TikTok, Line, เกม)
 * บริการนี้จะรันอยู่เบื้องหลังและวาง View โปร่งใสขนาด 0x0 พิกเซล บน WindowManager ของระบบ Android
 * เพื่อปลดล็อกให้หน้าจอโทรศัพท์ทั้งเครื่องหมุนตามทิศการถือจริงครบ 4 ทิศทาง (0°, 90°, 180° กลับหัว, 270°)
 */
class RotationOverlayService : Service() {

    companion object {
        const val CHANNEL_ID = "omni_rotate_bg_channel"
        const val NOTIFICATION_ID = 4001
        const val ACTION_SET_MODE = "${config.packageName}.ACTION_SET_MODE"
        const val ACTION_STOP_SERVICE = "${config.packageName}.ACTION_STOP_SERVICE"
        const val EXTRA_MODE = "extra_rotation_mode"

        const val MODE_FULL_SENSOR = "FULL_SENSOR"           // หมุนอัตโนมัติครบ 4 ทิศตามการถือจริง (รวม 180° กลับหัว)
        const val MODE_REVERSE_PORTRAIT = "REVERSE_PORTRAIT" // บังคับกลับหัว 180°
        const val MODE_LANDSCAPE = "LANDSCAPE"               // บังคับแนวนอนซ้าย 90°
        const val MODE_REVERSE_LANDSCAPE = "REVERSE_LANDSCAPE" // บังคับแนวนอนขวา 270°
        const val MODE_PORTRAIT = "PORTRAIT"                 // บังคับแนวตั้งปกติ 0°

        var currentMode: String = "${config.defaultMode}"
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

        // START_STICKY ทำให้ระบบ Android คงการทำงานเบื้องหลังไว้ตลอดแม้เราปิดหน้าแอปหลักไปแล้ว
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

        // FLAG_NOT_FOCUSABLE + FLAG_NOT_TOUCHABLE ทำให้แผ่นใสขนาด 0x0 พิกเซลไม่รบกวนการกดแอปอื่นเลย
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
            .setContentTitle("${config.appName} (ทำงานเบื้องหลัง)")
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
}`;

  const mainActivityKt = `package ${config.packageName}

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.TypedValue
import android.view.View
import android.widget.*

/**
 * MainActivity
 * มีหน้าที่เพียงเปิดสวิตช์บริการเบื้องหลัง (RotationOverlayService)
 * เมื่อกดเปิดปุ๊บ แอปจะสั่งพับตัวเองลงเบื้องหลังทันที (moveTaskToBack / finish)
 * เพื่อให้ผู้ใช้กลับไปหน้าโฮมแล้วเปิดแอปดูหนังหรือแอปอื่นใช้งานได้ทันที!
 */
class MainActivity : Activity() {

    private lateinit var statusLabel: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(createContentView())
    }

    override fun onResume() {
        super.onResume()
        updateStatusText()
    }

    private fun createContentView(): View {
        val scroll = ScrollView(this).apply {
            setBackgroundColor(Color.parseColor("#090D16"))
            isFillViewport = true
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(32), dp(20), dp(32))
        }

        val title = TextView(this).apply {
            text = "${config.appName} (Background Service)"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
        }

        val subtitle = TextView(this).apply {
            text = "กดเลือกโหมดด้านล่าง แล้วแอปจะพับลงไปทำงานเบื้องหลังให้อัตโนมัติ จากนั้นคุณสามารถไปเข้าแอปดูหนังหรือแอปอื่นได้ทันที"
            setTextColor(Color.parseColor("#94A3B8"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setPadding(0, dp(6), 0, dp(20))
        }

        statusLabel = TextView(this).apply {
            setTextColor(Color.parseColor("#FCD34D"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setPadding(dp(16), dp(14), dp(16), dp(14))
            background = roundedBox("#1E293B", "#334155")
        }

        root.addView(title)
        root.addView(subtitle)
        root.addView(statusLabel)

        val modes = listOf(
            Triple(
                RotationOverlayService.MODE_FULL_SENSOR,
                "เปิดทำงานเบื้องหลัง: หมุนอัตโนมัติครบ 4 ทิศ (แนะนำ)",
                "กดแล้วพับแอปออกทันที -> ไปเปิดแอปอื่นได้เลย ถือเครื่องกลับหัว 180° ภาพก็ตั้งตรง"
            ),
            Triple(
                RotationOverlayService.MODE_REVERSE_PORTRAIT,
                "เปิดทำงานเบื้องหลัง: ล็อกกลับหัว 180° ตลอดเวลา",
                "กดแล้วพับแอปออกทันที -> บังคับทุกแอปให้แสดงผลกลับหัว 180° (สายชาร์จอยู่ด้านบน)"
            ),
            Triple(
                RotationOverlayService.MODE_LANDSCAPE,
                "เปิดทำงานเบื้องหลัง: ล็อกแนวนอน 90°",
                "กดแล้วพับแอปออกทันที -> บังคับทุกแอปให้แสดงผลแนวนอน"
            ),
            Triple(
                RotationOverlayService.MODE_REVERSE_LANDSCAPE,
                "เปิดทำงานเบื้องหลัง: ล็อกแนวนอน 270°",
                "กดแล้วพับแอปออกทันที -> บังคับทุกแอปให้แสดงผลแนวนอนสลับฝั่ง"
            )
        )

        for ((modeKey, modeName, modeDesc) in modes) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(16), dp(16), dp(16), dp(16))
                background = roundedBox("#0F172A", "#F59E0B")
                val lp = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
                lp.topMargin = dp(12)
                layoutParams = lp
                isClickable = true
                setOnClickListener {
                    startBackgroundServiceAndExit(modeKey)
                }
            }

            val btnTitle = TextView(this).apply {
                text = modeName
                setTextColor(Color.WHITE)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            }

            val btnSub = TextView(this).apply {
                text = modeDesc
                setTextColor(Color.parseColor("#CBD5E1"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                setPadding(0, dp(4), 0, 0)
            }

            card.addView(btnTitle)
            card.addView(btnSub)
            root.addView(card)
        }

        val stopBtn = Button(this).apply {
            text = "หยุดการทำงานเบื้องหลัง (คืนค่าระบบปกติ)"
            setTextColor(Color.WHITE)
            background = roundedBox("#7F1D1D", "#991B1B")
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            lp.topMargin = dp(20)
            layoutParams = lp
            setOnClickListener {
                val stopIntent = Intent(this@MainActivity, RotationOverlayService::class.java).apply {
                    action = RotationOverlayService.ACTION_STOP_SERVICE
                }
                startService(stopIntent)
                statusLabel.text = "สถานะ: หยุดบริการเบื้องหลังแล้ว"
            }
        }

        root.addView(stopBtn)
        scroll.addView(root)
        updateStatusText()
        return scroll
    }

    private fun startBackgroundServiceAndExit(mode: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(
                this,
                "กรุณาเปิดสวิตช์ 'แสดงผลทับแอปอื่น' เพียงครั้งเดียว เพื่อให้ทำงานเบื้องหลังขณะใช้แอปอื่นได้",
                Toast.LENGTH_LONG
            ).show()
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
            return
        }

        val serviceIntent = Intent(this, RotationOverlayService::class.java).apply {
            action = RotationOverlayService.ACTION_SET_MODE
            putExtra(RotationOverlayService.EXTRA_MODE, mode)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        Toast.makeText(
            this,
            "กำลังทำงานเบื้องหลังแล้ว! ไปเข้าแอปดูหนังหรือแอปอื่นได้เลย",
            Toast.LENGTH_SHORT
        ).show()

        ${
          config.autoExitOnStart
            ? '// พับแอปนี้ออกไปเบื้องหลังทันที เพื่อให้ผู้ใช้กดเข้าแอปอื่นต่อได้เลย\n        moveTaskToBack(true)'
            : 'updateStatusText(mode)'
        }
    }

    private fun updateStatusText(activeMode: String? = null) {
        val hasOverlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(this)
        } else true

        if (!hasOverlay) {
            statusLabel.text = "แตะปุ่มด้านล่างเพื่ออนุญาตสิทธิ์ทำงานเบื้องหลัง (ทำครั้งเดียวตอนติดตั้ง)"
            return
        }

        val m = activeMode ?: if (RotationOverlayService.isRunning) RotationOverlayService.currentMode else "ปิดอยู่"
        statusLabel.text = "สถานะเบื้องหลัง: $m"
    }

    private fun roundedBox(bgHex: String, strokeHex: String): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(14).toFloat()
            setColor(Color.parseColor(bgHex))
            setStroke(dp(1), Color.parseColor(strokeHex))
        }
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }
}`;

  const quickTileKt = `package ${config.packageName}

import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class QuickRotateTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        syncTileState()
    }

    override fun onClick() {
        super.onClick()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            val intent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivityAndCollapse(intent)
            return
        }

        if (!RotationOverlayService.isRunning) {
            val startIntent = Intent(this, RotationOverlayService::class.java).apply {
                action = RotationOverlayService.ACTION_SET_MODE
                putExtra(RotationOverlayService.EXTRA_MODE, RotationOverlayService.MODE_FULL_SENSOR)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(startIntent)
            } else {
                startService(startIntent)
            }
        } else {
            val stopIntent = Intent(this, RotationOverlayService::class.java).apply {
                action = RotationOverlayService.ACTION_STOP_SERVICE
            }
            startService(stopIntent)
        }
        syncTileState()
    }

    private fun syncTileState() {
        val tile = qsTile ?: return
        if (RotationOverlayService.isRunning) {
            tile.state = Tile.STATE_ACTIVE
            tile.label = "หมุน 4 ทิศ (เปิดอยู่)"
        } else {
            tile.state = Tile.STATE_INACTIVE
            tile.label = "หมุนจอ 4 ทิศ"
        }
        tile.updateTile()
    }
}`;

  const bootReceiverKt = `package ${config.packageName}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)) {
                val serviceIntent = Intent(context, RotationOverlayService::class.java).apply {
                    action = RotationOverlayService.ACTION_SET_MODE
                    putExtra(RotationOverlayService.EXTRA_MODE, "${config.defaultMode}")
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
        }
    }
}`;

  const appBuildGradle = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "${config.packageName}"
    compileSdk = 34

    defaultConfig {
        applicationId = "${config.packageName}"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
}`;

  const rootBuildGradle = `plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}`;

  const settingsGradle = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "OmniRotate4Way"
include(":app")`;

  const githubWorkflowYaml = `name: Build Android APK (OmniRotate 4-Way)

on:
  push:
    branches: [ "main", "master" ]
  workflow_dispatch:

jobs:
  build-apk:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v3
        with:
          gradle-version: '8.5'

      - name: Build Debug & Release Ready-to-Install APK
        run: gradle assembleDebug assembleRelease

      - name: Upload Ready-to-Install .APK File
        uses: actions/upload-artifact@v4
        with:
          name: OmniRotate-4Way-Installable-APK
          path: app/build/outputs/apk/debug/app-debug.apk`;

  const readmeMd = `# ${config.appName} (${config.packageName})
แอป Android (.APK) ทำงานเบื้องหลังสำหรับสั่งหมุนหน้าจอโทรศัพท์ครบ 4 ทิศทาง (0°, 90°, 180° กลับหัว, 270°)

## ลักษณะการทำงาน
1. เปิดแอป **${config.appName}** แล้วกดปุ่ม **"เปิดทำงานเบื้องหลัง: หมุนอัตโนมัติครบ 4 ทิศ"**
2. แอปจะสั่งรัน \`RotationOverlayService\` อยู่เบื้องหลัง แล้ว **พับหน้าต่างแอปตัวเองออกไปทันที (\`moveTaskToBack(true)\`)**
3. คุณสามารถไปเข้าแอปอื่นตามปกติได้เลย (เช่น YouTube, Netflix, TikTok, Line, Chrome) เมื่อถือโทรศัพท์กลับหัว 180° ภาพของแอปเหล่านั้นจะพลิกกลับมาตั้งตรงให้ทันที`;

  return [
    {
      path: `app/src/main/java/${pkgPath}/RotationOverlayService.kt`,
      title: 'RotationOverlayService.kt',
      language: 'kotlin',
      description: 'บริการเบื้องหลัง (ForegroundService) ที่ทำงานอยู่ตลอดเวลาหลังจากเรากดปิด/พับแอปออกไปแล้ว',
      content: serviceKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/MainActivity.kt`,
      title: 'MainActivity.kt',
      language: 'kotlin',
      description: 'หน้าสวิตช์เปิดการทำงาน เมื่อกดปุ๊บจะสั่ง moveTaskToBack(true) พับตัวเองลงเบื้องหลังทันทีเพื่อไปเข้าแอปอื่นได้เลย',
      content: mainActivityKt,
    },
    {
      path: 'app/src/main/AndroidManifest.xml',
      title: 'AndroidManifest.xml',
      language: 'xml',
      description: 'ประกาศสิทธิ์ SYSTEM_ALERT_WINDOW และ FOREGROUND_SERVICE สำหรับทำงานเบื้องหลัง',
      content: manifestXml,
    },
    {
      path: `app/src/main/java/${pkgPath}/QuickRotateTileService.kt`,
      title: 'QuickRotateTileService.kt',
      language: 'kotlin',
      description: 'ปุ่มลัดบนแถบแจ้งเตือนด้านบนของมือถือ กดเปิด/ปิดเบื้องหลังได้โดยไม่ต้องเข้าแอป',
      content: quickTileKt,
    },
    {
      path: `app/src/main/java/${pkgPath}/BootReceiver.kt`,
      title: 'BootReceiver.kt',
      language: 'kotlin',
      description: 'รันบริการหมุนจอ 4 ทิศอยู่เบื้องหลังอัตโนมัติตั้งแต่เปิดเครื่อง',
      content: bootReceiverKt,
    },
    {
      path: 'app/build.gradle.kts',
      title: 'app/build.gradle.kts',
      language: 'gradle',
      description: 'ไฟล์ตั้งค่าการคอมไพล์เป็นไฟล์ .APK',
      content: appBuildGradle,
    },
    {
      path: 'build.gradle.kts',
      title: 'build.gradle.kts',
      language: 'gradle',
      description: 'ไฟล์ Gradle ระดับโปรเจกต์',
      content: rootBuildGradle,
    },
    {
      path: 'settings.gradle.kts',
      title: 'settings.gradle.kts',
      language: 'gradle',
      description: 'ตั้งค่า Repository สำหรับสร้าง .APK',
      content: settingsGradle,
    },
    {
      path: '.github/workflows/build-apk.yml',
      title: '.github/workflows/build-apk.yml',
      language: 'yaml',
      description: 'สคริปต์สั่งบิลด์ไฟล์ .APK อัตโนมัติบน GitHub Actions',
      content: githubWorkflowYaml,
    },
    {
      path: 'README.md',
      title: 'README.md',
      language: 'markdown',
      description: 'คู่มือการทำงานเบื้องหลังและวิธีสร้างไฟล์ .APK',
      content: readmeMd,
    },
  ];
}
