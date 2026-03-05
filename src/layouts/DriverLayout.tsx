import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, Text } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faHouse,
    faClipboardList,
    faMessage,
    faCircleUser,
} from '@fortawesome/free-solid-svg-icons';
import { later } from '../utils';
import { useNotification } from '../contexts/NotificationContext';
import { useChat } from '../contexts/ChatContext';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { useLanguage } from '../contexts/LanguageContext';
import useFleetbase from '../hooks/use-fleetbase';
import useAppTheme from '../hooks/use-app-theme';

const ACCENT = '#991A4E';
const INACTIVE_DARK = '#8e8e93';
const INACTIVE_LIGHT = '#7a7a7a';
const TAB_BAR_HEIGHT = 72;
const TAB_COUNT = 4;

const NAV_ITEMS = [
    { tab: 'DriverDashboardTab', icon: faHouse,         translationKey: 'DriverMenu.home'    },
    { tab: 'DriverTaskTab',      icon: faClipboardList, translationKey: 'DriverMenu.orders'  },
    { tab: 'DriverChatTab',      icon: faMessage,       translationKey: 'DriverMenu.chat'    },
    { tab: 'DriverAccountTab',   icon: faCircleUser,    translationKey: 'DriverMenu.account' },
];

const getCurrentScreen = (tabNavigation) => {
    const tabState = tabNavigation.getState?.();
    const currentTabRoute = tabState?.routes?.[tabState.index];
    const stackState = currentTabRoute?.state;
    const currentScreen = stackState?.routes?.[stackState.index];
    return {
        tabName: currentTabRoute?.name,
        screenName: currentScreen?.name,
        screenParams: currentScreen?.params,
    };
};

