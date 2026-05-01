package com.peacealarm.app

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.util.Log

object AlarmSoundManager {
    private var player: MediaPlayer? = null
    private var focusRequest: AudioFocusRequest? = null

    fun stop() {
        val trace = Log.getStackTraceString(Throwable()).lines().take(8).joinToString("\n")
        Log.d("PeaceAlarm", "AlarmSoundManager.stop() called, player=${player != null}\n$trace")
        player?.apply {
            try { if (isPlaying) stop() } catch (e: Exception) { Log.e("PeaceAlarm", "AlarmSoundManager.stop error: ${e.message}") }
            release()
        }
        player = null
    }

    fun playUrl(context: Context, url: String, onError: () -> Unit) {
        Log.d("PeaceAlarm", "AlarmSoundManager.playUrl() called url=$url")
        stop()
        try {
            requestAudioFocus(context)
            val attr = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            val mp = MediaPlayer()
            mp.setAudioAttributes(attr)
            Log.d("PeaceAlarm", "AlarmSoundManager: setDataSource $url")
            mp.setDataSource(url)
            mp.isLooping = true
            mp.setOnErrorListener { _, what, extra ->
                Log.e("PeaceAlarm", "AlarmSoundManager: MediaPlayer error what=$what extra=$extra")
                onError()
                true
            }
            mp.setOnPreparedListener {
                Log.d("PeaceAlarm", "AlarmSoundManager: onPrepared — calling start()")
                it.start()
                Log.d("PeaceAlarm", "AlarmSoundManager: start() called, isPlaying=${it.isPlaying}")
            }
            mp.prepareAsync()
            Log.d("PeaceAlarm", "AlarmSoundManager: prepareAsync() called")
            player = mp
        } catch (e: Exception) {
            Log.e("PeaceAlarm", "AlarmSoundManager.playUrl exception: ${e.message}", e)
            onError()
        }
    }

    fun playFallback(context: Context) {
        Log.d("PeaceAlarm", "AlarmSoundManager.playFallback() called")
        stop()
        try {
            requestAudioFocus(context)
            val attr = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val uri = Uri.parse("android.resource://${context.packageName}/raw/alarm")
            Log.d("PeaceAlarm", "AlarmSoundManager: playFallback uri=$uri")
            val mp = MediaPlayer()
            mp.setAudioAttributes(attr)
            mp.setDataSource(context, uri)
            mp.isLooping = true
            mp.prepare()
            mp.start()
            Log.d("PeaceAlarm", "AlarmSoundManager: fallback started, isPlaying=${mp.isPlaying}")
            player = mp
        } catch (e: Exception) {
            Log.e("PeaceAlarm", "AlarmSoundManager.playFallback exception: ${e.message}", e)
        }
    }

    private fun requestAudioFocus(context: Context) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .build()
                )
                .setAcceptsDelayedFocusGain(false)
                .build()
            val result = am.requestAudioFocus(req)
            Log.d("PeaceAlarm", "AlarmSoundManager: requestAudioFocus result=$result")
            focusRequest = req
        } else {
            @Suppress("DEPRECATION")
            val result = am.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN)
            Log.d("PeaceAlarm", "AlarmSoundManager: requestAudioFocus (legacy) result=$result")
        }
    }
}
