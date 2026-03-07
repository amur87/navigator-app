export type MatrixSession = {
    accessToken: string;
    deviceId?: string;
    userId: string;
    homeserverUrl: string;
    refreshToken?: string;
    expiresAt?: number;
};

export type MatrixParticipant = {
    id: string;
    userId?: string;
    name: string;
    avatarUrl?: string | null;
    avatarFallback?: string;
    phone?: string | null;
    isOnline?: boolean;
};

export type MatrixMessageType = 'text' | 'image' | 'file' | 'audio' | 'location' | 'sticker' | 'system';

export type MatrixMessage = {
    id: string;
    eventId?: string;
    transactionId?: string;
    roomId?: string;
    type: MatrixMessageType;
    content: string;
    createdAt: string;
    sender: MatrixParticipant;
    status?: 'sending' | 'sent' | 'failed' | 'read';
    mimeType?: string;
    fileName?: string;
    size?: number;
    durationSeconds?: number;
    geoUri?: string;
    thumbnailUrl?: string;
    url?: string;
    body?: string;
    localPath?: string;
    isOutgoing?: boolean;
};

export type MatrixRoom = {
    id: string;
    roomId: string;
    title: string;
    subtitle?: string;
    avatarUrl?: string | null;
    avatarFallback?: string;
    statusText?: string;
    unreadCount: number;
    updatedAt: string;
    lastMessagePreview?: string;
    participants: MatrixParticipant[];
    feed?: MatrixMessage[];
    isDirect?: boolean;
    isEncrypted?: boolean;
    phone?: string | null;
    raw?: any;
};

export type MatrixSyncResponse = {
    next_batch?: string;
    rooms?: {
        join?: Record<string, any>;
        invite?: Record<string, any>;
        leave?: Record<string, any>;
    };
};

export type MatrixInviteRoom = {
    roomId: string;
    name?: string;
    avatarUrl?: string | null;
    isSpace?: boolean;
    joinRule?: string;
    inviter?: string;
    raw?: any;
};

