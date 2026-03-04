import { useMemo, useState, useEffect, useCallback } from 'react';
import Fleetbase from '@fleetbase/sdk';
import { useConfig } from '../contexts/ConfigContext';
import useStorage from './use-storage';

const useFleetbase = () => {
    const { resolveConnectionConfig } = useConfig();

    const [error, setError] = useState<Error | null>(null);
    const [authToken] = useStorage('_driver_token');
    const [fleetbase, setFleetbase] = useState<Fleetbase | null>(null);

    const hasValidConnectionConfig = useCallback(() => {
        const host = resolveConnectionConfig('FLEETBASE_HOST');
        const key = resolveConnectionConfig('FLEETBASE_KEY');
        const hasHost = typeof host === 'string' && host.trim().length > 0;
        const hasTokenOrKey = typeof authToken === 'string' && authToken.trim().length > 0 ? true : typeof key === 'string' && key.trim().length > 0;

        return hasHost && hasTokenOrKey;
    }, [resolveConnectionConfig, authToken]);

    const initializeFleetbase = useCallback(() => {
        const host = resolveConnectionConfig('FLEETBASE_HOST');
        const key = resolveConnectionConfig('FLEETBASE_KEY');
        const tokenOrKey = typeof authToken === 'string' && authToken.trim().length > 0 ? authToken : key;

        if (typeof host !== 'string' || host.trim().length === 0 || typeof tokenOrKey !== 'string' || tokenOrKey.trim().length === 0) {
            setFleetbase(null);
            return;
        }

        try {
            const instance = new Fleetbase(tokenOrKey, { host });
            setFleetbase(instance);
            setError(null);
        } catch (initializationError) {
            setFleetbase(null);
            setError(initializationError as Error);
            console.warn('[useFleetbase] Failed to initialize SDK:', initializationError);
        }
    }, [resolveConnectionConfig, authToken]);

    const hasFleetbaseConfig = useCallback(() => {
        return hasValidConnectionConfig();
    }, [hasValidConnectionConfig]);

    useEffect(() => {
        initializeFleetbase();
    }, [initializeFleetbase]);

    // Memoize the adapter so that its reference only changes when the fleetbase instance updates.
    const adapter = useMemo(() => {
        if (!fleetbase) return null;
        return fleetbase.getAdapter();
    }, [fleetbase, authToken]);

    // Memoize the returned object to prevent unnecessary re-renders.
    const api = useMemo(
        () => ({
            fleetbase,
            adapter,
            error,
            hasFleetbaseConfig,
        }),
        [fleetbase, adapter, error, authToken, hasFleetbaseConfig]
    );

    return api;
};

export default useFleetbase;
