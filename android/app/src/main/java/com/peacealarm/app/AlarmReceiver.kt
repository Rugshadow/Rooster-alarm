package com.peacealarm.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.util.Log
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("PeaceAlarm", "AlarmReceiver.onReceive fired! intent=$intent")
        try { Toast.makeText(context, "PeaceAlarm fired!", Toast.LENGTH_LONG).show() } catch (_: Exception) {}
        try { onReceiveSafe(context, intent) } catch (e: Exception) {
            Log.e("PeaceAlarm", "AlarmReceiver crash: ${e.message}", e)
        }
    }

    private fun onReceiveSafe(context: Context, intent: Intent) {
        val channelId = intent.getStringExtra("channelId") ?: run {
            Log.e("PeaceAlarm", "No channelId in intent extras")
            return
        }
        val channelName = intent.getStringExtra("channelName") ?: "Alarm"
        val channelImageUrl = intent.getStringExtra("channelImageUrl") ?: ""
        val alarmId = intent.getStringExtra("alarmId") ?: "0"

        Log.d("PeaceAlarm", "onReceiveSafe: channelId=$channelId alarmId=$alarmId")

        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
            "PeaceAlarm::AlarmWakeLock"
        )
        wakeLock.acquire(30000L)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val sound = Uri.parse("android.resource://${context.packageName}/raw/alarm")
            val audioAttr = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val nc = NotificationChannel("peace_alarm_clock_v5", "Alarm Clock", NotificationManager.IMPORTANCE_HIGH).apply {
                setBypassDnd(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 500, 500)
                setSound(sound, audioAttr)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(nc)
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("alarmChannelId", channelId)
            putExtra("alarmChannelName", channelName)
            putExtra("alarmChannelImageUrl", channelImageUrl)
        }
        val fullScreenPi = PendingIntent.getActivity(
            context, alarmId.hashCode(), launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, "peace_alarm_clock_v5")
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle("⏰ $channelName")
            .setContentText("Time to wake up!")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .build()

        Log.d("PeaceAlarm", "Posting notification id=${alarmId.hashCode()}")
        NotificationManagerCompat.from(context).notify(alarmId.hashCode(), notification)
        Log.d("PeaceAlarm", "Notification posted OK")
        wakeLock.release()
    }
}
