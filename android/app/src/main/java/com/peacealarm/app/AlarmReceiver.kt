package com.peacealarm.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.util.Log

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("PeaceAlarm", "AlarmReceiver.onReceive fired!")
        try { onReceiveSafe(context, intent) } catch (e: Exception) {
            Log.e("PeaceAlarm", "AlarmReceiver crash: ${e.message}", e)
        }
    }

    private fun onReceiveSafe(context: Context, intent: Intent) {
        val channelId = intent.getStringExtra("channelId") ?: run {
            Log.e("PeaceAlarm", "AlarmReceiver: no channelId in extras")
            return
        }
        val channelName = intent.getStringExtra("channelName") ?: "Alarm"
        val channelImageUrl = intent.getStringExtra("channelImageUrl") ?: ""
        val alarmId = intent.getStringExtra("alarmId") ?: "0"
        Log.d("PeaceAlarm", "AlarmReceiver: channelId=$channelId alarmId=$alarmId")

        // Briefly acquire a wakelock so the device stays awake long enough for
        // the service and activity to start. AlarmService acquires its own wakelock.
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "PeaceAlarm::ReceiverWakeLock"
        )
        wakeLock.acquire(10000L)

        // Start AlarmService — handles audio, foreground notification, and its own wakelock.
        val serviceIntent = Intent(context, AlarmService::class.java).apply {
            putExtra("alarmId", alarmId)
            putExtra("channelId", channelId)
            putExtra("channelName", channelName)
            putExtra("channelImageUrl", channelImageUrl)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
        Log.d("PeaceAlarm", "AlarmReceiver: startForegroundService OK")

        // Start MainActivity directly. BroadcastReceivers triggered by AlarmManager.setAlarmClock()
        // are exempt from background activity start restrictions even when the screen is ON,
        // ensuring the alarm popup appears without requiring the user to tap a notification.
        val activityIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("alarmChannelId", channelId)
            putExtra("alarmChannelName", channelName)
            putExtra("alarmChannelImageUrl", channelImageUrl)
        }
        try {
            context.startActivity(activityIntent)
            Log.d("PeaceAlarm", "AlarmReceiver: startActivity OK")
        } catch (e: Exception) {
            Log.e("PeaceAlarm", "AlarmReceiver: startActivity failed: ${e.message}")
        }

        wakeLock.release()
    }
}
