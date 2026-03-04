import React, { useEffect, useState, useCallback } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, Text, YStack } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faBars,
    faTimes,
    faGaugeHigh,
    faClipboardList,
    faFlag,
    faWalkieTalkie,
    faUser,
} from '@fortawesome/free-solid-svg-icons';
import { later } from '../utils';
import { useNotification } from '../contexts/NotificationContext';
import { useChat } from '../contexts/ChatContext';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { useLanguage } from '../contexts/LanguageContext';
import useFleetbase from '../hooks/use-fleetbase';
import useAppTheme from '../hooks/use-app-theme';

const YANDEX_BLUE = '#112b66';
const YANDEX_BLACK = '#1F1F1F';

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

const NAV_ITEMS = [
    { tab: 'DriverDashboardTab', icon: faGaugeHigh,    translationKey: 'DriverMenu.home'    },
    { tab: 'DriverTaskTab',      icon: faClipboardList, translationKey: 'DriverMenu.orders'  },
    { tab: 'DriverReportTab',    icon: faFlag,          translationKey: 'DriverMenu.reports' },
    { tab: 'DriverChatTab',      icon: faWalkieTalkie,  translationKey: 'DriverMenu.chat'    },
    { tab: 'DriverAccountTab',   icon: faUser,          translationKey: 'DriverMenu.account' },
];

const DriverLayout = ({ children, state, _descriptors, navigation: tabNavigation }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { fleetbase } = useFleetbase();
    const { getChannel } = useChat();
    const { unreadCount } = useChat();
    const { addNotificationListener, removeNotificationListener } = useNotification();
    const { reloadActiveOrders, allActiveOrders } = useOrderManager();
    const { appTheme, isDarkMode } = useAppTheme();
    const { t } = useLanguage();

    const [menuOpen, setMenuOpen] = useState(false);

    const bgColor   = isDarkMode ? '#2A2A2A' : '#FFFFFF';
    const textColor = isDarkMode ? '#FFFFFF' : YANDEX_BLACK;
    const mutedColor = isDarkMode ? '#B8B8B8' : '#737373';
    const btnBg     = isDarkMode ? '#2A2A2A' : '#F5F5F5';
    const btnBorder = isDarkMode ? '#3A3A3A' : '#E2E8F0';

    const currentTab = state?.routes?.[state?.index]?.name;
    const showHamburger = currentTab === 'DriverDashboardTab';

    useEffect(() => {
        if (!showHamburger && menuOpen) {
            setMenuOpen(false);
        }
    }, [showHamburger, menuOpen]);

    const handleNavItem = useCallback(
        (tab) => {
            tabNavigation.navigate(tab);
            setMenuOpen(false);
        },
        [tabNavigation]
    );

    const getBadge = (tab) => {
        if (tab === 'DriverTaskTab' && allActiveOrders.length > 0) {return allActiveOrders.length;}
        if (tab === 'DriverChatTab' && unreadCount > 0) {return unreadCount;}
        return null;
    };

    // Push notification handler
    useEffect(() => {
        if (!fleetbase) {return;}

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
    }, [addNotificationListener, removeNotificationListener, fleetbase, tabNavigation, navigation, getChannel, reloadActiveOrders]);

    return (
        <Theme name={appTheme as any}>
            <View style={{ width: '100%', height: '100%', flex: 1 }}>
                {children}

                {/* Floating hamburger button - only on dashboard */}
                {showHamburger && (
                    <View style={[styles.hamburgerWrap, { top: insets.top + 12 }]}>
                        <TouchableOpacity
                            style={[styles.hamburgerBtn, { backgroundColor: btnBg, borderColor: btnBorder }]}
                            onPress={() => setMenuOpen(true)}
                            activeOpacity={0.75}
                        >
                            <FontAwesomeIcon icon={faBars} size={18} color={textColor} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Slide-in menu */}
                {menuOpen && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                        {/* Backdrop */}
                        <Pressable
                            style={[StyleSheet.absoluteFill, styles.backdrop]}
                            onPress={() => setMenuOpen(false)}
                        />

                        {/* Menu panel */}
                        <View style={[styles.menuPanel, { backgroundColor: bgColor, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 }]}>
                            {/* Close button */}
                            <TouchableOpacity style={styles.closeBtn} onPress={() => setMenuOpen(false)} activeOpacity={0.7}>
                                <FontAwesomeIcon icon={faTimes} size={20} color={mutedColor} />
                            </TouchableOpacity>

                            {/* Nav items */}
                            <YStack mt="$4" gap="$1">
                                {NAV_ITEMS.map((item) => {
                                    const isActive = currentTab === item.tab;
                                    const badge = getBadge(item.tab);
                                    return (
                                        <TouchableOpacity
                                            key={item.tab}
                                            onPress={() => handleNavItem(item.tab)}
                                            activeOpacity={0.75}
                                            style={[
                                                styles.menuItem,
                                                isActive && { backgroundColor: YANDEX_BLUE },
                                            ]}
                                        >
                                            <View style={styles.menuItemIcon}>
                                                <FontAwesomeIcon
                                                    icon={item.icon}
                                                    size={20}
                                                    color={isActive ? '#FFFFFF' : mutedColor}
                                                />
                                                {badge != null && (
                                                    <View style={styles.badge}>
                                                        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text
                                                style={[
                                                    styles.menuItemLabel,
                                                    { color: isActive ? '#FFFFFF' : textColor },
                                                    isActive && { fontWeight: '700' },
                                                ]}
                                            >
                                                {t(item.translationKey)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </YStack>
                        </View>
                    </View>
                )}
            </View>
        </Theme>
    );
};

const styles = StyleSheet.create({
    hamburgerWrap: {
        position: 'absolute',
        left: 12,
        zIndex: 200,
    },
    hamburgerBtn: {
        width: 44,
        height: 44,
        borderRadius: 10,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        borderWidth: 1,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    backdrop: {
        backgroundColor: 'rgba(0,0,0,0.45)',
        zIndex: 300,
    },
    menuPanel: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: '72%',
        zIndex: 400,
        paddingHorizontal: 16,
        elevation: 20,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 4, height: 0 },
    },
    closeBtn: {
        alignSelf: 'flex-end',
        padding: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        marginBottom: 2,
    },
    menuItemIcon: {
        width: 28,
        alignItems: 'center',
        position: 'relative',
    },
    menuItemLabel: {
        marginLeft: 16,
        fontSize: 16,
        fontWeight: '400',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -8,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
});

export default DriverLayout;

