import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronLeft, faEllipsisVertical, faPhone } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import ChatFeed from '../components/ChatFeed';
import ChatKeyboard from '../components/ChatKeyboard';
import ChatParticipantAvatar from '../components/ChatParticipantAvatar';
import { getMaterialRipple } from '../utils/material-ripple';
import matrixConfig from '../config/matrix';

const ChatChannelScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { driver } = useAuth();
    const {
        currentChannel,
        channels,
        getChannel,
        setCurrentChannel,
        sendTextMessage,
        sendImageAttachment,
        sendGenericFileAttachment,
        sendVoiceAttachment,
        sendLocationMessage,
        sendSticker,
        markChannelRead,
        callChannel,
        capabilities,
    } = useChat();
    const currentUserId = driver?.getAttribute?.('user') ?? driver?.user ?? driver?.id;
    const [isSending, setIsSending] = useState(false);
    const chatFeedRef = useRef<any>(null);
    const loadRoomRef = useRef<(() => Promise<void>) | null>(null);
    const fallbackRoomId =
        matrixConfig.supportRoomId ||
        channels.find((item: any) => !item?.raw?.seeded && !item?.raw?.fromSpace && !item?.raw?.invited)?.id ||
        channels[0]?.id;
    const roomId = route.params?.channelId ?? route.params?.channel?.id ?? currentChannel?.id ?? fallbackRoomId;

    const room = useMemo(() => {
        if (currentChannel?.id === roomId) {
            return currentChannel;
        }
        return null;
    }, [currentChannel, roomId]);

    const composerDisabledReason = room?.raw?.serverMisconfigurationMessage
        ? room.raw.serverMisconfigurationMessage
        : room?.raw?.requiresInvite
        ? 'Отправка недоступна, пока сервер Matrix не добавит вас в комнату.'
        : room?.raw?.e2eeError
          ? room.raw.e2eeError
          : '';
    const e2eeStatusText = room?.raw?.e2eeStatusText || '';

    const loadRoom = useCallback(async () => {
        if (!roomId) {
            return;
        }

        const loadedRoom = await getChannel(roomId);
        if (loadedRoom) {
            setCurrentChannel(loadedRoom);
            await markChannelRead(loadedRoom);
        }
    }, [getChannel, markChannelRead, roomId, setCurrentChannel]);

    useEffect(() => {
        loadRoomRef.current = loadRoom;
    }, [loadRoom]);

    useEffect(() => {
        loadRoomRef.current?.().catch((error) => console.warn('Unable to load room:', error));
    }, [roomId]);

    useEffect(() => {
        if (room?.feed?.length) {
            chatFeedRef.current?.scrollToEnd();
        }
    }, [room?.feed?.length]);

    const executeAction = async (action: () => Promise<any>) => {
        if (isSending) {
            return;
        }

        setIsSending(true);
        try {
            await action();
        } catch (error: any) {
            console.warn('ChatChannel action failed:', error?.stack ?? error);
            Alert.alert('Чат', error?.message ?? 'Не удалось выполнить действие в чате.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerAction} android_ripple={getMaterialRipple({ color: 'rgba(153,26,78,0.10)' })}>
                    <FontAwesomeIcon icon={faChevronLeft} size={17} color='#991A4E' />
                </Pressable>
                <View style={styles.headerBody}>
                    <ChatParticipantAvatar
                        participant={{
                            avatarUrl: room?.avatarUrl,
                            avatarFallback: room?.avatarFallback,
                            isOnline: room?.statusText === 'В сети',
                            name: room?.title,
                        }}
                        size={38}
                    />
                    <View style={styles.headerTextWrap}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{room?.title ?? 'Чат'}</Text>
                        <Text style={styles.headerStatus}>{room?.statusText ?? (capabilities.matrixActive ? 'Matrix' : 'Офлайн')}</Text>
                    </View>
                </View>
                <Pressable onPress={() => executeAction(() => callChannel(room))} style={styles.headerAction} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.10)' })}>
                    <FontAwesomeIcon icon={faPhone} size={15} color='#112b66' />
                </Pressable>
                <Pressable
                    onPress={() =>
                        Alert.alert(
                            'Чат',
                            capabilities.matrixActive
                                ? 'Комната Matrix подключена. Дополнительные действия зависят от политик комнаты и прав аккаунта.'
                                : 'Комната Matrix пока недоступна.'
                        )
                    }
                    style={styles.headerAction}
                    android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.10)' })}
                >
                    <FontAwesomeIcon icon={faEllipsisVertical} size={15} color='#112b66' />
                </Pressable>
            </View>

            <View style={styles.feedWrap}>
                {room ? (
                    <>
                        {composerDisabledReason ? (
                            <View style={styles.warningBanner}>
                                <Text style={styles.warningText}>{composerDisabledReason}</Text>
                            </View>
                        ) : null}
                        {!composerDisabledReason && e2eeStatusText ? (
                            <View style={styles.warningBanner}>
                                <Text style={styles.warningText}>{e2eeStatusText}</Text>
                            </View>
                        ) : null}
                        <ChatFeed ref={chatFeedRef} channel={room} currentUserId={currentUserId} />
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>Загружаем чат...</Text>
                    </View>
                )}
            </View>

            {room ? (
                <ChatKeyboard
                    channel={room}
                    capabilities={capabilities}
                    onSend={(text) => executeAction(() => sendTextMessage(room, text))}
                    onSendPhoto={(asset) => executeAction(() => sendImageAttachment(room, asset))}
                    onSendFile={(file) => executeAction(() => sendGenericFileAttachment(room, file))}
                    onSendVoice={(asset) => executeAction(() => sendVoiceAttachment(room, asset))}
                    onSendLocation={(coords) => executeAction(() => sendLocationMessage(room, coords))}
                    onSendSticker={(sticker) => executeAction(() => sendSticker(room, sticker))}
                    onStartCall={() => executeAction(() => callChannel(room))}
                    disabled={Boolean(composerDisabledReason)}
                    disabledReason={composerDisabledReason}
                />
            ) : null}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#eef1f6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 10,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    headerAction: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    headerBody: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
    },
    headerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    headerTitle: {
        color: '#111111',
        fontSize: 16,
        fontFamily: 'Rubik-Bold',
    },
    headerStatus: {
        marginTop: 2,
        color: '#34C759',
        fontSize: 11,
        fontFamily: 'Rubik-Regular',
    },
    feedWrap: {
        flex: 1,
        backgroundColor: '#eef1f6',
    },
    warningBanner: {
        marginHorizontal: 12,
        marginTop: 10,
        marginBottom: 2,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: 'rgba(255,204,0,0.18)',
    },
    warningText: {
        color: '#5c4c00',
        fontSize: 12,
        lineHeight: 17,
        fontFamily: 'Rubik-Regular',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        color: '#6e6e73',
        fontSize: 14,
        fontFamily: 'Rubik-Regular',
    },
});

export default ChatChannelScreen;
