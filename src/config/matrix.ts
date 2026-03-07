export type MatrixAuthMode = 'access_token' | 'password' | 'delegated_token';

import EnvConfig from '../utils/env-config';

const LOCAL_MATRIX_RUNTIME_FALLBACK = {
    MATRIX_ENABLED: 'true',
    MATRIX_HOMESERVER_URL: 'https://matrix.max.kg',
    MATRIX_AUTH_MODE: 'access_token',
    MATRIX_ACCESS_TOKEN: 'syt_ZGVsaXZlcnltYXg_DvzSWCNZwFagRfLYVPwd_0lD7xv',
    MATRIX_USER_ID: '@deliverymax:matrix.max.kg',
    MATRIX_DEVICE_ID: 'NFIDPJQGNE',
    MATRIX_RECOVERY_KEY: '',
    MATRIX_SUPPORT_SPACE_ID: '!CVJaFNObkpCaLtSLLI:matrix.max.kg',
    MATRIX_SUPPORT_ROOM_ID: '!aEGAzPUfwYmlswzuJu:matrix.max.kg',
    MATRIX_E2EE_ENABLED: 'false',
    MATRIX_AUTO_RESTORE_RECOVERY_KEY: 'false',
    MATRIX_MANAGED_WORK_CHAT: 'true',
    MATRIX_REQUIRE_UNENCRYPTED_ROOMS: 'true',
} as const;

const cleanEnvString = (value: unknown) => {
    if (value === null || value === undefined) {
        return '';
    }

    return `${value}`.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
};

const toBoolean = (value: unknown, fallback = false) => {
    const normalizedValue = cleanEnvString(value);
    if (typeof value === 'boolean') {
        return value;
    }

    if (normalizedValue) {
        const normalized = normalizedValue.toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) {
            return true;
        }
        if (['0', 'false', 'no', 'off'].includes(normalized)) {
            return false;
        }
    }

    return fallback;
};

const toNumber = (value: unknown, fallback: number) => {
    const parsed = Number(cleanEnvString(value));
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeBaseUrl = (value: unknown, fallback: string) => {
    const raw = cleanEnvString(value ?? fallback);
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
        return raw;
    }

    return `https://${raw}`;
};

export const matrixConfig = {
    enabled: toBoolean(EnvConfig.MATRIX_ENABLED ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_ENABLED, false),
    homeserverUrl: normalizeBaseUrl(EnvConfig.MATRIX_HOMESERVER_URL ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_HOMESERVER_URL, 'https://matrix.max.kg'),
    authMode: cleanEnvString(EnvConfig.MATRIX_AUTH_MODE ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_AUTH_MODE ?? 'delegated_token') as MatrixAuthMode,
    accessToken: cleanEnvString(EnvConfig.MATRIX_ACCESS_TOKEN ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_ACCESS_TOKEN),
    userId: cleanEnvString(EnvConfig.MATRIX_USER_ID ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_USER_ID),
    deviceId: cleanEnvString(EnvConfig.MATRIX_DEVICE_ID ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_DEVICE_ID),
    recoveryKey: cleanEnvString(EnvConfig.MATRIX_RECOVERY_KEY ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_RECOVERY_KEY),
    autoRestoreRecoveryKey: toBoolean(
        EnvConfig.MATRIX_AUTO_RESTORE_RECOVERY_KEY ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_AUTO_RESTORE_RECOVERY_KEY,
        false
    ),
    delegatedAuthUrl: cleanEnvString(EnvConfig.MATRIX_DELEGATED_AUTH_URL),
    delegatedAuthApiKey: cleanEnvString(EnvConfig.MATRIX_DELEGATED_AUTH_API_KEY),
    userIdPrefix: cleanEnvString(EnvConfig.MATRIX_USER_ID_PREFIX || 'driver_'),
    supportSpaceId: cleanEnvString(
        EnvConfig.MATRIX_SUPPORT_SPACE_ID ??
            EnvConfig.MATRIX_SUPPORT_ROOM_ID ??
            LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_SUPPORT_SPACE_ID
    ),
    supportRoomId: cleanEnvString(EnvConfig.MATRIX_SUPPORT_ROOM_ID ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_SUPPORT_ROOM_ID),
    callPhone: cleanEnvString(EnvConfig.MATRIX_SUPPORT_CALL_PHONE),
    syncTimeoutMs: toNumber(EnvConfig.MATRIX_SYNC_TIMEOUT_MS, 30000),
    pollIntervalMs: toNumber(EnvConfig.MATRIX_POLL_INTERVAL_MS, 10000),
    maxTimelineLimit: toNumber(EnvConfig.MATRIX_TIMELINE_LIMIT, 50),
    uploadMaxBytes: toNumber(EnvConfig.MATRIX_UPLOAD_MAX_BYTES, 25 * 1024 * 1024),
    e2eeEnabled: toBoolean(EnvConfig.MATRIX_E2EE_ENABLED ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_E2EE_ENABLED, false),
    managedWorkChat: toBoolean(EnvConfig.MATRIX_MANAGED_WORK_CHAT ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_MANAGED_WORK_CHAT, true),
    requireUnencryptedRooms: toBoolean(
        EnvConfig.MATRIX_REQUIRE_UNENCRYPTED_ROOMS ?? LOCAL_MATRIX_RUNTIME_FALLBACK.MATRIX_REQUIRE_UNENCRYPTED_ROOMS,
        true
    ),
};

export const hasMatrixConfig = () => {
    return matrixConfig.enabled && Boolean(matrixConfig.homeserverUrl);
};

export const hasDelegatedMatrixAuth = () => {
    return matrixConfig.authMode === 'delegated_token' && Boolean(matrixConfig.delegatedAuthUrl);
};

export default matrixConfig;

