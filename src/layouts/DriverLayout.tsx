import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { Theme, Text } from 'tamagui';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from '@react-native-community/blur';
import { later } from '../utils';
import { useNotification } from '../contexts/NotificationContext';
import { useChat } from '../contexts/ChatContext';
import { useOrderManager } from '../contexts/OrderManagerContext';
import useFleetbase from '../hooks/use-fleetbase';
import useAppTheme from '../hooks/use-app-theme';
import { getMaterialRipple } from '../utils/material-ripple';

const ACCENT = '#991A4E';
const BADGE_ACCENT = '#991A4E';
const BRAND_BLUE = '#112b66';
const INACTIVE = 'rgba(17,43,102,0.72)';
const TAB_BAR_HEIGHT = 68;
const TAB_BAR_RADIUS = 26;

const TabIcon = ({ type, color }: { type: 'home' | 'orders' | 'chat' | 'account'; color: string }) => {
    let d = '';
    if (type === 'home') {
        d = 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z';
    } else if (type === 'orders') {
        d = 'M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 12H4V9h16v10zM4 3h16v2H4z';
    } else if (type === 'chat') {
        d = 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z';
    } else if (type === 'account') {
        d = 'M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z';
    }

    return (
        <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path d={d} fill={color} />
        </Svg>
    );
};

