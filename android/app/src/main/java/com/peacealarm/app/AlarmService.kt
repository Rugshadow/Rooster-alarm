package com.peacealarm.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.AudioAttributes
import android.os.Build
import android.net.wifi.WifiManager
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import java.net.URL

class AlarmService : Service() {

    companion object {
        const val ACTION_HIDE_NOTIFICATION = "com.peacealarm.app.HIDE_NOTIFICATION"
    }

    @Volatile private var isDestroyed = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_HIDE_NOTIFICATION) {
            Log.d("PeaceAlarm", "AlarmService: hiding notification (popup is showing)")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            return START_NOT_STICKY
        }

        Log.d("PeaceAlarm", "AlarmService.onStartCommand fired!")

        val channelId = intent?.getStringExtra("channelId") ?: ""
        val channelName = intent?.getStringExtra("channelName") ?: "Alarm"
        val channelImageUrl = intent?.getStringExtra("channelImageUrl") ?: ""
        val alarmId = intent?.getStringExtra("alarmId") ?: "0"

        Log.d("PeaceAlarm", "AlarmService: channelId=$channelId alarmId=$alarmId")

        PendingAlarmData.set(channelId, channelName, channelImageUrl)

        // Load persisted volume into AlarmSoundManager before playing
        AlarmSoundManager.alarmVolume = getSharedPreferences("peace_alarm_prefs", android.content.Context.MODE_PRIVATE)
            .getFloat("alarm_volume", 1.0f)

        // Emit directly to JS bridge — most reliable path when app is already in foreground.
        // Also track whether JS is live; if it is, JS will handle audio via launch() and we
        // must NOT race it with our own fetch-and-play thread.
        var jsIsRunning = false
        try {
            val reactContext = (applicationContext as? MainApplication)
                ?.reactNativeHost?.reactInstanceManager?.currentReactContext
            if (reactContext != null) {
                reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("PeaceAlarmFired", null)
                jsIsRunning = true
                Log.d("PeaceAlarm", "AlarmService: emitted PeaceAlarmFired — JS is live, skipping service audio")
            } else {
                Log.d("PeaceAlarm", "AlarmService: no React context — JS not running, service will play audio")
            }
        } catch (e: Exception) {
            Log.w("PeaceAlarm", "AlarmService: could not emit PeaceAlarmFired: ${e.message}")
        }

        // SharedPreferences — persists even if JS hasn't loaded yet
        getSharedPreferences("peace_alarm_prefs", android.content.Context.MODE_PRIVATE).edit()
            .putString("alarm_channel_id", channelId)
            .putString("alarm_channel_name", channelName)
            .putString("alarm_channel_image_url", channelImageUrl)
            .apply()
        Log.d("PeaceAlarm", "AlarmService: wrote alarm data to SharedPreferences")

        // Create notification channel (before startForeground — screen still OFF here)
        // v2: silent channel — audio is handled entirely by AlarmSoundManager (USAGE_ALARM)
        val notifChannelId = "peace_alarm_service_v2"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nc = NotificationChannel(notifChannelId, "Alarm", NotificationManager.IMPORTANCE_HIGH).apply {
                setBypassDnd(true)
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 500, 500)
                setSound(null, null)
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

        val timeStr = java.text.SimpleDateFormat("h:mm a", java.util.Locale.US).format(java.util.Date())
        val notification = NotificationCompat.Builder(this, notifChannelId)
            .setSmallIcon(R.drawable.notification_icon)
            .setContentTitle(channelName)
            .setContentText("$timeStr alarm")
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

        // If JS is live it will call playAlarmUrl via launch() — don't race it.
        // Only fetch and play audio here when the app is killed (cold start / no JS context).
        if (!jsIsRunning) {
            val fallbackSound = getSharedPreferences("peace_alarm_prefs", android.content.Context.MODE_PRIVATE)
                .getString("fallback_sound", "alarm") ?: "alarm"
            Thread {
                val audioUrl = fetchLatestAudioUrl(channelId)
                if (isDestroyed) return@Thread
                if (audioUrl != null) {
                    Log.d("PeaceAlarm", "AlarmService: playing channel audio $audioUrl")
                    AlarmSoundManager.playUrl(this, audioUrl) {
                        if (!isDestroyed) {
                            Log.w("PeaceAlarm", "AlarmService: stream error, falling back to $fallbackSound")
                            AlarmSoundManager.playFallback(this, fallbackSound)
                        }
                    }
                } else {
                    Log.w("PeaceAlarm", "AlarmService: no audio URL, playing fallback $fallbackSound")
                    AlarmSoundManager.playFallback(this, fallbackSound)
                }
            }.start()
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        isDestroyed = true
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
            val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
            sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
            val now = sdf.format(java.util.Date())

            // Determine listening_order for channel
            val channelEndpoint = "$supabaseUrl/rest/v1/channels?channel_id=eq.$channelId&select=listening_order&limit=1"
            val channelConn = URL(channelEndpoint).openConnection() as java.net.HttpURLConnection
            channelConn.setRequestProperty("apikey", anonKey)
            channelConn.setRequestProperty("Authorization", "Bearer $anonKey")
            channelConn.connectTimeout = 5000
            channelConn.readTimeout = 5000
            val channelBody = channelConn.inputStream.bufferedReader().readText()
            channelConn.disconnect()
            val channelArr = JSONArray(channelBody)
            val listeningOrder = if (channelArr.length() > 0)
                channelArr.getJSONObject(0).optString("listening_order", "newest")
            else "newest"

            if (listeningOrder == "newest") {
                // Latest released clip
                val endpoint = "$supabaseUrl/rest/v1/audio_files?channel_id=eq.$channelId&or=(release_at.is.null,release_at.lte.$now)&order=created_at.desc&limit=1&select=audio_file"
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
            } else {
                // Oldest unheard clip
                val prefs = getSharedPreferences("peace_alarm_prefs", android.content.Context.MODE_PRIVATE)
                val userId = prefs.getString("user_id", null)

                val heardIds = mutableSetOf<String>()
                if (userId != null) {
                    val userEndpoint = "$supabaseUrl/rest/v1/users?user_id=eq.$userId&select=heard_audio&limit=1"
                    val userConn = URL(userEndpoint).openConnection() as java.net.HttpURLConnection
                    userConn.setRequestProperty("apikey", anonKey)
                    userConn.setRequestProperty("Authorization", "Bearer $anonKey")
                    userConn.connectTimeout = 5000
                    userConn.readTimeout = 5000
                    val userBody = userConn.inputStream.bufferedReader().readText()
                    userConn.disconnect()
                    val userArr = JSONArray(userBody)
                    if (userArr.length() > 0) {
                        val heardArr = userArr.getJSONObject(0).optJSONArray("heard_audio")
                        if (heardArr != null) {
                            for (i in 0 until heardArr.length()) heardIds.add(heardArr.getString(i))
                        }
                    }
                }

                val allEndpoint = "$supabaseUrl/rest/v1/audio_files?channel_id=eq.$channelId&or=(release_at.is.null,release_at.lte.$now)&order=created_at.asc&select=audio_id,audio_file"
                val allConn = URL(allEndpoint).openConnection() as java.net.HttpURLConnection
                allConn.setRequestProperty("apikey", anonKey)
                allConn.setRequestProperty("Authorization", "Bearer $anonKey")
                allConn.connectTimeout = 5000
                allConn.readTimeout = 5000
                val allBody = allConn.inputStream.bufferedReader().readText()
                allConn.disconnect()
                val allArr = JSONArray(allBody)

                // Find oldest unheard; fallback to newest if all heard
                var target: String? = null
                for (i in 0 until allArr.length()) {
                    val obj = allArr.getJSONObject(i)
                    val id = obj.optString("audio_id")
                    if (!heardIds.contains(id)) {
                        target = obj.optString("audio_file").takeIf { it.isNotEmpty() }
                        break
                    }
                }
                if (target == null && allArr.length() > 0) {
                    target = allArr.getJSONObject(allArr.length() - 1).optString("audio_file").takeIf { it.isNotEmpty() }
                }
                target
            }
        } catch (e: Exception) {
            Log.e("PeaceAlarm", "AlarmService: fetchLatestAudioUrl failed: ${e.message}")
            null
        }
    }
}
