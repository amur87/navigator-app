package io.delivery.max

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class MatrixConfigModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = NAME

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun getConfig(): WritableMap {
    return Arguments.createMap().apply {
      putString("MATRIX_ENABLED", BuildConfig.MATRIX_ENABLED)
      putString("MATRIX_HOMESERVER_URL", BuildConfig.MATRIX_HOMESERVER_URL)
      putString("MATRIX_AUTH_MODE", BuildConfig.MATRIX_AUTH_MODE)
      putString("MATRIX_ACCESS_TOKEN", BuildConfig.MATRIX_ACCESS_TOKEN)
      putString("MATRIX_USER_ID", BuildConfig.MATRIX_USER_ID)
      putString("MATRIX_DEVICE_ID", BuildConfig.MATRIX_DEVICE_ID)
      putString("MATRIX_SUPPORT_ROOM_ID", BuildConfig.MATRIX_SUPPORT_ROOM_ID)
      putString("MATRIX_SUPPORT_SPACE_ID", BuildConfig.MATRIX_SUPPORT_SPACE_ID)
      putString("MATRIX_E2EE_ENABLED", BuildConfig.MATRIX_E2EE_ENABLED)
    }
  }

  companion object {
    const val NAME = "MatrixConfigModule"
  }
}
