import * as Keychain from 'react-native-keychain';
import { storage } from '../../hooks/use-storage';
import type { MatrixSession } from './types';

const KEYCHAIN_SERVICE = 'io.delivery.max.matrix.session';
const FALLBACK_STORAGE_KEY = '_matrix_session';

export const saveMatrixSession = async (session: MatrixSession) => {
    const serialized = JSON.stringify(session);

    try {
        await Keychain.setGenericPassword('matrix', serialized, {
            service: KEYCHAIN_SERVICE,
            accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
    } catch (error) {
        storage.setMap(FALLBACK_STORAGE_KEY, session as any);
    }
};

export const loadMatrixSession = async (): Promise<MatrixSession | null> => {
    try {
        const credentials = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
        if (credentials && credentials.password) {
            return JSON.parse(credentials.password) as MatrixSession;
        }
    } catch (error) {
        // fall through to MMKV fallback
    }

    const cachedSession = storage.getMap(FALLBACK_STORAGE_KEY) as MatrixSession | null;
    if (cachedSession?.accessToken && cachedSession?.userId) {
        return cachedSession;
    }

    return null;
};

export const clearMatrixSession = async () => {
    try {
        await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    } catch (error) {
        // ignore keychain cleanup issues and clear fallback storage too
    }

    storage.removeItem(FALLBACK_STORAGE_KEY);
};

