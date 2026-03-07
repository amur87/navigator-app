import * as RNFS from 'react-native-fs';
import * as Keychain from 'react-native-keychain';
import type { MatrixMessage, MatrixParticipant, MatrixRoom, MatrixSession } from './types';
import matrixConfig from '../../config/matrix';

const KEYCHAIN_SERVICE = 'io.delivery.max.matrix.e2ee';
const RECOVERY_KEY_SERVICE = `${KEYCHAIN_SERVICE}.recovery`;
const DEFAULT_LIMIT = 50;
const EVENT_ID_TAG = 'EventId';
const TRANSACTION_ID_TAG = 'TransactionId';
const TIMELINE_CONTENT_MSGLIKE_TAG = 'MsgLike';
const MSGLIKE_MESSAGE_TAG = 'Message';
const MSGLIKE_STICKER_TAG = 'Sticker';
const MSGLIKE_UNABLE_TO_DECRYPT_TAG = 'UnableToDecrypt';
const MSGLIKE_REDACTED_TAG = 'Redacted';
const DIFF_APPEND_TAG = 'Append';
const DIFF_PUSH_FRONT_TAG = 'PushFront';
const DIFF_PUSH_BACK_TAG = 'PushBack';
const DIFF_POP_FRONT_TAG = 'PopFront';
const DIFF_POP_BACK_TAG = 'PopBack';
const DIFF_INSERT_TAG = 'Insert';
const DIFF_SET_TAG = 'Set';
const DIFF_REMOVE_TAG = 'Remove';
const DIFF_TRUNCATE_TAG = 'Truncate';
const DIFF_RESET_TAG = 'Reset';
const DIFF_CLEAR_TAG = 'Clear';

let matrixSdkRuntimeCache: any | null = null;
let matrixSdkUnavailable = false;

const getMatrixSdk = () => {
    if (matrixSdkUnavailable) {
        return null;
    }

    if (matrixSdkRuntimeCache) {
        return matrixSdkRuntimeCache;
    }

    try {
        matrixSdkRuntimeCache = require('@unomed/react-native-matrix-sdk');
        return matrixSdkRuntimeCache;
    } catch (error) {
        matrixSdkUnavailable = true;
        console.warn('Matrix native E2EE SDK is unavailable on this device.');
        return null;
    }
};

const getUniffiInitAsync = () => {
    const matrixSdk = getMatrixSdk();
    return matrixSdk?.uniffiInitAsync ?? (async () => undefined);
};

const getEnumLabel = (enumObject: Record<string, string | number> | undefined, value: string | number | undefined) => {
    if (!enumObject || value == null) {
        return value;
    }

    if (typeof value === 'string') {
        return value;
    }

    return enumObject[value] ?? value;
};

const toBigInt = (value?: number) => (typeof value === 'number' && Number.isFinite(value) ? BigInt(Math.max(0, Math.floor(value))) : undefined);

const normalizeFilePath = (value?: string | null) => {
    if (!value) {
        return null;
    }

    return value.startsWith('file://') ? value.replace('file://', '') : value;
};

const buildMediaLabel = (fileName?: string, fallback = 'Файл') => fileName || fallback;

const UTD_CAUSE_MESSAGE_MAP: Record<number, string> = {
    0: 'Не удалось расшифровать сообщение на этом устройстве.',
    1: 'Сообщение отправлено до того, как это устройство вошло в комнату.',
    2: 'Устройство не доверяет отправителю после нарушения верификации.',
    3: 'Устройство отправителя не подписано владельцем.',
    4: 'Не удалось безопасно получить устройство отправителя.',
    5: 'История недоступна: на сервере отключен ключевой backup.',
    6: 'Ключи withheld: устройство не подтверждено или считается небезопасным.',
    7: 'Отправитель не поделился ключами для этого устройства.',
    8: 'Нужно подтвердить это устройство, чтобы расшифровать историю.',
};

const mapUtdCauseToMessage = (cause?: unknown) => {
    if (typeof cause !== 'number') {
        return UTD_CAUSE_MESSAGE_MAP[0];
    }

    return UTD_CAUSE_MESSAGE_MAP[cause] ?? UTD_CAUSE_MESSAGE_MAP[0];
};

