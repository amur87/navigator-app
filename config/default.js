import EnvConfig from '../src/utils/env-config';

function getConfigValue(key, defaultValue = null) {
    const value = EnvConfig?.[key];

    return value === undefined || value === null || value === '' ? defaultValue : value;
}

function toArray(value, delimiter = ',') {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string') {
        return value.split(delimiter);
    }

    if (value == null) {
        return [];
    }

    return Array.from(value);
}

function mergeConfigs(defaultConfig = {}, targetConfig = {}) {
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

export const DefaultConfig = {
    theme: getConfigValue('APP_THEME', 'blue'),
    driverNavigator: {
        tabs: toArray(getConfigValue('DRIVER_NAVIGATOR_TABS', 'DriverDashboardTab,DriverTaskTab,DriverReportTab,DriverChatTab,DriverAccountTab')),
        defaultTab: toArray(getConfigValue('DRIVER_NAVIGATOR_DEFAULT_TAB', 'DriverDashboardTab')),
    },
    defaultLocale: getConfigValue('DEFAULT_LOCALE', 'ru'),
    colors: {
        loginBackground: getConfigValue('LOGIN_BG_COLOR', '#111827'),
    },
};

export function createNavigatorConfig(userConfig = {}) {
    return mergeConfigs(DefaultConfig, userConfig);
}
