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
        const loaded = require('react-native-config');
        EnvConfig = loaded?.default ?? loaded ?? {};
    } else {
        EnvConfig = typeof process !== 'undefined' ? process.env ?? {} : {};
    }
} catch (error) {
    EnvConfig = typeof process !== 'undefined' ? process.env ?? {} : {};
}

export default EnvConfig;
