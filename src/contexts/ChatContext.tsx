import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { useAuth } from './AuthContext';
import useFleetbase from '../hooks/use-fleetbase';
import useStorage, { storage } from '../hooks/use-storage';
import matrixConfig, { hasDelegatedMatrixAuth, hasMatrixConfig } from '../config/matrix';
import {
    MatrixHttpClient,
    MatrixMediaService,
    MatrixRoomService,
    clearMatrixSession,
    createDelegatedMatrixSession,
    createMatrixAccessTokenSession,
    createPasswordMatrixSession,
    loadMatrixSession,
    saveMatrixSession,
} from '../services/matrix';
import type { MatrixInviteRoom, MatrixMessage, MatrixParticipant, MatrixRoom, MatrixSession } from '../services/matrix/types';
import matrixE2EEClient from '../services/matrix/e2ee';
import { CHAT_STICKERS } from '../constants/chat';

const ChatContext = createContext<any>(null);

const STORAGE_PREFIX = '_chat_v2';
const TERMINAL_PREVIEW = 'РЎРѕРѕР±С‰РµРЅРёРµ';

const buildTxnId = () => `rn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const isStickerEmoji = (value = '') => CHAT_STICKERS.some((item) => item.emoji === value.trim());

const getDriverUserId = (driver: any) => driver?.getAttribute?.('user') ?? driver?.user ?? driver?.id;
const getDriverName = (driver: any) => driver?.name ?? driver?.getAttribute?.('name') ?? 'Р’С‹';
const getDriverAvatar = (driver: any) => driver?.avatar_url ?? driver?.getAttribute?.('avatar_url') ?? null;
const getDriverPhone = (driver: any) => driver?.phone ?? driver?.getAttribute?.('phone') ?? null;

const normalizeLegacyParticipant = (participant: any): MatrixParticipant => ({
    id: participant?.id ?? participant?.user ?? participant?.name,
    userId: participant?.user,
    name: participant?.name ?? participant?.username ?? 'РЈС‡Р°СЃС‚РЅРёРє',
    avatarUrl: participant?.avatar_url ?? null,
    avatarFallback: `${participant?.name ?? participant?.username ?? 'U'}`.slice(0, 1).toUpperCase(),
    phone: participant?.phone ?? null,
    isOnline: participant?.is_online,
});

const normalizeLegacyMessage = (feedItem: any): MatrixMessage | null => {
    if (!feedItem?.data) {
        return null;
    }

    if (feedItem.type === 'log') {
        return {
            id: feedItem.data.id ?? `log-${feedItem.created_at}`,
            type: 'system',
            content: feedItem.data?.resolved_content ?? feedItem.data?.content ?? 'РЎРёСЃС‚РµРјРЅРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ',
            createdAt: new Date(feedItem.created_at ?? feedItem.data.created_at ?? Date.now()).toISOString(),
            sender: {
                id: 'system',
                name: 'РЎРёСЃС‚РµРјР°',
                avatarFallback: 'S',
            },
            status: 'sent',
        };
    }

    const attachments = Array.isArray(feedItem.data.attachments) ? feedItem.data.attachments : [];
    const baseMessage: MatrixMessage = {
        id: feedItem.data.id ?? `msg-${feedItem.created_at}`,
        type: attachments.length ? 'image' : isStickerEmoji(feedItem.data.content) ? 'sticker' : 'text',
        content: feedItem.data.content ?? TERMINAL_PREVIEW,
        createdAt: new Date(feedItem.data.created_at ?? feedItem.created_at ?? Date.now()).toISOString(),
        sender: normalizeLegacyParticipant(feedItem.data.sender ?? {}),
        status: 'sent',
        url: attachments[0]?.url,
        fileName: attachments[0]?.original_filename,
        mimeType: attachments[0]?.content_type,
        size: attachments[0]?.size,
        isOutgoing: false,
    };

    return baseMessage;
};

const normalizeLegacyChannel = (channel: any, driverUserId: string | number | undefined): MatrixRoom => {
    const participants = Array.isArray(channel?.participants) ? channel.participants.map(normalizeLegacyParticipant) : [];
    const otherParticipant = participants.find((participant) => participant.userId !== driverUserId) ?? participants[0];
    const feed = (channel?.feed ?? []).map(normalizeLegacyMessage).filter(Boolean) as MatrixMessage[];
    const lastMessage = feed[feed.length - 1];

    return {
        id: channel.id,
        roomId: channel.uuid ?? channel.id,
        title: channel.title ?? channel.name ?? otherParticipant?.name ?? 'Р§Р°С‚',
        subtitle: otherParticipant?.name,
        avatarUrl: otherParticipant?.avatarUrl ?? null,
        avatarFallback: otherParticipant?.avatarFallback ?? 'Р§',
        statusText: otherParticipant?.isOnline ? 'Р’ СЃРµС‚Рё' : 'Р‘С‹Р»(Р°) РЅРµРґР°РІРЅРѕ',
        unreadCount: channel.unread_count ?? 0,
        updatedAt: new Date(channel.last_message?.created_at ?? channel.updated_at ?? channel.created_at ?? Date.now()).toISOString(),
        lastMessagePreview: channel.last_message?.content ?? lastMessage?.content ?? TERMINAL_PREVIEW,
        participants,
        feed,
        isDirect: participants.length <= 2,
        phone: otherParticipant?.phone ?? null,
        raw: channel,
    };
};

const sortRoomsByActivity = (rooms: MatrixRoom[]) => {
    return [...rooms].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

const decorateManagedWorkChatRoom = (room: MatrixRoom): MatrixRoom => {
    if (!matrixConfig.managedWorkChat) {
        return room;
    }

    const requiresPlainMatrix = Boolean(matrixConfig.requireUnencryptedRooms && room.isEncrypted);
    const policyMessage = requiresPlainMatrix
        ? 'Эта рабочая комната зашифрована на сервере. Для поддержки и заказов нужна обычная Matrix room без E2EE.'
        : '';

    return {
        ...room,
        subtitle: room.subtitle ?? 'Рабочий чат',
        statusText: requiresPlainMatrix ? 'Нужна обычная Matrix room' : room.statusText ?? 'Рабочий чат',
        raw: {
            ...(room.raw ?? {}),
            managedWorkChat: true,
            requiresPlainMatrix,
            serverMisconfigurationMessage: policyMessage,
        },
    };
};

const isVisibleChatRoom = (room?: MatrixRoom | null) => {
    if (!room) {
        return false;
    }

    if (room.raw?.isSpace) {
        return false;
    }

    if (matrixConfig.supportSpaceId && (room.id === matrixConfig.supportSpaceId || room.roomId === matrixConfig.supportSpaceId)) {
        return false;
    }

    return true;
};

const isE2EERoom = (room?: MatrixRoom | null) => Boolean(matrixConfig.e2eeEnabled && room?.isEncrypted && !room?.raw?.requiresPlainMatrix);

const getSupportTargetRoomId = () => matrixConfig.supportRoomId || matrixConfig.supportSpaceId;

const buildSpaceChildRoom = (room: any): MatrixRoom => ({
    id: room.room_id,
    roomId: room.room_id,
    title: room.name || 'Р§Р°С‚',
    subtitle: room.topic || 'Matrix room',
    avatarFallback: `${room.name || 'C'}`.slice(0, 1).toUpperCase(),
    statusText: room.join_rule === 'public' ? 'РџСѓР±Р»РёС‡РЅР°СЏ РєРѕРјРЅР°С‚Р°' : 'РћР¶РёРґР°РµС‚ invite',
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
    lastMessagePreview: room.join_rule === 'public' ? 'РљРѕРјРЅР°С‚Р° РёР· РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІР° Delivery' : 'РќСѓР¶РµРЅ server-side invite',
    participants: [],
    feed: [],
    isDirect: false,
    isEncrypted: false,
    phone: matrixConfig.callPhone || null,
    raw: { requiresInvite: room.join_rule !== 'public', fromSpace: true },
});

const buildInviteRoom = (room: MatrixInviteRoom): MatrixRoom => ({
    id: room.roomId,
    roomId: room.roomId,
    title: room.name || (room.isSpace ? 'РџСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ Matrix' : 'Р§Р°С‚'),
    subtitle: room.isSpace ? 'Space' : 'Matrix room',
    avatarUrl: room.avatarUrl,
    avatarFallback: `${room.name || 'M'}`.slice(0, 1).toUpperCase(),
    statusText: room.isSpace ? 'РћР¶РёРґР°РµС‚ РІС…РѕРґ РІ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ' : 'РћР¶РёРґР°РµС‚ РІС…РѕРґ РІ РєРѕРјРЅР°С‚Сѓ',
    unreadCount: 0,
    updatedAt: new Date().toISOString(),
    lastMessagePreview: room.isSpace ? 'Р•СЃС‚СЊ РїСЂРёРіР»Р°С€РµРЅРёРµ РІ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ' : 'Р•СЃС‚СЊ РїСЂРёРіР»Р°С€РµРЅРёРµ РІ РєРѕРјРЅР°С‚Сѓ',
    participants: [],
    feed: [],
    isDirect: false,
    isEncrypted: false,
    phone: matrixConfig.callPhone || null,
    raw: { requiresInvite: false, invited: true, isSpace: room.isSpace, inviter: room.inviter },
});

const injectSupportRoomSeed = (rooms: MatrixRoom[]) => {
    const supportTargetRoomId = getSupportTargetRoomId();
    if (!supportTargetRoomId) {
        return rooms;
    }

    const hasSupportRoom = rooms.some((room) => room.roomId === supportTargetRoomId || room.id === supportTargetRoomId);
    if (hasSupportRoom) {
        return rooms;
    }

    return [
        {
            id: supportTargetRoomId,
            roomId: supportTargetRoomId,
            title: 'РџРѕРґРґРµСЂР¶РєР° max.kg',
            subtitle: 'Support',
            avatarFallback: 'M',
            statusText: 'Matrix',
            unreadCount: 0,
            updatedAt: new Date().toISOString(),
            lastMessagePreview: 'РћР¶РёРґР°РµС‚ server-side invite',
            participants: [],
            feed: [],
            isDirect: false,
            phone: matrixConfig.callPhone || null,
            raw: { requiresInvite: true, seeded: true },
        },
        ...rooms,
    ];
};

export const ChatProvider: React.FC<any> = ({ children }) => {
    const { adapter } = useFleetbase();
    const { driver, authToken } = useAuth();
    const driverUserId = getDriverUserId(driver);
    const cacheKey = `${STORAGE_PREFIX}:${driver?.id ?? 'anon'}`;
    const [legacyChannels, setLegacyChannels] = useStorage(`${cacheKey}:legacy_channels`, [] as any[]);
    const [channels, setChannels] = useStorage(`${cacheKey}:channels`, [] as MatrixRoom[]);
    const [currentChannel, setCurrentChannel] = useStorage(`${cacheKey}:current_channel`, null as MatrixRoom | null);
    const [matrixSession, setMatrixSession] = useState<MatrixSession | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAuthorizingMatrix, setIsAuthorizingMatrix] = useState(false);
    const [providerMode, setProviderMode] = useState<'legacy' | 'matrix'>('legacy');
    const syncTokenRef = useRef<string | undefined>(undefined);
    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const unreadCount = useMemo(() => channels.reduce((sum, channel) => sum + (channel.unreadCount || 0), 0), [channels]);
    const setChannelsState = useCallback((value: any) => (setChannels as any)(value), [setChannels]);
    const setCurrentChannelState = useCallback((value: any) => (setCurrentChannel as any)(value), [setCurrentChannel]);
    const bootstrapStartedRef = useRef(false);

    const createMatrixServices = useCallback(
        (sessionOverride?: MatrixSession | null) => {
            const session = sessionOverride ?? matrixSession;
            if (!session) {
                return null;
            }

            const client = new MatrixHttpClient(session);
            return {
                client,
                roomService: new MatrixRoomService(client, session.userId, session.homeserverUrl),
                mediaService: new MatrixMediaService(client),
            };
        },
        [matrixSession]
    );

    const bootstrapMatrixSession = useCallback(async () => {
        if (!driver || !hasMatrixConfig()) {
            console.log(
                '[ChatContext] Matrix bootstrap skipped',
                JSON.stringify({
                    hasDriver: Boolean(driver),
                    hasMatrixConfig: hasMatrixConfig(),
                    matrixEnabled: matrixConfig.enabled,
                    homeserverUrl: matrixConfig.homeserverUrl,
                    authMode: matrixConfig.authMode,
                    userId: matrixConfig.userId,
                    supportRoomId: matrixConfig.supportRoomId,
                    supportSpaceId: matrixConfig.supportSpaceId,
                    e2eeEnabled: matrixConfig.e2eeEnabled,
                })
            );
            return null;
        }

        setIsAuthorizingMatrix(true);

        try {
            const storedSession = await loadMatrixSession();
            if (storedSession?.accessToken && storedSession?.userId) {
                console.log('[ChatContext] Matrix bootstrap restored stored session', {
                    userId: storedSession.userId,
                    deviceId: storedSession.deviceId,
                });
                setMatrixSession(storedSession);
                setProviderMode('matrix');
                return storedSession;
            }

            if (matrixConfig.authMode === 'access_token' && matrixConfig.accessToken && matrixConfig.userId) {
                console.log('[ChatContext] Matrix bootstrap using access token mode', {
                    userId: matrixConfig.userId,
                    deviceId: matrixConfig.deviceId,
                });
                const directSession = createMatrixAccessTokenSession({
                    accessToken: matrixConfig.accessToken,
                    userId: matrixConfig.userId,
                    deviceId: matrixConfig.deviceId || undefined,
                });
                await saveMatrixSession(directSession);
                setMatrixSession(directSession);
                setProviderMode('matrix');
                return directSession;
            }

            if (hasDelegatedMatrixAuth()) {
                console.log('[ChatContext] Matrix bootstrap using delegated auth');
                const createdSession = await createDelegatedMatrixSession({
                    driverId: `${driver.id}`,
                    fleetbaseToken: authToken,
                    phone: getDriverPhone(driver),
                });
                await saveMatrixSession(createdSession);
                setMatrixSession(createdSession);
                setProviderMode('matrix');
                return createdSession;
            }
        } catch (error) {
            console.warn('Matrix session bootstrap failed:', error);
        } finally {
            setIsAuthorizingMatrix(false);
        }

        console.log('[ChatContext] Matrix bootstrap fell back to legacy');
        setProviderMode('legacy');
        return null;
    }, [authToken, driver]);

    const connectMatrixSession = useCallback(
        async (credentials: { accessToken: string; userId: string; deviceId?: string } | { password: string }) => {
            let nextSession: MatrixSession;

            if ('password' in credentials) {
                nextSession = await createPasswordMatrixSession({ driverId: `${driver?.id}`, password: credentials.password });
            } else {
                nextSession = createMatrixAccessTokenSession(credentials);
            }

            await saveMatrixSession(nextSession);
            setMatrixSession(nextSession);
            setProviderMode('matrix');
            return nextSession;
        },
        [driver?.id]
    );

    const disconnectMatrixSession = useCallback(async () => {
        await clearMatrixSession();
        await matrixE2EEClient.destroy();
        setMatrixSession(null);
        syncTokenRef.current = undefined;
        setProviderMode('legacy');
    }, []);

    const getLegacyChannels = useCallback(async () => {
        if (!adapter || !driver) {
            return [];
        }

        const loaded = await adapter.get('chat-channels', { sort: '-created_at' });
        setLegacyChannels(loaded);
        const normalized = sortRoomsByActivity(loaded.map((channel: any) => normalizeLegacyChannel(channel, driverUserId)));
        setChannelsState(normalized);
        return normalized;
    }, [adapter, driver, driverUserId, setChannelsState, setLegacyChannels]);

    const getMatrixChannels = useCallback(
        async (sessionOverride?: MatrixSession | null) => {
            const services = createMatrixServices(sessionOverride);
            if (!services) {
                return [];
            }

            const response = await services.roomService.listRooms(syncTokenRef.current);
            syncTokenRef.current = response.nextBatch;
            let normalized = response.rooms;
            const inviteRooms = Array.isArray((response as any).inviteRooms) ? ((response as any).inviteRooms as MatrixInviteRoom[]) : [];
            const autoJoinTargets = new Set<string>(
                [
                    matrixConfig.supportSpaceId || undefined,
                    matrixConfig.supportRoomId || undefined,
                ].filter(Boolean) as string[]
            );

            let shouldRefreshAfterJoin = false;
            for (const inviteRoom of inviteRooms) {
                if (!autoJoinTargets.has(inviteRoom.roomId)) {
                    continue;
                }

                try {
                    await services.roomService.joinRoom(inviteRoom.roomId);
                    shouldRefreshAfterJoin = true;
                } catch (error) {
                    console.warn('Unable to auto-join Matrix invite:', inviteRoom.roomId, error);
                }
            }

            if (shouldRefreshAfterJoin) {
                const refreshedResponse = await services.roomService.listRooms();
                syncTokenRef.current = refreshedResponse.nextBatch;
                normalized = refreshedResponse.rooms;
            }

            if (inviteRooms.length > 0) {
                const inviteSeedRooms = inviteRooms.map(buildInviteRoom);
                const knownIds = new Set(normalized.map((room) => room.roomId));
                normalized = [...inviteSeedRooms.filter((room) => !knownIds.has(room.roomId)), ...normalized];
            }

            if (matrixConfig.supportSpaceId) {
                try {
                    const hierarchy = await services.roomService.getSpaceHierarchy(matrixConfig.supportSpaceId);
                    const hierarchyRooms = Array.isArray(hierarchy?.rooms) ? hierarchy.rooms : [];
                    const spaceChildren = hierarchyRooms
                        .filter((room: any) => room.room_id !== matrixConfig.supportSpaceId && room.room_type !== 'm.space')
                        .map(buildSpaceChildRoom);

                    if (spaceChildren.length > 0) {
                        const knownIds = new Set(normalized.map((room) => room.roomId));
                        normalized = [...spaceChildren.filter((room) => !knownIds.has(room.roomId)), ...normalized];
                    } else {
                        normalized = injectSupportRoomSeed(normalized);
                    }
                } catch (error) {
                    normalized = injectSupportRoomSeed(normalized);
                }
            }

            const nextSession = sessionOverride ?? matrixSession;
            if (matrixConfig.e2eeEnabled && nextSession) {
                try {
                    const e2eeRooms = await matrixE2EEClient.listRooms(nextSession);
                    if (Array.isArray(e2eeRooms) && e2eeRooms.length > 0) {
                        const roomMap = new Map<string, MatrixRoom>();
                        normalized.forEach((room) => roomMap.set(room.roomId, room));
                        e2eeRooms.forEach((room) => {
                            const existing = roomMap.get(room.roomId);
                            roomMap.set(
                                room.roomId,
                                existing
                                    ? {
                                          ...existing,
                                          ...room,
                                          raw: { ...(existing.raw ?? {}), ...(room.raw ?? {}), requiresInvite: false, invited: false, seeded: false },
                                      }
                                    : { ...room, raw: { ...(room.raw ?? {}), requiresInvite: false, invited: false, seeded: false } }
                            );
                        });
                        normalized = Array.from(roomMap.values());
                    }
                } catch (error) {
                    console.warn('Matrix E2EE room list failed:', error);
                }
            }

            if (matrixConfig.managedWorkChat && matrixConfig.supportRoomId) {
                try {
                    const liveSupportRoom = decorateManagedWorkChatRoom(await services.roomService.getRoom(matrixConfig.supportRoomId));
                    const supportRoomMap = new Map<string, MatrixRoom>();
                    normalized.forEach((room) => supportRoomMap.set(room.roomId, room));
                    supportRoomMap.set(liveSupportRoom.roomId, {
                        ...(supportRoomMap.get(liveSupportRoom.roomId) ?? {}),
                        ...liveSupportRoom,
                    });
                    normalized = Array.from(supportRoomMap.values());
                } catch (error) {
                    console.warn('Unable to refresh managed support room state:', error);
                }
            }

            normalized = sortRoomsByActivity(normalized.filter(isVisibleChatRoom).map(decorateManagedWorkChatRoom));
            console.log(
                '[ChatContext] matrix rooms normalized',
                normalized.map((room) => ({
                    id: room.id,
                    roomId: room.roomId,
                    title: room.title,
                    isEncrypted: room.isEncrypted,
                    requiresInvite: Boolean(room.raw?.requiresInvite),
                    requiresPlainMatrix: Boolean(room.raw?.requiresPlainMatrix),
                }))
            );
            setChannelsState(normalized);
            return normalized;
        },
        [createMatrixServices, matrixSession, setChannelsState]
    );

    const getChannels = useCallback(async () => {
        setIsLoading(true);
        try {
            console.log('[ChatContext] getChannels start', {
                providerMode,
                hasSession: Boolean(matrixSession),
            });
            const session = matrixSession ?? (hasMatrixConfig() ? await bootstrapMatrixSession() : null);
            if (session) {
                console.log('[ChatContext] getChannels loading matrix rooms');
                const rooms = await getMatrixChannels(session);
                console.log('[ChatContext] getChannels loaded matrix rooms', { count: rooms.length });
                return rooms;
            }

            console.log('[ChatContext] getChannels returning empty matrix-only state');
            setChannelsState([]);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [bootstrapMatrixSession, getMatrixChannels, matrixSession, providerMode, setChannelsState]);

    const getChannel = useCallback(
        async (id: string) => {
            if (providerMode === 'matrix') {
                const resolvedId = id === matrixConfig.supportSpaceId && matrixConfig.supportRoomId ? matrixConfig.supportRoomId : id;
                const seededRoom = channels.find((item) => item.id === resolvedId || item.roomId === resolvedId || item.id === id || item.roomId === id);
                console.log('[ChatContext] getChannel request', {
                    requestedId: id,
                    resolvedId,
                    seededRoomId: seededRoom?.roomId,
                    seededRequiresInvite: Boolean(seededRoom?.raw?.requiresInvite),
                    seededIsEncrypted: Boolean(seededRoom?.isEncrypted),
                    seededRequiresPlainMatrix: Boolean(seededRoom?.raw?.requiresPlainMatrix),
                });
                const isManagedSupportRoom = Boolean(
                    matrixConfig.supportRoomId &&
                        (resolvedId === matrixConfig.supportRoomId || seededRoom?.roomId === matrixConfig.supportRoomId)
                );
                if (seededRoom?.raw?.requiresInvite && !seededRoom?.isEncrypted && !seededRoom?.raw?.e2ee && !isManagedSupportRoom) {
                    setCurrentChannelState(seededRoom);
                    return seededRoom;
                }

                if (matrixSession) {
                    const cachedE2EERoom = matrixE2EEClient.getCachedRoom(resolvedId);
                    const decoratedCachedE2EERoom = cachedE2EERoom ? decorateManagedWorkChatRoom(cachedE2EERoom) : null;
                    if (decoratedCachedE2EERoom?.isEncrypted && !decoratedCachedE2EERoom?.raw?.requiresPlainMatrix) {
                        const e2eeRoom = await matrixE2EEClient.subscribeToRoom(matrixSession, resolvedId, (nextRoom) => {
                            const decoratedNextRoom = decorateManagedWorkChatRoom(nextRoom);
                            setCurrentChannelState(decoratedNextRoom);
                            setChannelsState((previousRooms: MatrixRoom[]) => {
                                const exists = previousRooms.some((item) => item.id === decoratedNextRoom.id);
                                const nextRooms = exists
                                    ? previousRooms.map((item) => (item.id === decoratedNextRoom.id ? { ...item, ...decoratedNextRoom } : item))
                                    : [decoratedNextRoom, ...previousRooms];
                                return sortRoomsByActivity(nextRooms);
                            });
                        });

                        const decoratedE2EERoom = decorateManagedWorkChatRoom(e2eeRoom);
                        setCurrentChannelState(decoratedE2EERoom);
                        setChannelsState((previousRooms: MatrixRoom[]) => {
                            const exists = previousRooms.some((item) => item.id === decoratedE2EERoom.id);
                            const nextRooms = exists
                                ? previousRooms.map((item) => (item.id === decoratedE2EERoom.id ? { ...item, ...decoratedE2EERoom } : item))
                                : [decoratedE2EERoom, ...previousRooms];
                            return sortRoomsByActivity(nextRooms);
                        });
                        return decoratedE2EERoom;
                    }
                }

                const services = createMatrixServices();
                if (!services) {
                    return null;
                }

                const room = decorateManagedWorkChatRoom(await services.roomService.getRoom(resolvedId));
                if (isE2EERoom(room) && matrixSession) {
                    const e2eeRoom = await matrixE2EEClient.subscribeToRoom(matrixSession, resolvedId, (nextRoom) => {
                        const decoratedNextRoom = decorateManagedWorkChatRoom(nextRoom);
                        setCurrentChannelState(decoratedNextRoom);
                        setChannelsState((previousRooms: MatrixRoom[]) => {
                            const exists = previousRooms.some((item) => item.id === decoratedNextRoom.id);
                            const nextRooms = exists
                                ? previousRooms.map((item) => (item.id === decoratedNextRoom.id ? { ...item, ...decoratedNextRoom } : item))
                                : [decoratedNextRoom, ...previousRooms];
                            return sortRoomsByActivity(nextRooms);
                        });
                    });

                    const decoratedE2EERoom = decorateManagedWorkChatRoom(e2eeRoom);
                    setCurrentChannelState(decoratedE2EERoom);
                    setChannelsState((previousRooms: MatrixRoom[]) => {
                        const exists = previousRooms.some((item) => item.id === decoratedE2EERoom.id);
                        const nextRooms = exists
                            ? previousRooms.map((item) => (item.id === decoratedE2EERoom.id ? { ...item, ...decoratedE2EERoom } : item))
                            : [decoratedE2EERoom, ...previousRooms];
                        return sortRoomsByActivity(nextRooms);
                    });
                    return decoratedE2EERoom;
                }

                matrixE2EEClient.clearActiveRoomSubscription();
                const decoratedRoom = decorateManagedWorkChatRoom(room);
                setCurrentChannelState(decoratedRoom);
                setChannelsState((previousRooms: MatrixRoom[]) => sortRoomsByActivity(previousRooms.map((item) => (item.id === decoratedRoom.id ? decoratedRoom : item))));
                return decoratedRoom;
            }

            return null;
        },
        [channels, createMatrixServices, matrixSession, providerMode, setChannelsState, setCurrentChannelState]
    );

    const reloadCurrentChannel = useCallback(async (roomId?: string) => {
        const targetRoomId = roomId ?? currentChannel?.id;
        if (!targetRoomId) {
            return null;
        }

        return getChannel(targetRoomId);
    }, [currentChannel?.id, getChannel]);

    const updateRoomInState = useCallback(
        (room: MatrixRoom, mutation?: (messages: MatrixMessage[]) => MatrixMessage[]) => {
            const latestRoom =
                (currentChannel?.id === room.id ? currentChannel : null) ??
                channels.find((item) => item.id === room.id) ??
                room;
            const nextRoom = mutation ? { ...latestRoom, feed: mutation(latestRoom.feed ?? []) } : { ...latestRoom, ...room };
            const lastMessage = nextRoom.feed?.[nextRoom.feed.length - 1];
            nextRoom.lastMessagePreview = lastMessage?.content ?? nextRoom.lastMessagePreview ?? TERMINAL_PREVIEW;
            nextRoom.updatedAt = lastMessage?.createdAt ?? nextRoom.updatedAt ?? new Date().toISOString();

            setCurrentChannelState(nextRoom);
            setChannelsState((previousRooms: MatrixRoom[]) => {
                const exists = previousRooms.some((item) => item.id === nextRoom.id);
                const nextRooms = exists ? previousRooms.map((item) => (item.id === nextRoom.id ? nextRoom : item)) : [nextRoom, ...previousRooms];
                return sortRoomsByActivity(nextRooms);
            });

            return nextRoom;
        },
        [channels, currentChannel, setChannelsState, setCurrentChannelState]
    );

    const appendOutgoingMessage = useCallback(
        (room: MatrixRoom, partial: Partial<MatrixMessage>) => {
            const outgoingMessage: MatrixMessage = {
                id: partial.id ?? buildTxnId(),
                type: partial.type ?? 'text',
                content: partial.content ?? '',
                createdAt: partial.createdAt ?? new Date().toISOString(),
                sender: partial.sender ?? {
                    id: `${driver?.id ?? 'driver'}`,
                    userId: `${driverUserId ?? driver?.id ?? 'driver'}`,
                    name: getDriverName(driver),
                    avatarUrl: getDriverAvatar(driver),
                    avatarFallback: getDriverName(driver).slice(0, 1).toUpperCase(),
                },
                status: partial.status ?? 'sending',
                url: partial.url,
                fileName: partial.fileName,
                mimeType: partial.mimeType,
                size: partial.size,
                durationSeconds: partial.durationSeconds,
                geoUri: partial.geoUri,
                body: partial.body ?? partial.content ?? '',
                isOutgoing: true,
            };

            updateRoomInState(room, (messages) => [...messages, outgoingMessage]);
            return outgoingMessage;
        },
        [driver, driverUserId, updateRoomInState]
    );

    const replaceTempMessage = useCallback(
        (room: MatrixRoom, tempId: string, message: MatrixMessage) => {
            updateRoomInState(room, (messages) => messages.map((item) => (item.id === tempId ? { ...message, status: 'sent', isOutgoing: true } : item)));
        },
        [updateRoomInState]
    );

    const sendTextMessage = useCallback(
        async (room: MatrixRoom, message: string) => {
            if (providerMode === 'matrix') {
                if (room?.raw?.requiresInvite) {
                    throw new Error('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ Matrix РµС‰Рµ РЅРµ РїСЂРёРіР»Р°С€РµРЅ РІ СЌС‚Сѓ РєРѕРјРЅР°С‚Сѓ.');
                }
                if (room?.raw?.requiresPlainMatrix) {
                    throw new Error(room.raw.serverMisconfigurationMessage ?? 'Рабочий чат должен использовать обычную Matrix room без E2EE.');
                }
                if (isE2EERoom(room)) {
                    console.log('[ChatContext] sendTextMessage:e2ee', JSON.stringify({ roomId: room.roomId, messageLength: message.length }));
                    await matrixE2EEClient.sendTextMessage(room.roomId, message);
                    console.log('[ChatContext] sendTextMessage:e2ee:done', JSON.stringify({ roomId: room.roomId }));
                    return room;
                }

                const services = createMatrixServices();
                if (!services) {
                    throw new Error('Matrix client is not configured.');
                }

                const txnId = buildTxnId();
                const temp = appendOutgoingMessage(room, { id: txnId, type: isStickerEmoji(message) ? 'sticker' : 'text', content: message });
                await services.roomService.sendMessage(room.roomId, txnId, {
                    msgtype: 'm.text',
                    body: message,
                });
                replaceTempMessage(room, temp.id, { ...temp, id: txnId, eventId: txnId, status: 'sent' });
                await reloadCurrentChannel(room.id);
                return temp;
            }

            if (!adapter || !room.raw) {
                throw new Error('Legacy chat provider is unavailable.');
            }

            const participant = room.raw.participants.find((item: any) => item.user === driverUserId);
            const newMessage = await adapter.post(`chat-channels/${room.raw.id}/send-message`, { sender: participant.id, content: message });
            await reloadCurrentChannel(room.id);
            return newMessage;
        },
        [adapter, appendOutgoingMessage, createMatrixServices, driverUserId, providerMode, reloadCurrentChannel, replaceTempMessage]
    );

    const sendSticker = useCallback(
        async (room: MatrixRoom, sticker: { emoji: string; label: string }) => {
            return sendTextMessage(room, sticker.emoji);
        },
        [sendTextMessage]
    );

    const sendLocationMessage = useCallback(
        async (room: MatrixRoom, coords: { latitude: number; longitude: number }) => {
            const label = `Р“РµРѕРїРѕР·РёС†РёСЏ: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
            if (providerMode === 'matrix') {
                if (room?.raw?.requiresInvite) {
                    throw new Error('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ Matrix РµС‰Рµ РЅРµ РїСЂРёРіР»Р°С€РµРЅ РІ СЌС‚Сѓ РєРѕРјРЅР°С‚Сѓ.');
                }
                if (room?.raw?.requiresPlainMatrix) {
                    throw new Error(room.raw.serverMisconfigurationMessage ?? 'Рабочий чат должен использовать обычную Matrix room без E2EE.');
                }
                if (isE2EERoom(room)) {
                    await matrixE2EEClient.sendLocationMessage(room.roomId, coords);
                    return room;
                }

                const services = createMatrixServices();
                if (!services) {
                    throw new Error('Matrix client is not configured.');
                }

                const txnId = buildTxnId();
                const temp = appendOutgoingMessage(room, {
                    id: txnId,
                    type: 'location',
                    content: label,
                    geoUri: `geo:${coords.latitude},${coords.longitude}`,
                });
                await services.roomService.sendMessage(room.roomId, txnId, {
                    msgtype: 'm.location',
                    body: label,
                    geo_uri: `geo:${coords.latitude},${coords.longitude}`,
                });
                replaceTempMessage(room, temp.id, { ...temp, status: 'sent' });
                await reloadCurrentChannel(room.id);
                return temp;
            }

            return sendTextMessage(room, label);
        },
        [appendOutgoingMessage, createMatrixServices, providerMode, reloadCurrentChannel, replaceTempMessage, sendTextMessage]
    );

    const sendFileAsset = useCallback(
        async (
            room: MatrixRoom,
            asset: { uri: string; fileName?: string; type?: string; size?: number; durationSeconds?: number },
            messageType: 'm.image' | 'm.file' | 'm.audio',
            normalizedType: MatrixMessage['type']
        ) => {
            if (room?.raw?.requiresInvite) {
                throw new Error('РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ Matrix РµС‰Рµ РЅРµ РїСЂРёРіР»Р°С€РµРЅ РІ СЌС‚Сѓ РєРѕРјРЅР°С‚Сѓ.');
            }
            if (room?.raw?.requiresPlainMatrix) {
                throw new Error(room.raw.serverMisconfigurationMessage ?? 'Рабочий чат должен использовать обычную Matrix room без E2EE.');
            }
            if (isE2EERoom(room)) {
                if (normalizedType === 'image') {
                    await matrixE2EEClient.sendImageAttachment(room.roomId, { uri: asset.uri, fileName: asset.fileName, type: asset.type, fileSize: asset.size });
                } else if (normalizedType === 'audio') {
                    await matrixE2EEClient.sendVoiceAttachment(room.roomId, asset);
                } else {
                    await matrixE2EEClient.sendGenericFileAttachment(room.roomId, { uri: asset.uri, name: asset.fileName, type: asset.type, size: asset.size });
                }
                return room;
            }

            const services = createMatrixServices();
            if (!services) {
                throw new Error('Matrix media upload requires Matrix configuration.');
            }

            const txnId = buildTxnId();
            const temp = appendOutgoingMessage(room, {
                id: txnId,
                type: normalizedType,
                content: asset.fileName ?? (normalizedType === 'image' ? 'Р¤РѕС‚Рѕ' : normalizedType === 'audio' ? 'Р“РѕР»РѕСЃРѕРІРѕРµ СЃРѕРѕР±С‰РµРЅРёРµ' : 'Р¤Р°Р№Р»'),
                fileName: asset.fileName,
                mimeType: asset.type,
                size: asset.size,
                durationSeconds: normalizedType === 'audio' ? asset.durationSeconds : undefined,
                localPath: asset.uri,
                url: asset.uri,
            });

            const upload = await services.mediaService.uploadFile(asset);
            await services.roomService.sendMessage(room.roomId, txnId, {
                msgtype: messageType,
                body: upload.fileName,
                url: upload.contentUri,
                info: {
                    mimetype: upload.mimeType,
                    size: upload.size,
                    duration: normalizedType === 'audio' && asset.durationSeconds ? Math.round(asset.durationSeconds * 1000) : undefined,
                },
            });
            replaceTempMessage(room, temp.id, { ...temp, status: 'sent' });
            await reloadCurrentChannel(room.id);
            return temp;
        },
        [appendOutgoingMessage, createMatrixServices, reloadCurrentChannel, replaceTempMessage]
    );

    const sendImageAttachment = useCallback(
        async (room: MatrixRoom, asset: { uri: string; fileName?: string; type?: string; fileSize?: number }) => {
            if (providerMode !== 'matrix') {
                return sendTextMessage(room, 'РћС‚РїСЂР°РІР»РµРЅРѕ С„РѕС‚Рѕ');
            }

            return sendFileAsset(
                room,
                { uri: asset.uri, fileName: asset.fileName, type: asset.type, size: asset.fileSize },
                'm.image',
                'image'
            );
        },
        [providerMode, sendFileAsset, sendTextMessage]
    );

    const sendGenericFileAttachment = useCallback(
        async (room: MatrixRoom, asset: { uri: string; name?: string; type?: string; size?: number }) => {
            return sendFileAsset(room, { uri: asset.uri, fileName: asset.name, type: asset.type, size: asset.size }, 'm.file', 'file');
        },
        [sendFileAsset]
    );

    const sendVoiceAttachment = useCallback(
        async (room: MatrixRoom, asset: { uri: string; fileName?: string; type?: string; size?: number; durationSeconds?: number }) => {
            const result = await sendFileAsset(room, asset, 'm.audio', 'audio');
            return result;
        },
        [sendFileAsset]
    );

    const markChannelRead = useCallback(
        async (room: MatrixRoom) => {
            const lastEventId = room.feed?.[room.feed.length - 1]?.eventId || room.feed?.[room.feed.length - 1]?.id;
            if (providerMode === 'matrix') {
                if (isE2EERoom(room)) {
                    await matrixE2EEClient.markRoomRead(room.roomId);
                } else {
                    const services = createMatrixServices();
                    if (services && lastEventId) {
                        await services.roomService.markRead(room.roomId, lastEventId);
                    }
                }
            }

            updateRoomInState({ ...room, unreadCount: 0 });
        },
        [createMatrixServices, providerMode, updateRoomInState]
    );

    const callChannel = useCallback(async (room: MatrixRoom) => {
        const phone = room.phone || room.participants.find((participant) => participant.userId !== driverUserId)?.phone || matrixConfig.callPhone;
        if (!phone) {
            throw new Error('РўРµР»РµС„РѕРЅ РґР»СЏ Р·РІРѕРЅРєР° РЅРµ РЅР°СЃС‚СЂРѕРµРЅ.');
        }

        const telUrl = `tel:${phone}`;
        const supported = await Linking.canOpenURL(telUrl);
        if (!supported) {
            throw new Error('РЈСЃС‚СЂРѕР№СЃС‚РІРѕ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚ Р·РІРѕРЅРєРё.');
        }

        await Linking.openURL(telUrl);
    }, [driverUserId]);

    const getChannelCurrentParticipant = useCallback(
        (room: MatrixRoom) => {
            return room?.participants?.find((participant) => participant.userId === driverUserId) ?? null;
        },
        [driverUserId]
    );

    useEffect(() => {
        if (!driver) {
            matrixE2EEClient.destroy().catch(() => undefined);
            setMatrixSession(null);
            setProviderMode('legacy');
            bootstrapStartedRef.current = false;
            return;
        }

        if (bootstrapStartedRef.current) {
            return;
        }

        bootstrapStartedRef.current = true;
        bootstrapMatrixSession()
            .then((session) => {
                if (session) {
                    return getMatrixChannels(session);
                }

                setChannelsState([]);
                return [];
            })
            .catch((error) => {
                console.warn('Matrix bootstrap init failed:', error);
                setChannelsState([]);
            });
    }, [bootstrapMatrixSession, driver, getMatrixChannels, setChannelsState]);

    useEffect(() => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }

        return () => {
            if (pollTimerRef.current) {
                clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
    }, []);

    const value = useMemo(
        () => ({
            channels,
            currentChannel,
            setCurrentChannel: setCurrentChannelState,
            unreadCount,
            isLoading,
            isAuthorizingMatrix,
            providerMode,
            matrixSession,
            getChannels,
            getChannel,
            reloadCurrentChannel,
            sendMessage: sendTextMessage,
            sendTextMessage,
            sendImageAttachment,
            sendGenericFileAttachment,
            sendVoiceAttachment,
            sendLocationMessage,
            sendSticker,
            markChannelRead,
            callChannel,
            connectMatrixSession,
            disconnectMatrixSession,
            createChannel: async () => null,
            updateChannel: async () => null,
            deleteChannel: async () => null,
            createChannelWithCustomer: async () => null,
            removeParticipant: async () => null,
            addParticipant: async () => null,
            getAvailableParticipants: async () => [],
            createReadReceipt: async () => null,
            getChannelCurrentParticipant,
            capabilities: {
                matrixConfigured: hasMatrixConfig(),
                matrixActive: providerMode === 'matrix' && Boolean(matrixSession),
                emoji: true,
                stickers: true,
                photos: true,
                files: providerMode === 'matrix',
                voice: true,
                location: true,
                calls: true,
                e2ee: false,
            },
        }),
        [
            callChannel,
            channels,
            connectMatrixSession,
            currentChannel,
            disconnectMatrixSession,
            getChannel,
            getChannelCurrentParticipant,
            getChannels,
            isAuthorizingMatrix,
            isLoading,
            markChannelRead,
            matrixSession,
            providerMode,
            reloadCurrentChannel,
            sendGenericFileAttachment,
            sendImageAttachment,
            sendLocationMessage,
            sendSticker,
            sendTextMessage,
            sendVoiceAttachment,
            setCurrentChannelState,
            unreadCount,
        ]
    );

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChat must be used within an ChatProvider');
    }
    return context;
};