const buildE2eeStatusText = (bootstrapState?: Record<string, any>) => {
    if (!bootstrapState) {
        return '';
    }

    if (bootstrapState.backupExists && !bootstrapState.hasStoredRecoveryKey) {
        if (bootstrapState.hasDevicesToVerifyAgainst && !bootstrapState.ownIdentityVerified) {
            return 'История сообщений недоступна: сначала подтвердите это устройство в Matrix, затем восстановите backup keys.';
        }

        return 'История сообщений недоступна: для расшифровки нужен recovery key от backup ключей Matrix.';
    }

    if (bootstrapState.hasDevicesToVerifyAgainst && !bootstrapState.ownIdentityVerified) {
        return 'Для полной расшифровки истории нужно подтвердить это устройство в Matrix.';
    }

    return '';
};

const normalizeMatrixMediaUrl = (value?: string | null) => {
    if (!value) {
        return undefined;
    }

    if (!value.startsWith('mxc://')) {
        return value;
    }

    const mediaPath = value.replace('mxc://', '');
    return `${matrixConfig.homeserverUrl}/_matrix/media/v3/download/${mediaPath}`;
};

const buildSessionPaths = (session: MatrixSession) => {
    const safeUser = session.userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeDevice = `${session.deviceId || 'device'}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const baseDir = `${RNFS.DocumentDirectoryPath}/matrix/${safeUser}/${safeDevice}`;

    return {
        dataPath: `${baseDir}/data`,
        cachePath: `${baseDir}/cache`,
        logsPath: `${baseDir}/logs`,
    };
};

const ensureDirectory = async (path: string) => {
    const exists = await RNFS.exists(path);
    if (!exists) {
        await RNFS.mkdir(path);
    }
};

const ensureSessionDirectories = async (session: MatrixSession) => {
    const paths = buildSessionPaths(session);
    await ensureDirectory(`${RNFS.DocumentDirectoryPath}/matrix`);
    await ensureDirectory(`${RNFS.DocumentDirectoryPath}/matrix/${session.userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
    await ensureDirectory(`${RNFS.DocumentDirectoryPath}/matrix/${session.userId.replace(/[^a-zA-Z0-9_-]/g, '_')}/${`${session.deviceId || 'device'}`.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
    await ensureDirectory(paths.dataPath);
    await ensureDirectory(paths.cachePath);
    await ensureDirectory(paths.logsPath);
    return paths;
};

const buildParticipantFallback = (name?: string, userId?: string) => `${name || userId || 'M'}`.slice(0, 1).toUpperCase();

const mapMatrixUserIdToName = (userId: string) => {
    const normalized = userId.replace(/^@/, '').split(':')[0].replace(/[._-]+/g, ' ').trim();
    return normalized ? normalized.replace(/\b\w/g, (char) => char.toUpperCase()) : userId;
};

const mapSendState = (event: any): MatrixMessage['status'] => {
    const state = event?.localSendState?.tag;
    if (state === 'NotSentYet') {
        return 'sending';
    }
    if (state === 'SendingFailed') {
        return 'failed';
    }
    return 'sent';
};

const mapMediaMessage = (kind: any, event: any, roomId: string): MatrixMessage | null => {
    const content = kind?.inner?.content;
    if (!content) {
        return null;
    }

    const messageTypeTag = content?.msgType?.tag;
    const messageTypeContent = content?.msgType?.inner?.content;
    const body = content?.body ?? messageTypeContent?.body ?? '';
    const base = buildBaseMessage(event, roomId);

    if (messageTypeTag === 'Image') {
        return {
            ...base,
            type: 'image',
            content: body || 'Фото',
            body,
            fileName: messageTypeContent?.filename || body,
            mimeType: messageTypeContent?.info?.mimetype,
            size: Number(messageTypeContent?.info?.size || 0) || undefined,
            url: normalizeMatrixMediaUrl(messageTypeContent?.source?.url?.()),
        };
    }

    if (messageTypeTag === 'File') {
        return {
            ...base,
            type: 'file',
            content: body || 'Файл',
            body,
            fileName: messageTypeContent?.filename || body,
            mimeType: messageTypeContent?.info?.mimetype,
            size: Number(messageTypeContent?.info?.size || 0) || undefined,
            url: normalizeMatrixMediaUrl(messageTypeContent?.source?.url?.()),
        };
    }

    if (messageTypeTag === 'Audio') {
        return {
            ...base,
            type: 'audio',
            content: body || 'Голосовое сообщение',
            body,
            fileName: messageTypeContent?.filename || body,
            mimeType: messageTypeContent?.info?.mimetype,
            size: Number(messageTypeContent?.info?.size || 0) || undefined,
            durationSeconds: messageTypeContent?.info?.duration ? Number(messageTypeContent?.info?.duration?.secs || 0) : undefined,
            url: normalizeMatrixMediaUrl(messageTypeContent?.source?.url?.()),
        };
    }

    if (messageTypeTag === 'Location') {
        return {
            ...base,
            type: 'location',
            content: messageTypeContent?.body || body || 'Геопозиция',
            body,
            geoUri: messageTypeContent?.geoUri,
        };
    }

    return {
        ...base,
        type: 'text',
        content: body,
        body,
    };
};

const buildBaseMessage = (event: any, roomId: string): MatrixMessage => {
    const senderId = event?.sender || 'matrix';
    const eventId =
        event?.eventOrTransactionId?.tag === EVENT_ID_TAG
            ? event?.eventOrTransactionId?.inner?.eventId
            : undefined;
    const transactionId =
        event?.eventOrTransactionId?.tag === TRANSACTION_ID_TAG
            ? event?.eventOrTransactionId?.inner?.transactionId
            : undefined;

    const senderName = event?.senderProfile?.displayName || mapMatrixUserIdToName(senderId);
    const createdAtMs = Number(event?.timestamp || event?.localCreatedAt || Date.now());

    return {
        id: eventId || transactionId || `mx-${createdAtMs}`,
        eventId,
        transactionId,
        roomId,
        type: 'text',
        content: '',
        body: '',
        createdAt: new Date(createdAtMs).toISOString(),
        sender: {
            id: senderId,
            userId: senderId,
            name: senderName,
            avatarUrl: event?.senderProfile?.avatarUrl || null,
            avatarFallback: buildParticipantFallback(senderName, senderId),
        },
        status: mapSendState(event),
        isOutgoing: Boolean(event?.isOwn),
    };
};

const mapTimelineEventToMessage = (timelineItem: any, roomId: string): MatrixMessage | null => {
    const event = timelineItem?.asEvent?.();
    if (!event) {
        return null;
    }

    const content = event.content;
    if (!content) {
        console.log('[MatrixE2EE] mapTimelineEventToMessage:missingContent', JSON.stringify({ roomId }));
        return null;
    }

    if (content.tag === TIMELINE_CONTENT_MSGLIKE_TAG) {
        const msgLike = content.inner?.content;
        const kind = msgLike?.kind;
        if (!kind) {
            console.log('[MatrixE2EE] mapTimelineEventToMessage:missingMsgLikeKind', JSON.stringify({ roomId, contentTag: content.tag ?? null }));
            return null;
        }

        if (kind.tag === MSGLIKE_MESSAGE_TAG) {
            return mapMediaMessage(kind, event, roomId);
        }

        if (kind.tag === MSGLIKE_STICKER_TAG) {
            const base = buildBaseMessage(event, roomId);
            return {
                ...base,
                type: 'sticker',
                content: kind.inner?.body || 'Стикер',
                body: kind.inner?.body || 'Стикер',
                url: normalizeMatrixMediaUrl(kind.inner?.source?.url?.()),
            };
        }

        if (kind.tag === MSGLIKE_UNABLE_TO_DECRYPT_TAG) {
            const base = buildBaseMessage(event, roomId);
            const cause = kind.inner?.msg?.inner?.cause;
            const text = mapUtdCauseToMessage(cause);
            return {
                ...base,
                type: 'system',
                content: text,
                body: text,
            };
        }

        if (kind.tag === MSGLIKE_REDACTED_TAG) {
            const base = buildBaseMessage(event, roomId);
            return {
                ...base,
                type: 'system',
                content: 'Сообщение удалено',
                body: 'Сообщение удалено',
            };
        }

        console.log(
            '[MatrixE2EE] mapTimelineEventToMessage:unhandledMsgLike',
            JSON.stringify({ roomId, kindTag: kind.tag ?? null, contentTag: content.tag ?? null })
        );
        return null;
    }

    console.log('[MatrixE2EE] mapTimelineEventToMessage:unhandledContent', JSON.stringify({ roomId, contentTag: content.tag ?? null }));
    return null;
};

const applyTimelineDiffs = (items: any[], diffs: any[]) => {
    const next = [...items];

    diffs.forEach((diff) => {
        switch (diff.tag) {
            case DIFF_APPEND_TAG:
                next.push(...diff.inner.values);
                break;
            case DIFF_PUSH_FRONT_TAG:
                next.unshift(diff.inner.value);
                break;
            case DIFF_PUSH_BACK_TAG:
                next.push(diff.inner.value);
                break;
            case DIFF_POP_FRONT_TAG:
                next.shift();
                break;
            case DIFF_POP_BACK_TAG:
                next.pop();
                break;
            case DIFF_INSERT_TAG:
                next.splice(diff.inner.index, 0, diff.inner.value);
                break;
            case DIFF_SET_TAG:
                next[diff.inner.index] = diff.inner.value;
                break;
            case DIFF_REMOVE_TAG:
                next.splice(diff.inner.index, 1);
                break;
            case DIFF_TRUNCATE_TAG:
                next.length = diff.inner.length;
                break;
            case DIFF_RESET_TAG:
                next.splice(0, next.length, ...diff.inner.values);
                break;
            case DIFF_CLEAR_TAG:
                next.length = 0;
                break;
            default:
                break;
        }
    });

    return next;
};

const buildFeedDedupeKey = (message: MatrixMessage) => {
    if (message.eventId) {
        return `event:${message.eventId}`;
    }

    if (message.transactionId) {
        return `txn:${message.sender.userId}:${message.transactionId}`;
    }

    return `fallback:${message.sender.userId}:${message.type}:${message.content}:${message.fileName || ''}:${message.geoUri || ''}`;
};

const isSameOutgoingEcho = (left: MatrixMessage, right: MatrixMessage) => {
    if (!left.isOutgoing || !right.isOutgoing) {
        return false;
    }

    return (
        left.sender.userId === right.sender.userId &&
        left.type === right.type &&
        left.content === right.content &&
        (left.fileName || '') === (right.fileName || '') &&
        (left.url || '') === (right.url || '') &&
        (left.geoUri || '') === (right.geoUri || '')
    );
};

const dedupeFeed = (feed: MatrixMessage[]) => {
    const result: MatrixMessage[] = [];
    const keyIndex = new Map<string, number>();

    feed.forEach((message) => {
        const exactKey = buildFeedDedupeKey(message);
        const exactIndex = keyIndex.get(exactKey);
        if (typeof exactIndex === 'number') {
            const existing = result[exactIndex];
            if (existing.status === 'sending' && message.status !== 'sending') {
                result[exactIndex] = message;
            }
            return;
        }

        const echoIndex = result.findIndex((existing) => isSameOutgoingEcho(existing, message));
        if (echoIndex >= 0) {
            const existing = result[echoIndex];
            if (existing.status === 'sending' && message.status !== 'sending') {
                result[echoIndex] = message;
                keyIndex.set(exactKey, echoIndex);
            }
            return;
        }

        keyIndex.set(exactKey, result.length);
        result.push(message);
    });

    return result;
};

const mapTimelineItemsToFeed = (items: any[], roomId: string) => {
    const mapped = items.map((item) => mapTimelineEventToMessage(item, roomId)).filter(Boolean) as MatrixMessage[];
    return dedupeFeed(mapped);
};

const getIteratorMembers = async (iterator: any) => {
    const members: any[] = [];
    let chunk = iterator?.nextChunk?.(50);

    while (chunk && chunk.length > 0) {
        members.push(...chunk);
        chunk = iterator.nextChunk(50);
    }

    return members;
};

const mapMembersToParticipants = (members: any[]): MatrixParticipant[] => {
    return members.map((member) => {
        const name = member.displayName || mapMatrixUserIdToName(member.userId);
        return {
            id: member.userId,
            userId: member.userId,
            name,
            avatarUrl: member.avatarUrl || null,
            avatarFallback: buildParticipantFallback(name, member.userId),
            isOnline: member.membership === 'Join' || member.membership === 'Joined',
        };
    });
};

const saveRecoveryKey = async (recoveryKey: string) => {
    if (!recoveryKey) {
        return;
    }

    await Keychain.setGenericPassword('matrix-recovery', recoveryKey, {
        service: RECOVERY_KEY_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
};

const loadRecoveryKey = async () => {
    try {
        const credentials = await Keychain.getGenericPassword({ service: RECOVERY_KEY_SERVICE });
        if (!credentials) {
            return undefined;
        }

        return credentials.password || undefined;
    } catch (error) {
        console.warn('Matrix E2EE recovery key load failed:', error);
        return undefined;
    }
};

const getConfiguredRecoveryKey = () => {
    const recoveryKey = `${matrixConfig.recoveryKey || ''}`.trim();
    if (!recoveryKey || !matrixConfig.autoRestoreRecoveryKey) {
        return undefined;
    }

    return recoveryKey;
};

const ensureReadableUriPath = async (asset: { uri?: string; fileCopyUri?: string; name?: string; fileName?: string }) => {
    const directPath = normalizeFilePath(asset.fileCopyUri || asset.uri);
    if (directPath && (await RNFS.exists(directPath))) {
        return directPath;
    }

    throw new Error('Локальный путь к файлу не найден. Для отправки выбери файл из локального хранилища устройства.');
};

class MatrixE2EEClient {
    private initPromise: Promise<void> | null = null;
    private bootstrapPromise: Promise<void> | null = null;
    private client: any = null;
    private syncService: any = null;
    private currentSessionKey: string | null = null;
    private activeRoomId: string | null = null;
    private activeTimeline: any = null;
    private activeTimelineHandle: any = null;
    private activeTimelineItems: any[] = [];
    private activeRoomListener: ((room: MatrixRoom) => void) | null = null;
    private bootstrapState: any = null;
    private roomSnapshotCache = new Map<string, MatrixRoom>();
    private utdDelegateRegistered = false;

    private readTimelineItems(timeline: any) {
        return Array.isArray(timeline?.items?.()) ? timeline.items() : [];
    }

    private async initNative() {
        if (!this.initPromise) {
            const initAsync = getUniffiInitAsync();
            this.initPromise = typeof initAsync === 'function' ? initAsync() : Promise.resolve();
        }

        await this.initPromise;
    }

    private toSdkSession(session: MatrixSession) {
        const { Session, SlidingSyncVersion } = getMatrixSdk();
        if (!Session || !SlidingSyncVersion) {
            throw new Error('Matrix E2EE SDK is unavailable.');
        }
        return Session.new({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            userId: session.userId,
            deviceId: session.deviceId || 'RNMATRIX',
            homeserverUrl: session.homeserverUrl,
            oidcData: undefined,
            slidingSyncVersion: SlidingSyncVersion.Native,
        });
    }

    async ensureReady(session: MatrixSession) {
        await this.initNative();

        const sessionKey = `${session.userId}:${session.deviceId || 'RNMATRIX'}`;
        if (this.client && this.currentSessionKey === sessionKey) {
            return this.client;
        }

        if (this.bootstrapPromise) {
            await this.bootstrapPromise;
            if (this.client && this.currentSessionKey === sessionKey) {
                return this.client;
            }
        }

        this.bootstrapPromise = (async () => {
            await this.destroy();

            const paths = await ensureSessionDirectories(session);
            const { BackupDownloadStrategy, ClientBuilder, UtdCause } = getMatrixSdk();
            if (!ClientBuilder) {
                throw new Error('Matrix E2EE SDK is unavailable.');
            }
            const builder = new ClientBuilder()
                .homeserverUrl(session.homeserverUrl)
                .sessionPaths(paths.dataPath, paths.cachePath)
                .autoEnableCrossSigning(true)
                .autoEnableBackups(true)
                .backupDownloadStrategy(BackupDownloadStrategy?.OneShot ?? 1)
                .enableShareHistoryOnInvite(true)
                .userAgent('max-driver-rn/2.0');

            const client = await builder.build();
            await client.restoreSession(this.toSdkSession(session));
            if (!this.utdDelegateRegistered && typeof client.setUtdDelegate === 'function') {
                try {
                    await client.setUtdDelegate({
                        onUtd: (info: any) => {
                            console.warn(
                                '[MatrixE2EE] UTD',
                                JSON.stringify({
                                    eventId: info?.eventId ?? null,
                                    cause: getEnumLabel(UtdCause, info?.cause),
                                    eventLocalAgeMillis: info?.eventLocalAgeMillis ?? null,
                                    timeToDecryptMs: info?.timeToDecryptMs ?? null,
                                    userTrustsOwnIdentity: info?.userTrustsOwnIdentity ?? null,
                                    senderHomeserver: info?.senderHomeserver ?? null,
                                    ownHomeserver: info?.ownHomeserver ?? null,
                                })
                            );
                        },
                    });
                    this.utdDelegateRegistered = true;
                } catch (error) {
                    console.warn('Matrix E2EE UTD delegate setup failed:', error);
                }
            }
            const encryption = client.encryption();

            await encryption.waitForE2eeInitializationTasks();

            let recoveryKey: string | undefined;
            let backupExists = false;
            let hasStoredRecoveryKey = false;
            try {
                backupExists = await encryption.backupExistsOnServer();
                if (!backupExists) {
                    await encryption.enableBackups();
                    recoveryKey = await encryption.enableRecovery(false, undefined, { onUpdate: () => {} });
                    await saveRecoveryKey(recoveryKey);
                } else {
                    recoveryKey = getConfiguredRecoveryKey() || (await loadRecoveryKey());
                    hasStoredRecoveryKey = Boolean(recoveryKey);
                    if (recoveryKey) {
                        await saveRecoveryKey(recoveryKey);
                        console.log('[MatrixE2EE] recovering existing backup with stored recovery key');
                        await encryption.recover(recoveryKey);
                        await encryption.waitForE2eeInitializationTasks();
                    } else {
                        console.warn('[MatrixE2EE] backup exists on server but no local recovery key is available');
                    }
                }
            } catch (error) {
                console.warn('Matrix E2EE backup bootstrap failed:', error);
            }

            let hasDevicesToVerifyAgainst = false;
            let ownIdentityVerified: boolean | null = null;
            let ownIdentityHasViolation: boolean | null = null;
            try {
                hasDevicesToVerifyAgainst = await encryption.hasDevicesToVerifyAgainst();
                const ownIdentity = await encryption.userIdentity(session.userId, true);
                if (ownIdentity) {
                    ownIdentityVerified = ownIdentity.isVerified();
                    ownIdentityHasViolation = ownIdentity.hasVerificationViolation();
                }
            } catch (error) {
                console.warn('Matrix E2EE verification diagnostics failed:', error);
            }

            const syncService = await client.syncService().finish();
            await syncService.start();

            this.client = client;
            this.syncService = syncService;
            this.currentSessionKey = sessionKey;
            this.bootstrapState = {
                backupState: encryption.backupState?.() ?? 'Unknown',
                recoveryState: encryption.recoveryState?.() ?? 'Unknown',
                verificationState: encryption.verificationState?.() ?? 'Unknown',
                curve25519Key: await encryption.curve25519Key(),
                ed25519Key: await encryption.ed25519Key(),
                recoveryKey,
                backupExists,
                hasStoredRecoveryKey,
                hasDevicesToVerifyAgainst,
                ownIdentityVerified,
                ownIdentityHasViolation,
            };
            console.log('[MatrixE2EE] bootstrapState', JSON.stringify(this.bootstrapState));
        })();

        try {
            await this.bootstrapPromise;
        } finally {
            this.bootstrapPromise = null;
        }

        return this.client;
    }

    async destroy() {
        this.clearActiveRoomSubscription();

        if (this.syncService) {
            try {
                await this.syncService.stop();
            } catch (error) {
                // ignore
            }
        }

        this.activeTimeline = null;
        this.activeTimelineHandle = null;
        this.activeTimelineItems = [];
        this.activeRoomId = null;
        this.activeRoomListener = null;
        this.syncService = null;
        this.client = null;
        this.currentSessionKey = null;
        this.bootstrapState = null;
        this.roomSnapshotCache.clear();
        this.utdDelegateRegistered = false;
    }

    clearActiveRoomSubscription() {
        if (this.activeTimelineHandle) {
            try {
                this.activeTimelineHandle.cancel();
            } catch (error) {
                // ignore
            }
        }

        this.activeTimeline = null;
        this.activeTimelineHandle = null;
        this.activeTimelineItems = [];
        this.activeRoomId = null;
        this.activeRoomListener = null;
    }

    private async buildRoomPayload(room: any, items: any[]): Promise<MatrixRoom> {
        const roomId = room.id();
        const membersIterator = await room.membersNoSync();
        const participants = mapMembersToParticipants(await getIteratorMembers(membersIterator));
        const feed = mapTimelineItemsToFeed(items, roomId);
        const latestMessage = feed[feed.length - 1];
        const title = room.displayName() || room.rawName() || 'Чат';
        const isEncrypted = await room.isEncrypted();
        const e2eeStatusText = buildE2eeStatusText(this.bootstrapState);
        console.log(
            '[MatrixE2EE] buildRoomPayload',
            JSON.stringify({ roomId, itemCount: items.length, feedCount: feed.length, latestMessageType: latestMessage?.type ?? null })
        );

        return {
            id: roomId,
            roomId,
            title,
            subtitle: isEncrypted ? 'Matrix E2EE' : 'Matrix',
            avatarUrl: room.avatarUrl() || null,
            avatarFallback: buildParticipantFallback(title, roomId),
            statusText: isEncrypted ? 'Сквозное шифрование активно' : 'Matrix',
            unreadCount: 0,
            updatedAt: latestMessage?.createdAt || new Date().toISOString(),
            lastMessagePreview: latestMessage?.content || 'Нет сообщений',
            participants,
            feed,
            isDirect: await room.isDirect(),
            isEncrypted,
            raw: {
                e2ee: true,
                e2eeBootstrap: this.bootstrapState,
                e2eeStatusText,
                requiresInvite: false,
            },
        };
    }

    async listRooms(session: MatrixSession) {
        const client = await this.ensureReady(session);
        const rooms = client.rooms?.() ?? [];
        const payloads = await Promise.all(
            rooms.map(async (room: any) => {
                let items: any[] = [];

                try {
                    const timeline = await room.timeline();
                    try {
                        await timeline.paginateBackwards(10);
                    } catch (error) {
                        // ignore pagination failures for list preview
                    }
                    items = Array.isArray(timeline.items?.()) ? timeline.items() : [];
                } catch (error) {
                    // ignore timeline bootstrap failures for list preview
                }

                const payload = await this.buildRoomPayload(room, items);
                this.roomSnapshotCache.set(payload.roomId, payload);
                return payload;
            })
        );

        return payloads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    getCachedRoom(roomId: string) {
        return this.roomSnapshotCache.get(roomId) ?? null;
    }

    async subscribeToRoom(session: MatrixSession, roomId: string, onUpdate: (room: MatrixRoom) => void) {
        const client = await this.ensureReady(session);
        const room = client.getRoom(roomId);

        if (!room) {
            throw new Error('Matrix room not found in local sync state.');
        }

        if (this.activeTimelineHandle) {
            try {
                this.activeTimelineHandle.cancel();
            } catch (error) {
                // ignore
            }
        }

        this.activeRoomId = roomId;
        this.activeRoomListener = onUpdate;
        this.activeTimelineItems = [];
        this.activeTimeline = await room.timeline();

        let initialResolved = false;
        let resolveInitial: (value: MatrixRoom) => void = () => undefined;
        const initialRoomPromise = new Promise<MatrixRoom>((resolve) => {
            resolveInitial = resolve;
        });

        const emitRoom = async () => {
            const payload = await this.buildRoomPayload(room, this.activeTimelineItems);
            this.activeRoomListener?.(payload);
            if (!initialResolved) {
                initialResolved = true;
                resolveInitial(payload);
            }
        };

        this.activeTimelineHandle = await this.activeTimeline.addListener({
            onUpdate: (diffs: any[]) => {
                this.activeTimelineItems = applyTimelineDiffs(this.activeTimelineItems, diffs);
                emitRoom().catch((error) => console.warn('Matrix E2EE timeline update failed:', error));
            },
        });

        try {
            await this.activeTimeline.paginateBackwards(DEFAULT_LIMIT);
        } catch (error) {
            console.warn('Matrix E2EE initial pagination failed:', error);
        }

        this.activeTimelineItems = this.readTimelineItems(this.activeTimeline);

        setTimeout(() => {
            if (!initialResolved) {
                emitRoom().catch((error) => console.warn('Matrix E2EE initial emit failed:', error));
            }
        }, 750);

        return initialRoomPromise;
    }

    private async getActiveTimeline(roomId: string) {
        if (this.activeRoomId === roomId && this.activeTimeline) {
            return this.activeTimeline;
        }

        const room = this.client?.getRoom(roomId);
        if (!room) {
            throw new Error('Matrix room not available for E2EE action.');
        }

        return room.timeline();
    }

    async refreshActiveRoom() {
        if (!this.client || !this.activeRoomId) {
            return null;
        }

        const room = this.client.getRoom(this.activeRoomId);
        if (!room) {
            return null;
        }

        return this.buildRoomPayload(room, this.activeTimelineItems);
    }

    async sendTextMessage(roomId: string, message: string) {
        const timeline = await this.getActiveTimeline(roomId);
        const { messageEventContentFromMarkdown } = getMatrixSdk();
        if (!messageEventContentFromMarkdown) {
            throw new Error('Matrix E2EE SDK is unavailable.');
        }
        console.log('[MatrixE2EE] sendTextMessage:start', JSON.stringify({ roomId, messageLength: message.length }));
        const payload = messageEventContentFromMarkdown(message);
        const handle = await timeline.send(payload);
        console.log('[MatrixE2EE] sendTextMessage:queued', JSON.stringify({ roomId, hasHandle: Boolean(handle) }));
        if (this.activeRoomId === roomId && this.activeRoomListener) {
            this.activeTimelineItems = this.readTimelineItems(timeline);
            const refreshedRoom = await this.refreshActiveRoom();
            if (refreshedRoom) {
                this.activeRoomListener(refreshedRoom);
            }
        }
    }

    async sendLocationMessage(roomId: string, coords: { latitude: number; longitude: number }) {
        const timeline = await this.getActiveTimeline(roomId);
        const body = `Геопозиция: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        await timeline.sendLocation(body, `geo:${coords.latitude},${coords.longitude}`, undefined, undefined, undefined, undefined);
    }

    async sendImageAttachment(roomId: string, asset: { uri: string; fileName?: string; type?: string; fileSize?: number }) {
        const timeline = await this.getActiveTimeline(roomId);
        const filePath = await ensureReadableUriPath(asset);
        const { UploadParameters, UploadSource, ImageInfo } = getMatrixSdk();
        if (!UploadParameters || !UploadSource || !ImageInfo) {
            throw new Error('Matrix E2EE SDK is unavailable.');
        }
        const params = UploadParameters.new({
            source: UploadSource.File.new({ filename: filePath }),
            caption: buildMediaLabel(asset.fileName, 'Фото'),
            formattedCaption: undefined,
            mentions: undefined,
            inReplyTo: undefined,
        });
        const info = ImageInfo.new({
            height: undefined,
            width: undefined,
            mimetype: asset.type,
            size: toBigInt(asset.fileSize),
            thumbnailInfo: undefined,
            thumbnailSource: undefined,
            blurhash: undefined,
            isAnimated: false,
        });
        const handle = timeline.sendImage(params, undefined, info);
        await handle.join();
    }

    async sendGenericFileAttachment(roomId: string, asset: { uri: string; fileCopyUri?: string; name?: string; type?: string; size?: number }) {
        const timeline = await this.getActiveTimeline(roomId);
        const filePath = await ensureReadableUriPath(asset);
        const { UploadParameters, UploadSource, FileInfo } = getMatrixSdk();
        if (!UploadParameters || !UploadSource || !FileInfo) {
            throw new Error('Matrix E2EE SDK is unavailable.');
        }
        const params = UploadParameters.new({
            source: UploadSource.File.new({ filename: filePath }),
            caption: buildMediaLabel(asset.name, 'Файл'),
            formattedCaption: undefined,
            mentions: undefined,
            inReplyTo: undefined,
        });
        const info = FileInfo.new({
            mimetype: asset.type,
            size: toBigInt(asset.size),
            thumbnailInfo: undefined,
            thumbnailSource: undefined,
        });
        const handle = timeline.sendFile(params, info);
        await handle.join();
    }

    async sendVoiceAttachment(roomId: string, asset: { uri: string; fileName?: string; type?: string; size?: number; durationSeconds?: number }) {
        const timeline = await this.getActiveTimeline(roomId);
        const filePath = await ensureReadableUriPath(asset);
        const { UploadParameters, UploadSource, AudioInfo } = getMatrixSdk();
        if (!UploadParameters || !UploadSource || !AudioInfo) {
            throw new Error('Matrix E2EE SDK is unavailable.');
        }
        const params = UploadParameters.new({
            source: UploadSource.File.new({ filename: filePath }),
            caption: buildMediaLabel(asset.fileName, 'Голосовое сообщение'),
            formattedCaption: undefined,
            mentions: undefined,
            inReplyTo: undefined,
        });
        const info = AudioInfo.new({
            duration: asset.durationSeconds ? { secs: BigInt(Math.floor(asset.durationSeconds)), nanos: 0 } as any : undefined,
            mimetype: asset.type,
            size: toBigInt(asset.size),
        });
        const handle = timeline.sendAudio(params, info);
        await handle.join();
    }

    async markRoomRead(roomId: string) {
        if (!this.client) {
            return;
        }

        const room = this.client.getRoom(roomId);
        if (!room) {
            return;
        }

        const { ReceiptType } = getMatrixSdk();
        if (!ReceiptType) {
            return;
        }
        await room.markAsRead(ReceiptType.Read);
    }

    getBootstrapState() {
        return this.bootstrapState;
    }
}

const matrixE2EEClient = new MatrixE2EEClient();

export default matrixE2EEClient;


