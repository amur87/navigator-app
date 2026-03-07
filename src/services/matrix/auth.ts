import matrixConfig, { hasDelegatedMatrixAuth } from '../../config/matrix';
import type { MatrixSession } from './types';

const buildMatrixUserId = (driverId: string) => {
    const localpart = `${matrixConfig.userIdPrefix}${driverId}`.replace(/[^a-zA-Z0-9._=\-/]/g, '_').toLowerCase();
    const hostname = matrixConfig.homeserverUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return `@${localpart}:${hostname}`;
};

export const createDelegatedMatrixSession = async (payload: { driverId: string; fleetbaseToken?: string; phone?: string | null }) => {
    if (!hasDelegatedMatrixAuth()) {
        throw new Error('Matrix delegated auth is not configured.');
    }

    const response = await fetch(matrixConfig.delegatedAuthUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(matrixConfig.delegatedAuthApiKey ? { 'X-API-Key': matrixConfig.delegatedAuthApiKey } : {}),
            ...(payload.fleetbaseToken ? { Authorization: `Bearer ${payload.fleetbaseToken}` } : {}),
        },
        body: JSON.stringify({
            driver_id: payload.driverId,
            phone: payload.phone,
        }),
    });

    const data = await response.json();
    if (!response.ok || !data?.access_token || !data?.user_id) {
        throw new Error(data?.error ?? 'Unable to authorize Matrix session.');
    }

    return {
        accessToken: data.access_token,
        deviceId: data.device_id,
        userId: data.user_id,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
        homeserverUrl: matrixConfig.homeserverUrl,
    } satisfies MatrixSession;
};

export const createPasswordMatrixSession = async (payload: { driverId: string; password: string }) => {
    const response = await fetch(`${matrixConfig.homeserverUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            type: 'm.login.password',
            identifier: {
                type: 'm.id.user',
                user: buildMatrixUserId(payload.driverId),
            },
            password: payload.password,
        }),
    });

    const data = await response.json();
    if (!response.ok || !data?.access_token || !data?.user_id) {
        throw new Error(data?.error ?? 'Unable to login to Matrix.');
    }

    return {
        accessToken: data.access_token,
        deviceId: data.device_id,
        userId: data.user_id,
        homeserverUrl: matrixConfig.homeserverUrl,
    } satisfies MatrixSession;
};

export const createMatrixAccessTokenSession = (payload: { accessToken: string; userId: string; deviceId?: string }) => {
    if (!payload.accessToken || !payload.userId) {
        throw new Error('Matrix access token session requires accessToken and userId.');
    }

    return {
        accessToken: payload.accessToken,
        userId: payload.userId,
        deviceId: payload.deviceId,
        homeserverUrl: matrixConfig.homeserverUrl,
    } satisfies MatrixSession;
};

export const buildSupportRoomSeed = () => ({
    roomId: matrixConfig.supportRoomId,
    phone: matrixConfig.callPhone,
});

