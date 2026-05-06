package com.peacealarm.app

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager

import com.facebook.react.ReactActivity
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    val hasExtra = intent?.hasExtra("alarmChannelId") == true
    val prefChannelId = getSharedPreferences("peace_alarm_prefs", MODE_PRIVATE).getString("alarm_channel_id", null)
    android.util.Log.d("PeaceAlarm", "MainActivity.onCreate hasExtra=$hasExtra prefChannelId=$prefChannelId")
    val hasAlarm = hasExtra || prefChannelId != null
    if (hasAlarm) {
      android.util.Log.d("PeaceAlarm", "MainActivity.onCreate: calling showOnLockScreen()")
      showOnLockScreen()
    } else {
      android.util.Log.d("PeaceAlarm", "MainActivity.onCreate: no alarm, skipping showOnLockScreen()")
    }
    super.onCreate(null)
  }

  private fun showOnLockScreen() {
    android.util.Log.d("PeaceAlarm", "MainActivity.showOnLockScreen() called, SDK=${Build.VERSION.SDK_INT}")
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
    android.util.Log.d("PeaceAlarm", "MainActivity.showOnLockScreen() done")
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
    if (hasAlarm) showOnLockScreen()
    try {
      val reactContext = (applicationContext as? MainApplication)
        ?.reactNativeHost?.reactInstanceManager?.currentReactContext
      reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        ?.emit("PeaceAlarmFired", null)
      android.util.Log.d("PeaceAlarm", "onNewIntent: emitted PeaceAlarmFired reactContext=${reactContext != null}")
    } catch (e: Exception) {
      android.util.Log.e("PeaceAlarm", "onNewIntent: could not emit PeaceAlarmFired: ${e.message}")
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
