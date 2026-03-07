let EnvConfig = {};
const isJest = typeof process !== 'undefined' && Boolean(process.env?.JEST_WORKER_ID);

let platform = null;
try {
    const { Platform } = require('react-native');
    platform = Platform?.OS ?? null;
} catch (error) {
    platform = null;
}

try {
    if (!isJest && platform !== 'web') {
        let reactNativeModule = null;
        try {
            reactNativeModule = require('react-native');
        } catch (reactNativeImportError) {
            reactNativeModule = null;
        }

        const loaded = require('react-native-config');
        const directConfig = loaded?.Config;
        const defaultConfig = loaded?.default;
        EnvConfig = directConfig ?? defaultConfig ?? loaded ?? {};

        if (!Object.keys(EnvConfig).length) {
            const nativeConfigFromBridge = reactNativeModule?.NativeModules?.RNCConfigModule?.getConfig?.()?.config;
            if (nativeConfigFromBridge && Object.keys(nativeConfigFromBridge).length) {
                EnvConfig = nativeConfigFromBridge;
            }
        }

        if (!Object.keys(EnvConfig).length) {
            const matrixNativeConfig = reactNativeModule?.NativeModules?.MatrixConfigModule?.getConfig?.();
            if (matrixNativeConfig && Object.keys(matrixNativeConfig).length) {
                EnvConfig = matrixNativeConfig;
            }
        }

        if (!Object.keys(EnvConfig).length) {
            try {
                const nativeConfigModule = require('react-native-config/codegen/NativeConfigModule')?.default;
                const nativeConfig = nativeConfigModule?.getConfig?.()?.config;
                if (nativeConfig && Object.keys(nativeConfig).length) {
                    EnvConfig = nativeConfig;
                }
            } catch (nativeModuleError) {
                // ignore and keep fallback path below
            }
        }
    } else {
        EnvConfig = typeof process !== 'undefined' ? process.env ?? {} : {};
    }
} catch (error) {
    EnvConfig = typeof process !== 'undefined' ? process.env ?? {} : {};
}

export default EnvConfig;
