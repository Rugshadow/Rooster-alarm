package com.peacealarm.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*

class AlarmClockModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AlarmClock"

    private fun buildServicePendingIntent(context: Context, alarmId: String, intent: Intent): PendingIntent {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PendingIntent.getForegroundService(
                context, alarmId.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        } else {
            PendingIntent.getService(
                context, alarmId.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }

    @ReactMethod
    fun scheduleAlarm(alarmId: String, timestamp: Double, data: ReadableMap, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            val intent = Intent(context, AlarmService::class.java).apply {
                putExtra("alarmId", alarmId)
                putExtra("channelId", data.getString("channelId") ?: "")
                putExtra("channelName", data.getString("channelName") ?: "Alarm")
                putExtra("channelImageUrl", data.getString("channelImageUrl") ?: "")
            }
            val pendingIntent = buildServicePendingIntent(context, alarmId, intent)

            val showIntent = Intent(context, MainActivity::class.java)
            val showPi = PendingIntent.getActivity(
                context, alarmId.hashCode() + 1, showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val info = AlarmManager.AlarmClockInfo(timestamp.toLong(), showPi)
            alarmManager.setAlarmClock(info, pendingIntent)
            promise.resolve(alarmId)
        } catch (e: Exception) {
            promise.reject("ALARM_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelAlarm(alarmId: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, AlarmService::class.java)
            val pendingIntent = buildServicePendingIntent(context, alarmId, intent)
            alarmManager.cancel(pendingIntent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }
}
