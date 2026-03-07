import EnvConfig from './env-config';

export function config(key, defaultValue = null) {
    const value = EnvConfig?.[key];

    return value === undefined || value === null || value === '' ? defaultValue : value;
}

export function toBoolean(value) {
    switch (value) {
        case 'true':
        case '1':
        case 1:
        case true:
            return true;
        case 'false':
        case '0':
        case 0:
        case false:
        case null:
        case undefined:
        case '':
            return false;
        default:
            return false;
    }
}

export function mergeConfigs(defaultConfig = {}, targetConfig = {}) {
    if (typeof targetConfig !== 'object' || targetConfig === null) {
        return defaultConfig;
    }

    const result = { ...defaultConfig };

    for (const key in targetConfig) {
        if (
            typeof targetConfig[key] === 'object' &&
            targetConfig[key] !== null &&
            !Array.isArray(targetConfig[key]) &&
            typeof result[key] === 'object' &&
            result[key] !== null &&
            !Array.isArray(result[key])
        ) {
            result[key] = mergeConfigs(result[key], targetConfig[key]);
        } else {
            result[key] = targetConfig[key];
        }
    }

    return result;
}
