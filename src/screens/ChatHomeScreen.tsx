import React, { useCallback, useEffect, useRef } from 'react';
import { FlatList, Pressable, RefreshControl, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faComments, faLock } from '@fortawesome/free-solid-svg-icons';
import GlassHeader from '../components/GlassHeader';
import { format, isToday, isYesterday } from 'date-fns';
import { useChat } from '../contexts/ChatContext';
import ChatParticipantAvatar from '../components/ChatParticipantAvatar';
import { getMaterialRipple } from '../utils/material-ripple';

const formatRoomTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    if (isToday(date)) {
        return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
        return 'вчера';
    }
    return format(date, 'dd.MM');
};

const ChatHomeScreen = () => {
    const navigation = useNavigation<any>();
    const { channels, getChannels, setCurrentChannel, isLoading, capabilities, providerMode } = useChat();
    const getChannelsRef = useRef(getChannels);

    useEffect(() => {
        getChannelsRef.current = getChannels;
    }, [getChannels]);

    useFocusEffect(
        useCallback(() => {
            getChannelsRef.current?.().catch((error) => console.warn('Unable to refresh chats:', error));
        }, [])
    );

    const handleOpenChannel = (channel: any) => {
        setCurrentChannel(channel);
        navigation.navigate('ChatChannel', { channelId: channel.id });
    };

    const insets = useSafeAreaInsets();
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.safeArea}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader
                title="Чаты"
                rightContent={
                    <View style={styles.headerBadge}>
                        <FontAwesomeIcon icon={faLock} size={10} color='#112b66' />
                        <Text style={styles.headerBadgeText}>{capabilities.e2ee ? 'E2EE' : 'Secure'}</Text>
                    </View>
                }
            />

            <FlatList
                data={channels}
                keyExtractor={(item) => item.id}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={getChannels} tintColor='#991A4E' />}
                contentContainerStyle={[channels.length ? styles.listContent : styles.emptyContent, { paddingTop: topInset + 48 + 8 }]}
                renderItem={({ item }) => (
                    <Pressable onPress={() => handleOpenChannel(item)} style={styles.row} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.06)' })}>
                        <ChatParticipantAvatar participant={{ avatarUrl: item.avatarUrl, avatarFallback: item.avatarFallback, isOnline: item.statusText === 'В сети', name: item.title }} size={54} />
                        <View style={styles.rowBody}>
                            <View style={styles.rowTop}>
                                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                                <Text style={styles.rowTime}>{formatRoomTime(item.updatedAt)}</Text>
                            </View>
                            <View style={styles.rowBottom}>
                                <Text style={styles.rowPreview} numberOfLines={2}>{item.lastMessagePreview || 'Нет сообщений'}</Text>
                                {item.unreadCount > 0 ? (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>
                    </Pressable>
                )}
                ListHeaderComponent={
                    <View style={styles.heroCard}>
                        <View style={styles.heroIconWrap}>
                            <FontAwesomeIcon icon={faComments} size={18} color='#991A4E' />
                        </View>
                        <View style={styles.heroBody}>
                            <Text style={styles.heroTitle}>Поддержка, клиенты и диспетчер</Text>
                            <Text style={styles.heroText}>Отдельный чат в стиле Telegram. Старые комнаты Fleetbase больше не должны попадать в этот список.</Text>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>Чаты пока недоступны</Text>
                        <Text style={styles.emptyText}>Экран работает только в Matrix-режиме. Если комнаты не появились, значит Matrix bootstrap еще не поднялся.</Text>
                    </View>
                }
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#f2f3f7',
    },
    headerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#ffffff',
    },
    headerBadgeText: {
        color: '#112b66',
        fontSize: 12,
        fontFamily: 'Rubik-Medium',
    },
    listContent: {
        paddingHorizontal: 14,
        paddingBottom: 24,
    },
    emptyContent: {
        flexGrow: 1,
        paddingHorizontal: 14,
        paddingBottom: 24,
    },
    heroCard: {
        marginBottom: 12,
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#ffffff',
        flexDirection: 'row',
        gap: 12,
    },
    heroIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(153,26,78,0.10)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroBody: {
        flex: 1,
    },
    heroTitle: {
        color: '#111111',
        fontSize: 15,
        fontFamily: 'Rubik-Bold',
        marginBottom: 4,
    },
    heroText: {
        color: '#6e6e73',
        fontSize: 13,
        lineHeight: 18,
        fontFamily: 'Rubik-Regular',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#ffffff',
        borderRadius: 22,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 10,
        overflow: 'hidden',
    },
    rowBody: {
        flex: 1,
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
        gap: 10,
    },
    rowBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    rowTitle: {
        flex: 1,
        color: '#111111',
        fontSize: 16,
        fontFamily: 'Rubik-Medium',
    },
    rowTime: {
        color: '#989aa1',
        fontSize: 12,
        fontFamily: 'Rubik-Regular',
    },
    rowPreview: {
        flex: 1,
        color: '#6e6e73',
        fontSize: 13,
        lineHeight: 18,
        fontFamily: 'Rubik-Regular',
    },
    unreadBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#991A4E',
    },
    unreadText: {
        color: '#ffffff',
        fontSize: 11,
        fontFamily: 'Rubik-Bold',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    emptyTitle: {
        color: '#111111',
        fontSize: 18,
        fontFamily: 'Rubik-Bold',
        marginBottom: 8,
    },
    emptyText: {
        color: '#6e6e73',
        fontSize: 14,
        lineHeight: 20,
        fontFamily: 'Rubik-Regular',
        textAlign: 'center',
    },
});

export default ChatHomeScreen;

