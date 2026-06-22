package com.roosteralarm.app

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.core.view.WindowCompat

import com.facebook.react.ReactActivity
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    // Enable edge-to-edge so WindowInsets (status bar + display cutout) are dispatched
    // to React views; without this, react-native-safe-area-context reports 0 insets.
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val hasExtra = intent?.hasExtra("alarmChannelId") == true
    val prefChannelId = getSharedPreferences("peace_alarm_prefs", MODE_PRIVATE).getString("alarm_channel_id", null)
    android.util.Log.d("RoosterAlarm", "MainActivity.onCreate hasExtra=$hasExtra prefChannelId=$prefChannelId")
    val hasAlarm = hasExtra || prefChannelId != null
    if (hasAlarm) {
      android.util.Log.d("RoosterAlarm", "MainActivity.onCreate: calling showOnLockScreen()")
      showOnLockScreen()
      hideAlarmNotification()
    } else {
      android.util.Log.d("RoosterAlarm", "MainActivity.onCreate: no alarm, skipping showOnLockScreen()")
    }
    super.onCreate(null)
  }

  private fun hideAlarmNotification() {
    try {
      startService(Intent(this, AlarmService::class.java).apply {
        action = AlarmService.ACTION_HIDE_NOTIFICATION
      })
    } catch (e: Exception) {
      android.util.Log.w("RoosterAlarm", "hideAlarmNotification failed: ${e.message}")
    }
  }

  private fun showOnLockScreen() {
    android.util.Log.d("RoosterAlarm", "MainActivity.showOnLockScreen() called, SDK=${Build.VERSION.SDK_INT}")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
    @Suppress("DEPRECATION")
    window.addFlags(
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
      WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
    )
    android.util.Log.d("RoosterAlarm", "MainActivity.showOnLockScreen() done")
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    val hasAlarm = intent.hasExtra("alarmChannelId") ||
      getSharedPreferences("peace_alarm_prefs", MODE_PRIVATE).getString("alarm_channel_id", null) != null
    if (hasAlarm) { showOnLockScreen(); hideAlarmNotification(); tryEmitAlarmFired() }
  }

  private fun tryEmitAlarmFired(attempt: Int = 0) {
    try {
      val reactContext = (applicationContext as? MainApplication)
        ?.reactNativeHost?.reactInstanceManager?.currentReactContext
      if (reactContext != null) {
        val prefs = getSharedPreferences("peace_alarm_prefs", MODE_PRIVATE)
        val channelId = intent?.getStringExtra("alarmChannelId")
          ?: prefs.getString("alarm_channel_id", null)
          ?: PendingAlarmData.channelId
        if (channelId.isNullOrEmpty()) {
          android.util.Log.w("RoosterAlarm", "tryEmitAlarmFired: no channelId found, skipping emit")
          return
        }
        val channelName = intent?.getStringExtra("alarmChannelName")
          ?: prefs.getString("alarm_channel_name", "Alarm") ?: "Alarm"
        val channelImageUrl = intent?.getStringExtra("alarmChannelImageUrl")
          ?: prefs.getString("alarm_channel_image_url", "") ?: ""
        val params = com.facebook.react.bridge.Arguments.createMap().apply {
          putString("channelId", channelId)
          putString("channelName", channelName)
          putString("channelImageUrl", channelImageUrl)
        }
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          ?.emit("RoosterAlarmFired", params)
        android.util.Log.d("RoosterAlarm", "tryEmitAlarmFired: emitted channelId=$channelId on attempt $attempt")
      } else if (attempt < 20) {
        android.util.Log.d("RoosterAlarm", "tryEmitAlarmFired: reactContext null, retrying (attempt $attempt)")
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
          tryEmitAlarmFired(attempt + 1)
        }, 250)
      } else {
        android.util.Log.w("RoosterAlarm", "tryEmitAlarmFired: gave up after $attempt attempts")
      }
    } catch (e: Exception) {
      android.util.Log.e("RoosterAlarm", "tryEmitAlarmFired: error: ${e.message}")
    }
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