const NAV_ITEMS = [
    { tab: 'DriverDashboardTab', icon: 'home', label: '\u0413\u043b\u0430\u0432\u043d\u0430\u044f' },
    { tab: 'DriverTaskTab', icon: 'orders', label: '\u0417\u0430\u043a\u0430\u0437\u044b' },
    { tab: 'DriverChatTab', icon: 'chat', label: '\u0427\u0430\u0442' },
    { tab: 'DriverAccountTab', icon: 'account', label: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c' },
];

const getActiveRoute = (route) => {
    if (!route) {
        return null;
    }

    const nestedState = route.state;
    if (!nestedState?.routes?.length) {
        return route;
    }

    const nestedRoute = nestedState.routes[nestedState.index ?? 0];
    return getActiveRoute(nestedRoute) ?? route;
};

const getCurrentScreen = (tabNavigation) => {
    const tabState = tabNavigation.getState?.();
    const currentTabRoute = tabState?.routes?.[tabState.index];
    const activeRoute = getActiveRoute(currentTabRoute);

    return {
        tabName: currentTabRoute?.name,
        screenName: activeRoute?.name,
        screenParams: activeRoute?.params,
    };
};

const DriverLayout = ({ children, state, _descriptors, navigation: tabNavigation }) => {
    const { fleetbase } = useFleetbase();
    const { getChannel, unreadCount } = useChat();
    const { addNotificationListener, removeNotificationListener } = useNotification();
    const { reloadActiveOrders } = useOrderManager();
    const { appTheme } = useAppTheme();

    const currentIndex = state?.index ?? 0;
    const currentTab = state?.routes?.[currentIndex]?.name;
    const { screenName } = getCurrentScreen(tabNavigation);
    const visibleItems = NAV_ITEMS.filter((item) => state?.routes?.some((route) => route.name === item.tab));
    const [tabBarWidth, setTabBarWidth] = useState(0);
    const indicatorX = useRef(new Animated.Value(0)).current;
    const tabScales = useRef(NAV_ITEMS.map(() => new Animated.Value(1))).current;
    const activeIndex = Math.max(0, visibleItems.findIndex((item) => item.tab === currentTab));
    const tabWidth = tabBarWidth > 0 && visibleItems.length > 0 ? tabBarWidth / visibleItems.length : 0;
    const shouldHideTabBar = currentTab === 'DriverChatTab' && screenName === 'ChatChannel';

    useEffect(() => {
        if (!tabWidth) { return; }

        Animated.spring(indicatorX, {
            toValue: activeIndex * tabWidth,
            speed: 18,
            bounciness: 5,
            useNativeDriver: true,
        }).start();
    }, [activeIndex, indicatorX, tabWidth]);

    const getBadge = (tab) => {
        if (tab === 'DriverChatTab' && currentTab === 'DriverChatTab') { return null; }
        if (tab === 'DriverChatTab' && unreadCount > 0) { return unreadCount; }
        return null;
    };

    const animateTabPress = (index: number) => {
        const scale = tabScales[index];
        if (!scale) { return; }

        Animated.sequence([
            Animated.timing(scale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.06, duration: 100, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
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
                        tabNavigation.navigate('DriverChatTab', { screen: 'ChatHome' });
                    }
                    if (!(screenName === 'ChatChannel' && screenParams?.channel?.uuid === chatChannelId)) {
                        later(() => {
                            tabNavigation.navigate('DriverChatTab', { screen: 'ChatChannel', params: { channelId: channel?.id ?? chatChannelId } });
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

    return (
        <Theme name={appTheme as any}>
            <View style={styles.root}>
                <View style={styles.content}>
                    {children}
                </View>

                {!shouldHideTabBar ? (
                    <View
                        style={styles.tabBar}
                        onLayout={(event) => setTabBarWidth(event.nativeEvent.layout.width)}
                    >
                        <View style={styles.tabBarGlassClip}>
                            <BlurView
                                style={styles.tabBarBlur}
                                blurType={Platform.OS === 'ios' ? (appTheme === 'dark' ? 'dark' : 'light') : 'light'}
                                blurAmount={Platform.OS === 'ios' ? 30 : 16}
                                reducedTransparencyFallbackColor={Platform.OS === 'ios' ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.72)'}
                            />
                        </View>
                        <View style={styles.tabBarGlassBase} />
                        <View style={styles.tabBarMatte} />
                        {visibleItems.length > 0 ? (
                            <Animated.View
                                pointerEvents="none"
                                style={[
                                    styles.activeGlass,
                                    {
                                        width: tabWidth > 12 ? tabWidth - 12 : tabWidth || `${100 / visibleItems.length}%`,
                                        transform: [{ translateX: indicatorX }],
                                    },
                                ]}
                            />
                        ) : null}
                        <View style={styles.tabsRow}>
                            {visibleItems.map((item) => {
                                const isActive = currentTab === item.tab;
                                const badge = getBadge(item.tab);
                                const color = isActive ? ACCENT : INACTIVE;
                                const route = state?.routes?.find((tabRoute) => tabRoute.name === item.tab);
                                const navItemIndex = NAV_ITEMS.findIndex((navItem) => navItem.tab === item.tab);

                                return (
                                    <Animated.View
                                        key={item.tab}
                                        style={[
                                            styles.tabItem,
                                            { transform: [{ scale: tabScales[navItemIndex] ?? 1 }] },
                                        ]}
                                    >
                                        <Pressable
                                            onPress={() => {
                                                animateTabPress(navItemIndex);
                                                if (!route) { return; }
                                                const event = tabNavigation.emit({
                                                    type: 'tabPress',
                                                    target: route.key,
                                                    canPreventDefault: true,
                                                });
                                                if (!isActive && !event.defaultPrevented) {
                                                    tabNavigation.navigate(item.tab);
                                                }
                                            }}
                                            style={styles.tabPressArea}
                                            android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.10)', foreground: true })}
                                        >
                                            {badge != null ? <View style={styles.badge} /> : null}
                                            <View style={styles.iconWrap}>
                                                <TabIcon type={item.icon as any} color={color} />
                                            </View>
                                            <Text
                                                style={[
                                                    styles.tabLabel,
                                                    isActive ? styles.tabLabelActive : styles.tabLabelInactive,
                                                ]}
                                                color={color}
                                            >
                                                {item.label}
                                            </Text>
                                        </Pressable>
                                    </Animated.View>
                                );
                            })}
                        </View>
                    </View>
                ) : null}
            </View>
        </Theme>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
    tabBar: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        height: TAB_BAR_HEIGHT,
        borderRadius: TAB_BAR_RADIUS,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        shadowColor: '#101522',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: Platform.OS === 'ios' ? 0.14 : 0.08,
        shadowRadius: Platform.OS === 'ios' ? 24 : 16,
        elevation: Platform.OS === 'android' ? 6 : 0,
    },
    tabBarGlassClip: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: TAB_BAR_RADIUS,
        overflow: 'hidden',
    },
    tabBarBlur: {
        ...StyleSheet.absoluteFillObject,
    },
    tabBarGlassBase: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: TAB_BAR_RADIUS,
        backgroundColor: Platform.select({
            ios: 'rgba(255,255,255,0.12)',
            android: 'rgba(255,255,255,0.36)',
            default: 'rgba(255,255,255,0.36)',
        }),
    },
    tabBarMatte: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: TAB_BAR_RADIUS,
        backgroundColor: Platform.select({
            ios: 'rgba(248,248,252,0.18)',
            android: 'rgba(248,248,252,0.48)',
            default: 'rgba(248,248,252,0.48)',
        }),
    },
    activeGlass: {
        position: 'absolute',
        left: 7,
        top: 7,
        height: TAB_BAR_HEIGHT - 14,
        borderRadius: 999,
        backgroundColor: Platform.select({
            ios: 'rgba(255,255,255,0.34)',
            android: 'rgba(255,255,255,0.24)',
            default: 'rgba(255,255,255,0.24)',
        }),
        shadowColor: 'rgba(255,255,255,0.9)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0.08,
        shadowRadius: Platform.OS === 'ios' ? 16 : 8,
        elevation: Platform.OS === 'android' ? 1 : 0,
    },
    tabsRow: {
        position: 'relative',
        zIndex: 2,
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tabItem: {
        flex: 1,
        height: '100%',
    },
    tabPressArea: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        borderRadius: 999,
        overflow: 'hidden',
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 22,
        minHeight: 22,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600',
    },
    tabLabelActive: {
        fontWeight: '700',
        opacity: 0.98,
    },
    tabLabelInactive: {
        fontWeight: '600',
        opacity: 0.9,
    },
    badge: {
        position: 'absolute',
        top: 9,
        right: 15,
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: BADGE_ACCENT,
        borderWidth: 1.5,
        borderColor: '#F2F2F7',
        zIndex: 3,
    },
});

export default DriverLayout;
