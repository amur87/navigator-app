import React, { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import Env from '../utils/env-config';
import Config from '../../navigator.config';
import { navigatorConfig, config, toBoolean, get } from '../utils';

const ConfigContext = createContext();
const DEFAULT_FLEETBASE_HOST = 'https://api-delivery.max.kg';
const DEFAULT_FLEETBASE_KEY = 'flb_live_eH6tlC0R3Twu2ogNMV1o';

const normalizeConfigValue = (value: any) => {
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
};

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
    const resolveConnectionConfig = useCallback(
        (key, defaultValue = null) => {
            const fullConfig = {
                FLEETBASE_HOST: normalizeConfigValue(config('FLEETBASE_HOST', DEFAULT_FLEETBASE_HOST)),
                FLEETBASE_KEY: normalizeConfigValue(config('FLEETBASE_KEY', DEFAULT_FLEETBASE_KEY)),
                SOCKETCLUSTER_HOST: config('SOCKETCLUSTER_HOST', 'socket.fleetbase.io'),
                SOCKETCLUSTER_PORT: parseInt(config('SOCKETCLUSTER_PORT', '8000')),
                SOCKETCLUSTER_SECURE: toBoolean(config('SOCKETCLUSTER_SECURE', true)),
                SOCKETCLUSTER_PATH: config('SOCKETCLUSTER_PATH', '/socketcluster/'),
            };

            return get(fullConfig, key, defaultValue);
        },
        []
    );

    const value = useMemo(() => {
        return {
            ...Config,
            ...Env,
            navigatorConfig,
            config,
            resolveConnectionConfig,
        };
    }, [resolveConnectionConfig]);

    return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export const useConfig = (): ConfigContextValue => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
};
