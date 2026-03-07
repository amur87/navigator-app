import { NativeModules, Platform } from 'react-native';

export function playNotificationSound(): void {
    try {
        if (Platform.OS === 'android') {
            NativeModules.NotificationSound?.play();
        } else if (Platform.OS === 'ios') {
            // AudioServicesPlaySystemSound(1007) — standard notification
            NativeModules.AudioToolbox?.playSystemSound?.(1007);
        }
    } catch {
        // Sound playback is best-effort; vibration is the primary feedback.
    }
}
