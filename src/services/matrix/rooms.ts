import type { MatrixInviteRoom, MatrixMessage, MatrixParticipant, MatrixRoom } from './types';
import MatrixHttpClient from './http-client';
import matrixConfig from '../../config/matrix';

const getDisplayName = (member: any, fallback: string) => {
    return member?.content?.displayname ?? fallback;
};

const getAvatarUrl = (homeserverUrl: string, mxcUrl?: string | null) => {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) {
        return null;
    }

    const mediaPath = mxcUrl.replace('mxc://', '');
    return `${homeserverUrl}/_matrix/media/v3/download/${mediaPath}`;
};

const deriveMessageType = (event: any): MatrixMessage['type'] => {
    const msgtype = event?.content?.msgtype;

    switch (msgtype) {
        case 'm.image':
            return 'image';
        case 'm.file':
            return 'file';
        case 'm.audio':
            return 'audio';
        case 'm.location':
            return 'location';
        case 'm.sticker':
            return 'sticker';
        default:
            if (event?.type === 'm.room.encrypted') {
                return 'system';
            }
            return event?.type === 'm.room.message' ? 'text' : 'system';
    }
};

const summarizeEvent = (event: any) => {
    const type = deriveMessageType(event);
    switch (type) {
        case 'image':
            return '????';
        case 'file':
            return event?.content?.body || '????';
        case 'audio':
            return '????????? ?????????';
        case 'location':
            return '??????????';
        case 'sticker':
            return '??????';
        case 'system':
            return event?.type === 'm.room.encrypted' ? '????????????? ?????????' : event?.content?.body || '????????? ?????????';
        default:
            return event?.content?.body || event?.content?.formatted_body || '?????????';
    }
};

const extractParticipants = (homeserverUrl: string, stateEvents: any[] = []): MatrixParticipant[] => {
    return stateEvents
        .filter((event) => event?.type === 'm.room.member' && event?.state_key)
        .map((event) => ({
            id: event.state_key,
            userId: event.state_key,
            name: getDisplayName(event, event.state_key),
            avatarUrl: getAvatarUrl(homeserverUrl, event?.content?.avatar_url),
            avatarFallback: getDisplayName(event, event.state_key).slice(0, 1).toUpperCase(),
            isOnline: event?.content?.membership === 'join',
        }));
};

const isEncryptedRoom = (stateEvents: any[] = [], timelineEvents: any[] = []) => {
    return [...stateEvents, ...timelineEvents].some((event) => event?.type === 'm.room.encryption');
};

const extractInviteRooms = (homeserverUrl: string, inviteRooms: Record<string, any> = {}) => {
    return Object.entries(inviteRooms).map(([roomId, room]): MatrixInviteRoom => {
        const inviteEvents = room?.invite_state?.events ?? [];
        const nameEvent = inviteEvents.find((event: any) => event?.type === 'm.room.name');
        const avatarEvent = inviteEvents.find((event: any) => event?.type === 'm.room.avatar');
        const joinRulesEvent = inviteEvents.find((event: any) => event?.type === 'm.room.join_rules');
        const createEvent = inviteEvents.find((event: any) => event?.type === 'm.room.create');
        const inviterEvent = inviteEvents.find(
            (event: any) => event?.type === 'm.room.member' && event?.sender && event?.state_key !== event?.sender
        );
        const roomType = createEvent?.content?.type;

        return {
            roomId,
            name: nameEvent?.content?.name || '??????? Matrix',
            avatarUrl: getAvatarUrl(homeserverUrl, avatarEvent?.content?.url),
            isSpace: roomType === 'm.space',
            joinRule: joinRulesEvent?.content?.join_rule,
            inviter: inviterEvent?.sender,
            raw: { ...room, isSpace: createEvent?.content?.type === 'm.space' },
        };
    });
};

export const normalizeMatrixEvent = (homeserverUrl: string, currentUserId: string, event: any, participants: MatrixParticipant[] = []): MatrixMessage | null => {
    if (!event || (event.type !== 'm.room.message' && event.type !== 'm.sticker' && event.type !== 'm.room.encrypted')) {
        return null;
    }

    const sender = participants.find((item) => item.userId === event.sender) ?? {
        id: event.sender,
        userId: event.sender,
        name: event.sender,
        avatarFallback: `${event.sender}`.replace('@', '').slice(0, 1).toUpperCase(),
    };

    const type = deriveMessageType(event);
    const body = event?.type === 'm.room.encrypted' ? '????????????? ?????????' : event?.content?.body || event?.content?.formatted_body || ''; 
    const url = event?.content?.url ? getAvatarUrl(homeserverUrl, event.content.url) : undefined;
    const info = event?.content?.info ?? {};

    return {
        id: event.event_id,
        eventId: event.event_id,
        roomId: event.room_id,
        type,
        content: body,
        body,
        createdAt: new Date(event.origin_server_ts ?? Date.now()).toISOString(),
        sender,
        status: 'sent',
        mimeType: info?.mimetype ?? event?.content?.info?.mimetype,
        fileName: body,
        size: info?.size,
        durationSeconds: info?.duration ? Math.round(info.duration / 1000) : undefined,
        geoUri: event?.content?.geo_uri,
        thumbnailUrl: info?.thumbnail_url ? getAvatarUrl(homeserverUrl, info.thumbnail_url) : undefined,
        url,
        isOutgoing: sender.userId === currentUserId,
    };
};

