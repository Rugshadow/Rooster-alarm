package com.peacealarm.app

import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import com.facebook.react.bridge.*

class IntentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "IntentData"

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        val pm = reactApplicationContext.getSystemService(PowerManager::class.java)
        promise.resolve(pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName))
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactApplicationContext.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val nm = reactApplicationContext.getSystemService(NotificationManager::class.java)
            promise.resolve(nm.canUseFullScreenIntent())
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun openFullScreenIntentSettings(promise: Promise) {
        try {
            val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
                data = Uri.fromParts("package", reactApplicationContext.packageName, null)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopAlarmSound(promise: Promise) {
        AlarmSoundManager.stop()
        promise.resolve(null)
    }

    @ReactMethod
    fun playAlarmUrl(url: String, promise: Promise) {
        android.util.Log.d("PeaceAlarm", "IntentModule.playAlarmUrl called url=$url")
        Thread {
            android.util.Log.d("PeaceAlarm", "IntentModule.playAlarmUrl thread started")
            try {
                AlarmSoundManager.playUrl(reactApplicationContext, url) {
                    android.util.Log.w("PeaceAlarm", "IntentModule.playAlarmUrl: onError callback, falling back")
                    AlarmSoundManager.playFallback(reactApplicationContext)
                }
                android.util.Log.d("PeaceAlarm", "IntentModule.playAlarmUrl: playUrl returned")
            } catch (e: Exception) {
                android.util.Log.e("PeaceAlarm", "IntentModule.playAlarmUrl thread exception: ${e.message}", e)
            }
            promise.resolve(null)
        }.start()
        android.util.Log.d("PeaceAlarm", "IntentModule.playAlarmUrl thread launched")
    }

    @ReactMethod
    fun playAlarmFallback(promise: Promise) {
        android.util.Log.d("PeaceAlarm", "IntentModule.playAlarmFallback called")
        Thread {
            try {
                AlarmSoundManager.playFallback(reactApplicationContext)
            } catch (e: Exception) {
                android.util.Log.e("PeaceAlarm", "IntentModule.playAlarmFallback exception: ${e.message}", e)
            }
            promise.resolve(null)
        }.start()
    }

    @ReactMethod
    fun getAlarmData(promise: Promise) {
        val activity = getCurrentActivity()
        val extras: Bundle? = activity?.intent?.extras
        android.util.Log.d("PeaceAlarm", "getAlarmData: activity=${activity?.javaClass?.simpleName} hasExtra=${extras?.containsKey("alarmChannelId")} pendingId=${PendingAlarmData.channelId}")

        // 1. Activity intent extras (startActivity path)
        if (extras != null && extras.containsKey("alarmChannelId")) {
            val map = Arguments.createMap().apply {
                putString("channelId", extras.getString("alarmChannelId", ""))
                putString("channelName", extras.getString("alarmChannelName", ""))
                putString("channelImageUrl", extras.getString("alarmChannelImageUrl", ""))
            }
            activity.intent?.removeExtra("alarmChannelId")
            clearAlarmPrefs()
            promise.resolve(map)
            return
        }

        // 2. In-process PendingAlarmData
        val pending = PendingAlarmData.consume()
        if (pending != null) {
            clearAlarmPrefs()
            promise.resolve(Arguments.createMap().apply {
                putString("channelId", pending.first)
                putString("channelName", pending.second)
                putString("channelImageUrl", pending.third)
            })
            return
        }

        // 3. SharedPreferences — survives process restart and JS load delay
        val prefs = reactApplicationContext.getSharedPreferences("peace_alarm_prefs", android.content.Context.MODE_PRIVATE)
        val channelId = prefs.getString("alarm_channel_id", null)
        android.util.Log.d("PeaceAlarm", "getAlarmData: SharedPreferences channelId=$channelId")
        if (channelId != null) {
            val map = Arguments.createMap().apply {
                putString("channelId", channelId)
                putString("channelName", prefs.getString("alarm_channel_name", "Alarm") ?: "Alarm")
                putString("channelImageUrl", prefs.getString("alarm_channel_image_url", "") ?: "")
            }
            clearAlarmPrefs()
            promise.resolve(map)
            return
        }

        promise.resolve(null)
    }

    private fun clearAlarmPrefs() {
        reactApplicationContext.getSharedPreferences("peace_alarm_prefs", android.content.Context.MODE_PRIVATE)
            .edit().clear().apply()
    }

    @ReactMethod
    fun stopAlarmService(promise: Promise) {
        try {
            AlarmSoundManager.stop()
            reactApplicationContext.stopService(
                Intent(reactApplicationContext, AlarmService::class.java)
            )
            PendingAlarmData.channelId = null
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
