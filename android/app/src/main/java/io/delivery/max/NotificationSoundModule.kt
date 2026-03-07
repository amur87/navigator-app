package io.delivery.max

import android.media.RingtoneManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationSoundModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NotificationSound"

    @ReactMethod
    fun play() {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(reactApplicationContext, uri)
            ringtone?.play()
        } catch (_: Exception) {
            // best-effort
        }
    }
}