export class MatrixRoomService {
    private readonly client: MatrixHttpClient;
    private readonly currentUserId: string;
    private readonly homeserverUrl: string;

    constructor(client: MatrixHttpClient, currentUserId: string, homeserverUrl: string) {
        this.client = client;
        this.currentUserId = currentUserId;
        this.homeserverUrl = homeserverUrl;
    }

    async listRooms(syncToken?: string) {
        const response = await this.client.sync(syncToken, matrixConfig.syncTimeoutMs);
        const joinedRooms = response.rooms?.join ?? {};
        const inviteRooms = response.rooms?.invite ?? {};

        const rooms = Object.entries(joinedRooms).map(([roomId, room]) => {
            const stateEvents = room?.state?.events ?? [];
            const timelineEvents = room?.timeline?.events ?? [];
            const createEvent = stateEvents.find((event: any) => event?.type === 'm.room.create');
            const participants = extractParticipants(this.homeserverUrl, stateEvents);
            const titleEvent = stateEvents.find((event: any) => event?.type === 'm.room.name');
            const directParticipant = participants.find((item) => item.userId !== this.currentUserId) ?? participants[0];
            const lastEvent = [...timelineEvents]
                .reverse()
                .find((event) => event?.type === 'm.room.message' || event?.type === 'm.sticker' || event?.type === 'm.room.encrypted');
            const roomTitle = titleEvent?.content?.name || directParticipant?.name || '???';

            return {
                id: roomId,
                roomId,
                title: roomTitle,
                subtitle: directParticipant?.name,
                avatarUrl: directParticipant?.avatarUrl,
                avatarFallback: directParticipant?.avatarFallback ?? roomTitle.slice(0, 1).toUpperCase(),
                statusText: directParticipant?.isOnline ? '? ????' : 'Matrix',
                unreadCount: room?.unread_notifications?.notification_count ?? 0,
                updatedAt: new Date(lastEvent?.origin_server_ts ?? Date.now()).toISOString(),
                lastMessagePreview: summarizeEvent(lastEvent),
                participants,
                isDirect: Boolean(directParticipant),
                isEncrypted: isEncryptedRoom(stateEvents, timelineEvents),
                raw: { ...room, isSpace: createEvent?.content?.type === 'm.space' },
            } satisfies MatrixRoom;
        }).filter((room) => !room.raw?.isSpace);

        return {
            rooms,
            inviteRooms: extractInviteRooms(this.homeserverUrl, inviteRooms),
            nextBatch: response.next_batch,
        };
    }

    async getSpaceHierarchy(spaceId: string, maxDepth = 2) {
        return this.client.request<any>(`/_matrix/client/v1/rooms/${encodeURIComponent(spaceId)}/hierarchy`, {
            query: {
                limit: 50,
                max_depth: maxDepth,
                suggested_only: false,
            },
        });
    }

    async getRoom(roomId: string, limit = matrixConfig.maxTimelineLimit) {
        const state = await this.client.request<any[]>(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state`);
        const messages = await this.client.request<any>(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages`, {
            query: {
                dir: 'b',
                limit,
            },
        });

        const participants = extractParticipants(this.homeserverUrl, state);
        const timeline = [...(messages?.chunk ?? [])].reverse();
        const feed = timeline
            .map((event) => normalizeMatrixEvent(this.homeserverUrl, this.currentUserId, event, participants))
            .filter(Boolean) as MatrixMessage[];
        const titleEvent = state.find((event: any) => event?.type === 'm.room.name');
        const directParticipant = participants.find((item) => item.userId !== this.currentUserId) ?? participants[0];
        const roomTitle = titleEvent?.content?.name || directParticipant?.name || '???';
        const lastMessage = feed[feed.length - 1];

        return {
            id: roomId,
            roomId,
            title: roomTitle,
            subtitle: directParticipant?.name,
            avatarUrl: directParticipant?.avatarUrl,
            avatarFallback: directParticipant?.avatarFallback ?? roomTitle.slice(0, 1).toUpperCase(),
            statusText: directParticipant?.isOnline ? '? ????' : 'Matrix',
            unreadCount: 0,
            updatedAt: lastMessage?.createdAt ?? new Date().toISOString(),
            lastMessagePreview: lastMessage?.content ?? '?????????',
            participants,
            feed,
            isDirect: Boolean(directParticipant),
            isEncrypted: isEncryptedRoom(state, timeline),
            phone: matrixConfig.callPhone || null,
        } satisfies MatrixRoom;
    }

    async markRead(roomId: string, eventId: string) {
        if (!eventId) {
            return;
        }

        await this.client.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/read_markers`, {
            method: 'POST',
            body: {
                'm.fully_read': eventId,
                'm.read': eventId,
            },
        });
    }

    async joinRoom(roomId: string) {
        return this.client.request(`/_matrix/client/v3/join/${encodeURIComponent(roomId)}`, {
            method: 'POST',
            body: {},
        });
    }

    async sendMessage(roomId: string, txnId: string, body: Record<string, any>) {
        return this.client.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`, {
            method: 'PUT',
            body,
        });
    }

    async sendSticker(roomId: string, txnId: string, body: Record<string, any>) {
        return this.client.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.sticker/${encodeURIComponent(txnId)}`, {
            method: 'PUT',
            body,
        });
    }
}

export default MatrixRoomService;
