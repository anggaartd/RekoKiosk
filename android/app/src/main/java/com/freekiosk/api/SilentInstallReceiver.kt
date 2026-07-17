package com.freekiosk.api

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.util.Log

/**
 * Receives the result of a silent APK installation via PackageInstaller.
 */
class SilentInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        val status = intent?.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE) ?: PackageInstaller.STATUS_FAILURE
        val message = intent?.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "Unknown"
        
        when (status) {
            PackageInstaller.STATUS_SUCCESS -> {
                Log.i("SilentInstall", "✅ OTA Update installed successfully!")
            }
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                // Device Owner should not hit this, but just in case
                val confirmIntent = intent?.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
                if (confirmIntent != null) {
                    confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context?.startActivity(confirmIntent)
                    Log.w("SilentInstall", "⚠️ User action required for install")
                }
            }
            else -> {
                Log.e("SilentInstall", "❌ Install failed: status=$status, message=$message")
            }
        }
    }
}
