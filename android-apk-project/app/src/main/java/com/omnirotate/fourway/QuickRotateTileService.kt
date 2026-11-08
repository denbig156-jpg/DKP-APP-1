package com.omnirotate.fourway

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
}
