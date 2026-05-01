package com.peacealarm.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.net.wifi.WifiManager
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import java.net.URL

class AlarmService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("PeaceAlarm", "AlarmService.onStartCommand fired!")

        val channelId = intent?.getStringExtra("channelId") ?: ""
        val channelName = intent?.getStringExtra("channelName") ?: "Alarm"
        val channelImageUrl = intent?.getStringExtra("channelImageUrl") ?: ""
        val alarmId = intent?.getStringExtra("alarmId") ?: "0"

        Log.d("PeaceAlarm", "AlarmService: channelId=$channelId alarmId=$alarmId")

        PendingAlarmData.set(channelId, channelName, channelImageUrl)

        // SharedPreferences — persists even if JS hasn't loaded yet
        getSharedPreferences("peace_alarm_prefs", android.content.Context.MODE_PRIVATE).edit()
            .putString("alarm_channel_id", channelId)
            .putString("alarm_channel_name", channelName)
            .putString("alarm_channel_image_url", channelImageUrl)
            .apply()
        Log.d("PeaceAlarm", "AlarmService: wrote alarm data to SharedPreferences")

        // Create notification channel (before startForeground — screen still OFF here)
        val notifChannelId = "peace_alarm_service_v1"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val sound = Uri.parse("android.resource://$packageName/raw/alarm")
            val audioAttr = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val nc = NotificationChannel(notifChannelId, "Alarm", NotificationManager.IMPORTANCE_HIGH).apply {
                setBypassDnd(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 500, 500)
                setSound(sound, audioAttr)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(nc)
        }

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("alarmChannelId", channelId)
            putExtra("alarmChannelName", channelName)
            putExtra("alarmChannelImageUrl", channelImageUrl)
        }
        val fullScreenPi = PendingIntent.getActivity(
            this, alarmId.hashCode(), launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, notifChannelId)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle("⏰ $channelName")
            .setContentText("Time to wake up!")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPi, true)
            .setContentIntent(fullScreenPi)
            .setAutoCancel(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .build()

        startForeground(alarmId.hashCode().let { if (it == 0) 1 else it }, notification)
        Log.d("PeaceAlarm", "AlarmService: startForeground OK")

        // Acquire wakelock AFTER startForeground so screen is off when notification posts,
        // allowing fullScreenIntent to fire. ACQUIRE_CAUSES_WAKEUP then turns screen on.
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "PeaceAlarm::AlarmWakeLock"
        )
        wakeLock?.acquire(60000L)

        @Suppress("DEPRECATION")
        wifiLock = (getSystemService(WIFI_SERVICE) as WifiManager)
            .createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "PeaceAlarm::AlarmWifiLock")
        wifiLock?.acquire()

        // Fetch channel audio from Supabase and play it; fall back to alarm.wav on any failure
        Thread {
            val audioUrl = fetchLatestAudioUrl(channelId)
            if (audioUrl != null) {
                Log.d("PeaceAlarm", "AlarmService: playing channel audio $audioUrl")
                AlarmSoundManager.playUrl(this, audioUrl) {
                    Log.w("PeaceAlarm", "AlarmService: stream error, falling back to alarm.wav")
                    AlarmSoundManager.playFallback(this)
                }
            } else {
                Log.w("PeaceAlarm", "AlarmService: no audio URL, playing alarm.wav")
                AlarmSoundManager.playFallback(this)
            }
        }.start()

        // Fallback startActivity — handles case where app is already in foreground / screen already on
        try {
            val activityIntent = Intent(this, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("alarmChannelId", channelId)
                putExtra("alarmChannelName", channelName)
                putExtra("alarmChannelImageUrl", channelImageUrl)
            }
            startActivity(activityIntent)
            Log.d("PeaceAlarm", "AlarmService: launched MainActivity")
        } catch (e: Exception) {
            Log.e("PeaceAlarm", "AlarmService: failed to launch MainActivity: ${e.message}", e)
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        AlarmSoundManager.stop()
        wifiLock?.let { if (it.isHeld) it.release() }
        wifiLock = null
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        Log.d("PeaceAlarm", "AlarmService: onDestroy")
    }

    private fun fetchLatestAudioUrl(channelId: String): String? {
        return try {
            val supabaseUrl = "https://ozvuodmznvuvcuiayqth.supabase.co"
            val anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96dnVvZG16bnZ1dmN1aWF5cXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTUwOTIsImV4cCI6MjA5MjczMTA5Mn0.noToTap-ZKNo6DFwe9we-u31efUs0F-E2RF9NPVwWxc"
            val endpoint = "$supabaseUrl/rest/v1/audio_files?channel_id=eq.$channelId&order=created_at.desc&limit=1&select=audio_file"
            val conn = URL(endpoint).openConnection() as java.net.HttpURLConnection
            conn.setRequestProperty("apikey", anonKey)
            conn.setRequestProperty("Authorization", "Bearer $anonKey")
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            val body = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            val arr = JSONArray(body)
            if (arr.length() > 0) arr.getJSONObject(0).optString("audio_file").takeIf { it.isNotEmpty() }
            else null
        } catch (e: Exception) {
            Log.e("PeaceAlarm", "AlarmService: fetchLatestAudioUrl failed: ${e.message}")
            null
        }
    }
}