const DriverLayout = ({ children, state, _descriptors, navigation: tabNavigation }) => {
    const insets = useSafeAreaInsets();
    const { fleetbase } = useFleetbase();
    const { getChannel, unreadCount } = useChat();
    const { addNotificationListener, removeNotificationListener } = useNotification();
    const { reloadActiveOrders, allActiveOrders } = useOrderManager();
    const { appTheme, isDarkMode } = useAppTheme();
    const { t } = useLanguage();

    const currentIndex = state?.index ?? 0;
    const currentTab = state?.routes?.[currentIndex]?.name;
    const bottomOffset = insets.bottom + 8;

    // Animated indicator position
    const indicatorAnim = useRef(new Animated.Value(currentIndex)).current;
    useEffect(() => {
        Animated.spring(indicatorAnim, {
            toValue: currentIndex,
            useNativeDriver: false,
            tension: 120,
            friction: 14,
        }).start();
    }, [currentIndex, indicatorAnim]);

    const getBadge = (tab) => {
        if (tab === 'DriverTaskTab' && allActiveOrders.length > 0) { return allActiveOrders.length; }
        if (tab === 'DriverChatTab' && unreadCount > 0) { return unreadCount; }
        return null;
    };

    // Push notification handler
    useEffect(() => {
        if (!fleetbase) { return; }

        const handlePushNotification = async (notification, action) => {
            const { payload } = notification;
            const id = payload.id;
            const type = payload.type;

            if (type === 'chat_message_received' && action === 'opened') {
                try {
                    const chatChannelId = payload.channel;
                    const channel = await getChannel(chatChannelId);
                    const { tabName, screenName, screenParams } = getCurrentScreen(tabNavigation);
                    if (tabName !== 'DriverChatTab') {
                        tabNavigation.navigate('DriverChatTab', { screen: 'ChatList' });
                    }
                    if (!(screenName === 'ChatChannel' && screenParams?.channel?.uuid === chatChannelId)) {
                        later(() => {
                            tabNavigation.navigate('DriverChatTab', { screen: 'ChatChannel', params: { channel } });
                        }, 100);
                    }
                } catch (err) {
                    console.warn('Error trying to open chat channel:', err);
                }
            }

            if (typeof id === 'string' && id.startsWith('order_')) {
                reloadActiveOrders();
                try {
                    const order = await fleetbase.orders.findRecord(id);
                    const orderId = order.id;
                    const { tabName, screenName, screenParams } = getCurrentScreen(tabNavigation);
                    if (tabName !== 'DriverTaskTab') {
                        tabNavigation.navigate('DriverTaskTab', { screen: 'DriverOrderManagement' });
                    }
                    if (!(screenName === 'OrderModal' && screenParams?.order?.id === orderId)) {
                        later(() => {
                            tabNavigation.navigate('DriverTaskTab', { screen: 'OrderModal', params: { order: order.serialize() } });
                        }, 100);
                    }
                } catch (err) {
                    console.warn('Error navigating to order:', err);
                }
            }
        };

        addNotificationListener(handlePushNotification);
        return () => removeNotificationListener(handlePushNotification);
    }, [addNotificationListener, removeNotificationListener, fleetbase, tabNavigation, getChannel, reloadActiveOrders]);

    const inactiveColor = isDarkMode ? INACTIVE_DARK : INACTIVE_LIGHT;
    const glassBg = isDarkMode ? 'rgba(0,0,0,0.40)' : 'rgba(255,255,255,0.60)';
    const borderColor = isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';

    return (
        <Theme name={appTheme as any}>
            <View style={{ flex: 1 }}>
                {/* Screen content */}
                <View style={{ flex: 1, paddingBottom: TAB_BAR_HEIGHT + bottomOffset }}>
                    {children}
                </View>

                {/* Floating glass tab bar */}
                <View
                    style={[
                        styles.tabBar,
                        { bottom: bottomOffset, borderColor },
                    ]}
                >
                    {/* Frosted-glass background */}
                    <BlurView
                        blurType={isDarkMode ? 'dark' : 'light'}
                        blurAmount={25}
                        reducedTransparencyFallbackColor={glassBg}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Semi-transparent overlay tint */}
                    <View
                        style={[StyleSheet.absoluteFill, { backgroundColor: glassBg, borderRadius: 24 }]}
                        pointerEvents="none"
                    />

                    {/* Animated accent indicator line */}
                    <Animated.View
                        style={[
                            styles.indicator,
                            {
                                left: indicatorAnim.interpolate({
                                    inputRange: [0, TAB_COUNT - 1],
                                    outputRange: ['5.5%', `${(TAB_COUNT - 1) * 25 + 5.5}%`],
                                }),
                            },
                        ]}
                    />

                    {/* Tab items */}
                    {NAV_ITEMS.map((item, index) => {
                        const isActive = currentTab === item.tab;
                        const badge = getBadge(item.tab);
                        const color = isActive ? ACCENT : inactiveColor;

                        return (
                            <TouchableOpacity
                                key={item.tab}
                                onPress={() => tabNavigation.navigate(item.tab)}
                                style={styles.tabItem}
                                activeOpacity={0.65}
                            >
                                <View style={styles.iconWrap}>
                                    <FontAwesomeIcon icon={item.icon} size={24} color={color} />
                                    {badge != null && (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>
                                                {badge > 99 ? '99+' : badge}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        {
                                            color,
                                            fontWeight: isActive ? '600' : '400',
                                        },
                                    ]}
                                >
                                    {t(item.translationKey)}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </Theme>
    );
};

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        left: 16,
        right: 16,
        height: TAB_BAR_HEIGHT,
        borderRadius: 24,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        elevation: 24,
        shadowColor: '#000',
        shadowOpacity: 0.30,
        shadowRadius: 25,
        shadowOffset: { width: 0, height: 10 },
    },
    indicator: {
        position: 'absolute',
        bottom: 8,
        width: '14%',
        height: 4,
        backgroundColor: ACCENT,
        borderRadius: 10,
        zIndex: 10,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 2,
    },
    iconWrap: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 1,
    },
    tabLabel: {
        fontSize: 10,
        letterSpacing: 0.1,
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        backgroundColor: '#EF4444',
        borderRadius: 9,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.20)',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
});

export default DriverLayout;
