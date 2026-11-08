package com.omnirotate.fourway

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
                    putExtra(RotationOverlayService.EXTRA_MODE, RotationOverlayService.MODE_FULL_SENSOR)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            }
        }
    }
}
