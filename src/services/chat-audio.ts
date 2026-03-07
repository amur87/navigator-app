import { NativeModules, Platform } from 'react-native';

const nativeVoice = NativeModules.VoiceRecorderModule;

type ProgressCallback = (positionMs: number) => void;
type FinishCallback = () => void;

let playbackTimeout: ReturnType<typeof setTimeout> | null = null;
let activeFinishCallback: FinishCallback | null = null;

const ensureNativeVoice = () => {
    if (Platform.OS !== 'android' || !nativeVoice) {
        throw new Error('Голосовые сообщения доступны только на Android в текущей сборке.');
    }

    return nativeVoice;
};

const clearPlaybackTimeout = () => {
    if (playbackTimeout) {
        clearTimeout(playbackTimeout);
        playbackTimeout = null;
    }
};

export const startVoiceRecording = async (path: string, _onProgress?: ProgressCallback) => {
    const module = ensureNativeVoice();
    return module.startRecording(path);
};

export const stopVoiceRecording = async () => {
    const module = ensureNativeVoice();
    return module.stopRecording();
};

export const startVoicePlayback = async (uri: string, _onProgress?: ProgressCallback, onFinish?: FinishCallback, durationSeconds?: number) => {
    const module = ensureNativeVoice();
    clearPlaybackTimeout();
    activeFinishCallback = onFinish ?? null;
    await module.startPlayback(uri);

    if (durationSeconds && durationSeconds > 0) {
        playbackTimeout = setTimeout(() => {
            activeFinishCallback?.();
            activeFinishCallback = null;
            clearPlaybackTimeout();
        }, Math.ceil(durationSeconds * 1000));
    }

    return uri;
};

export const stopVoicePlayback = async () => {
    if (Platform.OS !== 'android' || !nativeVoice) {
        return;
    }

    clearPlaybackTimeout();
    activeFinishCallback = null;
    return nativeVoice.stopPlayback();
};

export const formatAudioDuration = (seconds = 0) => {
    const safeSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
};
