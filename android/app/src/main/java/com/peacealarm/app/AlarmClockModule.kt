package com.peacealarm.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.*

class AlarmClockModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "AlarmClock"

    @ReactMethod
    fun scheduleAlarm(alarmId: String, timestamp: Double, data: ReadableMap, promise: Promise) {
        try {
            val context = reactApplicationContext
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            // Target AlarmReceiver (BroadcastReceiver) so AlarmManager's alarm exemption applies.
            // BroadcastReceivers triggered by setAlarmClock can start activities even when screen is ON.
            val receiverIntent = Intent(context, AlarmReceiver::class.java).apply {
                putExtra("alarmId", alarmId)
                putExtra("channelId", data.getString("channelId") ?: "")
                putExtra("channelName", data.getString("channelName") ?: "Alarm")
                putExtra("channelImageUrl", data.getString("channelImageUrl") ?: "")
            }
            val pendingIntent = PendingIntent.getBroadcast(
                context, alarmId.hashCode(), receiverIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

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
            val receiverIntent = Intent(context, AlarmReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context, alarmId.hashCode(), receiverIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pendingIntent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }
}
