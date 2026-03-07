package io.delivery.max

import android.media.MediaPlayer
import android.media.MediaRecorder
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.IOException

class VoiceRecorderModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private var recorder: MediaRecorder? = null
  private var player: MediaPlayer? = null
  private var currentRecordingPath: String? = null

  override fun getName(): String = NAME

  @ReactMethod
  fun startRecording(outputPath: String, promise: Promise) {
    stopRecordingInternal()

    try {
      val mediaRecorder = MediaRecorder()
      mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC)
      mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
      mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      mediaRecorder.setAudioEncodingBitRate(128000)
      mediaRecorder.setAudioSamplingRate(44100)
      mediaRecorder.setOutputFile(outputPath)
      mediaRecorder.prepare()
      mediaRecorder.start()

      recorder = mediaRecorder
      currentRecordingPath = outputPath
      promise.resolve(outputPath)
    } catch (error: Exception) {
      stopRecordingInternal()
      promise.reject("VOICE_RECORD_START_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    val outputPath = currentRecordingPath

    try {
      recorder?.apply {
        stop()
        reset()
        release()
      }
      recorder = null
      currentRecordingPath = null
      promise.resolve(outputPath)
    } catch (error: Exception) {
      recorder = null
      currentRecordingPath = null
      promise.reject("VOICE_RECORD_STOP_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun startPlayback(source: String, promise: Promise) {
    stopPlaybackInternal()

    try {
      val mediaPlayer = MediaPlayer()
      mediaPlayer.setDataSource(source)
      mediaPlayer.setOnCompletionListener {
        stopPlaybackInternal()
      }
      mediaPlayer.prepare()
      mediaPlayer.start()
      player = mediaPlayer
      promise.resolve(source)
    } catch (error: IOException) {
      stopPlaybackInternal()
      promise.reject("VOICE_PLAYBACK_START_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun stopPlayback(promise: Promise) {
    try {
      stopPlaybackInternal()
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("VOICE_PLAYBACK_STOP_FAILED", error.message, error)
    }
  }

  private fun stopRecordingInternal() {
    try {
      recorder?.reset()
      recorder?.release()
    } catch (_: Exception) {
    }
    recorder = null
  }

  private fun stopPlaybackInternal() {
    try {
      player?.apply {
        if (isPlaying) {
          stop()
        }
        reset()
        release()
      }
    } catch (_: Exception) {
    }
    player = null
  }

  companion object {
    const val NAME = "VoiceRecorderModule"
  }
}
