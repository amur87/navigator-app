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
        const hasKey = typeof key === 'string' && key.trim().length > 0;

        return hasHost && hasKey;
    }, [resolveConnectionConfig]);

    const initializeFleetbase = useCallback(() => {
        const host = resolveConnectionConfig('FLEETBASE_HOST');
        const key = resolveConnectionConfig('FLEETBASE_KEY');

        // Fleetbase SDK expects a public key on initialization.
        // Driver auth tokens are applied to the adapter header after init.
        if (typeof host !== 'string' || host.trim().length === 0 || typeof key !== 'string' || key.trim().length === 0) {
            setFleetbase(null);
            return;
        }

        try {
            const instance = new Fleetbase(key, { host });
            setFleetbase(instance);
            setError(null);
        } catch (initializationError) {
            setFleetbase(null);
            setError(initializationError as Error);
            console.warn('[useFleetbase] Failed to initialize SDK:', initializationError);
        }
    }, [resolveConnectionConfig]);

    const hasFleetbaseConfig = useCallback(() => {
        return hasValidConnectionConfig();
    }, [hasValidConnectionConfig]);

    useEffect(() => {
        initializeFleetbase();
    }, [initializeFleetbase]);

    // Memoize the adapter so that its reference only changes when the fleetbase instance updates.
    const adapter = useMemo(() => {
        if (!fleetbase) {
            return null;
        }
        return fleetbase.getAdapter();
    }, [fleetbase]);

    // Keep Authorization header in sync with the latest driver token.
    useEffect(() => {
        if (!adapter) {
            return;
        }

        const key = resolveConnectionConfig('FLEETBASE_KEY');
        const token = typeof authToken === 'string' && authToken.trim().length > 0 ? authToken.trim() : null;
        const publicKey = typeof key === 'string' ? key.trim() : '';
        const bearer = token ?? publicKey;

        // BrowserAdapter (fetch-based) uses setHeaders(); NodeAdapter/axios uses axiosInstance
        if (typeof adapter.setHeaders === 'function') {
            adapter.setHeaders({ Authorization: `Bearer ${bearer}` });
        } else if (adapter.axiosInstance?.defaults?.headers) {
            adapter.axiosInstance.defaults.headers.Authorization = `Bearer ${bearer}`;
        }

        // Also update headers directly if adapter stores them
        if (adapter.headers && typeof adapter.headers === 'object') {
            adapter.headers.Authorization = `Bearer ${bearer}`;
        }
    }, [adapter, authToken, resolveConnectionConfig]);

    // Memoize the returned object to prevent unnecessary re-renders.
    const api = useMemo(
        () => ({
            fleetbase,
            adapter,
            error,
            hasFleetbaseConfig,
        }),
        [fleetbase, adapter, error, hasFleetbaseConfig]
    );

    return api;
};

export default useFleetbase;
