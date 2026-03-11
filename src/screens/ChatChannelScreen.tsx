import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faAngleLeft, faEllipsisVertical, faPhone } from '@fortawesome/free-solid-svg-icons';
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
    const insets = useSafeAreaInsets();
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
    const [showMenu, setShowMenu] = useState(false);
    const chatFeedRef = useRef<any>(null);
    const loadRoomRef = useRef<(() => Promise<void>) | null>(null);
    const menuAnim = useRef(new Animated.Value(0)).current;
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

    const isOnline = room?.statusText === 'В сети';
    const statusText = room?.statusText ?? (capabilities.matrixActive ? 'Matrix' : 'Офлайн');

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

    const toggleMenu = () => {
        if (showMenu) {
            Animated.timing(menuAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setShowMenu(false));
        } else {
            setShowMenu(true);
            Animated.timing(menuAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        }
    };

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

    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.container}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

            {/* Header */}
            <View style={[styles.header, { paddingTop: topInset + 8 }]}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={styles.backBtn}
                    android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.15)' })}
                >
                    <FontAwesomeIcon icon={faAngleLeft} size={22} color='#FFFFFF' />
                </Pressable>

                <Pressable
                    onPress={() => navigation.navigate('ChatParticipants', { channelId: roomId })}
                    style={styles.headerInfo}
                >
                    <ChatParticipantAvatar
                        participant={{
                            avatarUrl: room?.avatarUrl,
                            avatarFallback: room?.avatarFallback,
                            isOnline,
                            name: room?.title,
                        }}
                        size={40}
                    />
                    <View style={styles.headerTexts}>
                        <Text style={styles.headerName} numberOfLines={1}>{room?.title ?? 'Чат'}</Text>
                        <Text style={[styles.headerStatus, isOnline && styles.headerStatusOnline]} numberOfLines={1}>
                            {statusText}
                        </Text>
                    </View>
                </Pressable>

                <View style={styles.headerActions}>
                    <Pressable
                        onPress={() => executeAction(() => callChannel(room))}
                        style={styles.headerIconBtn}
                        android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.15)' })}
                    >
                        <FontAwesomeIcon icon={faPhone} size={15} color='#FFFFFF' />
                    </Pressable>
                    <Pressable
                        onPress={toggleMenu}
                        style={styles.headerIconBtn}
                        android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.15)' })}
                    >
                        <FontAwesomeIcon icon={faEllipsisVertical} size={16} color='#FFFFFF' />
                    </Pressable>
                </View>
            </View>

            {/* Dropdown Menu */}
            {showMenu ? (
                <>
                    <Pressable style={styles.menuOverlay} onPress={toggleMenu} />
                    <Animated.View style={[
                        styles.menuDropdown,
                        { top: topInset + 56 },
                        {
                            opacity: menuAnim,
                            transform: [{ scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
                        },
                    ]}>
                        <Pressable
                            style={styles.menuItem}
                            onPress={() => { toggleMenu(); navigation.navigate('ChatParticipants', { channelId: roomId }); }}
                            android_ripple={getMaterialRipple({ color: 'rgba(0,0,0,0.06)' })}
                        >
                            <Text style={styles.menuItemText}>Участники</Text>
                        </Pressable>
                        <Pressable
                            style={styles.menuItem}
                            onPress={() => {
                                toggleMenu();
                                Alert.alert(
                                    'Информация',
                                    capabilities.matrixActive
                                        ? 'Комната Matrix подключена. Дополнительные действия зависят от политик комнаты и прав аккаунта.'
                                        : 'Комната Matrix пока недоступна.'
                                );
                            }}
                            android_ripple={getMaterialRipple({ color: 'rgba(0,0,0,0.06)' })}
                        >
                            <Text style={styles.menuItemText}>О комнате</Text>
                        </Pressable>
                    </Animated.View>
                </>
            ) : null}

            {/* KeyboardAvoidingView wraps feed + input so input rises above keyboard */}
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                {/* Warning banners */}
                {composerDisabledReason ? (
                    <View style={styles.warningBanner}>
                        <Text style={styles.warningText}>{composerDisabledReason}</Text>
                    </View>
                ) : null}
                {!composerDisabledReason && e2eeStatusText ? (
                    <View style={styles.e2eeBanner}>
                        <Text style={styles.e2eeText}>{e2eeStatusText}</Text>
                    </View>
                ) : null}

                {/* Chat Feed */}
                <View style={styles.feedWrap}>
                    {room ? (
                        <ChatFeed ref={chatFeedRef} channel={room} currentUserId={currentUserId} />
                    ) : (
                        <View style={styles.emptyState}>
                            <View style={styles.loadingDots}>
                                <View style={[styles.dot, styles.dot1]} />
                                <View style={[styles.dot, styles.dot2]} />
                                <View style={[styles.dot, styles.dot3]} />
                            </View>
                            <Text style={styles.emptyTitle}>Загружаем чат...</Text>
                        </View>
                    )}
                </View>

                {/* Keyboard / Input */}
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
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e8e0d8',
    },
    keyboardAvoid: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 10,
        paddingHorizontal: 6,
        backgroundColor: '#6b1434',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginLeft: 2,
        minWidth: 0,
    },
    headerTexts: {
        flex: 1,
        minWidth: 0,
    },
    headerName: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Rubik-SemiBold',
        letterSpacing: 0.1,
    },
    headerStatus: {
        marginTop: 1,
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        fontFamily: 'Rubik-Regular',
    },
    headerStatusOnline: {
        color: '#8cf5a0',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    headerIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    menuOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
    },
    menuDropdown: {
        position: 'absolute',
        right: 12,
        zIndex: 101,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 4,
        minWidth: 180,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    menuItem: {
        paddingHorizontal: 18,
        paddingVertical: 14,
        overflow: 'hidden',
    },
    menuItemText: {
        color: '#111111',
        fontSize: 15,
        fontFamily: 'Rubik-Regular',
    },
    warningBanner: {
        marginHorizontal: 14,
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255,193,7,0.18)',
    },
    warningText: {
        color: '#5c4c00',
        fontSize: 12,
        lineHeight: 17,
        fontFamily: 'Rubik-Regular',
    },
    e2eeBanner: {
        alignSelf: 'center',
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,213,79,0.22)',
    },
    e2eeText: {
        color: '#6d5600',
        fontSize: 11,
        fontFamily: 'Rubik-Regular',
    },
    feedWrap: {
        flex: 1,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    loadingDots: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(107,20,52,0.35)',
    },
    dot1: { opacity: 0.4 },
    dot2: { opacity: 0.6 },
    dot3: { opacity: 0.8 },
    emptyTitle: {
        color: '#8e8e93',
        fontSize: 14,
        fontFamily: 'Rubik-Regular',
    },
});

export default ChatChannelScreen;
