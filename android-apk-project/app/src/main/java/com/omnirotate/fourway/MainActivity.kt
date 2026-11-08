package com.omnirotate.fourway

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
            text = "OmniRotate 4-Way (Background Service)"
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

        moveTaskToBack(true)
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
}
