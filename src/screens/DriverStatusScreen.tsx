import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faClock, faCircleCheck, faPauseCircle, faBan, faRotateRight, faHeadset, faRightFromBracket } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getDriverStatusMeta, canDriverWork } from '../utils/driver-status';
import type { DriverStatus } from '../utils/driver-status';
import { getMaterialRipple } from '../utils/material-ripple';

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
    black: 'Rubik-Black',
};

const STATUS_ICONS = {
    clock: faClock,
    check: faCircleCheck,
    pause: faPauseCircle,
    ban: faBan,
};

const SUPPORT_URL = 'https://t.me/maxkg_support';

const DriverStatusScreen = () => {
    const insets = useSafeAreaInsets();
    const { driverStatus, checkDriverStatus, logout } = useAuth();
    const { language } = useLanguage();
    const localeCode = language?.code === 'ru' || language?.code === 'ky' ? language.code : 'en';
    const [isRefreshing, setIsRefreshing] = useState(false);

    const status = (driverStatus || 'pending') as DriverStatus;
    const meta = getDriverStatusMeta(status);

    // Don't render for active drivers
    if (canDriverWork(status)) return null;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await checkDriverStatus();
        } catch (_e) {
            // ignore
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSupport = () => {
        Linking.openURL(SUPPORT_URL).catch(() => {});
    };

    const handleLogout = () => {
        logout();
    };

    const title = meta.label[localeCode] || meta.label.ru;
    const description = meta.description[localeCode] || meta.description.ru;
    const icon = STATUS_ICONS[meta.icon] || faClock;

    const BUTTON_LABELS = {
        refresh: { ru: 'Обновить статус', en: 'Refresh Status', ky: 'Статусту жаңылоо' },
        support: { ru: 'Связаться с поддержкой', en: 'Contact Support', ky: 'Колдоо кызматына кайрылуу' },
        logout: { ru: 'Выйти из аккаунта', en: 'Log Out', ky: 'Аккаунттан чыгуу' },
    };

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

            <View style={styles.content}>
                {/* Icon */}
                <View style={[styles.iconCircle, { backgroundColor: meta.bgColor }]}>
                    <FontAwesomeIcon icon={icon} size={56} color={meta.color} />
                </View>

                {/* Title */}
                <Text style={styles.title}>{title}</Text>

                {/* Description */}
                <Text style={styles.description}>{description}</Text>

                {/* Actions */}
                <View style={styles.actions}>
                    {meta.actions.includes('refresh') && (
                        <Pressable
                            style={[styles.button, styles.buttonPrimary]}
                            onPress={handleRefresh}
                            disabled={isRefreshing}
                            android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.2)' })}
                        >
                            {isRefreshing ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <FontAwesomeIcon icon={faRotateRight} size={16} color="#FFFFFF" />
                            )}
                            <Text style={styles.buttonPrimaryText}>
                                {BUTTON_LABELS.refresh[localeCode] || BUTTON_LABELS.refresh.ru}
                            </Text>
                        </Pressable>
                    )}

                    {meta.actions.includes('support') && (
                        <Pressable
                            style={[styles.button, styles.buttonSecondary]}
                            onPress={handleSupport}
                            android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.08)' })}
                        >
                            <FontAwesomeIcon icon={faHeadset} size={16} color="#112b66" />
                            <Text style={styles.buttonSecondaryText}>
                                {BUTTON_LABELS.support[localeCode] || BUTTON_LABELS.support.ru}
                            </Text>
                        </Pressable>
                    )}

                    {meta.actions.includes('logout') && (
                        <Pressable
                            style={[styles.button, styles.buttonDanger]}
                            onPress={handleLogout}
                            android_ripple={getMaterialRipple({ color: 'rgba(255,59,48,0.1)' })}
                        >
                            <FontAwesomeIcon icon={faRightFromBracket} size={16} color="#FF3B30" />
                            <Text style={styles.buttonDangerText}>
                                {BUTTON_LABELS.logout[localeCode] || BUTTON_LABELS.logout.ru}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#F2F2F7',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 112,
        height: 112,
        borderRadius: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 28,
    },
    title: {
        fontSize: 24,
        fontFamily: FONTS.bold,
        color: '#112b66',
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 15,
        fontFamily: FONTS.regular,
        color: 'rgba(17,43,102,0.6)',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 36,
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 16,
        gap: 10,
        overflow: 'hidden',
    },
    buttonPrimary: {
        backgroundColor: '#112b66',
    },
    buttonPrimaryText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: '#FFFFFF',
    },
    buttonSecondary: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: 'rgba(17,43,102,0.12)',
    },
    buttonSecondaryText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: '#112b66',
    },
    buttonDanger: {
        backgroundColor: 'rgba(255,59,48,0.08)',
    },
    buttonDangerText: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: '#FF3B30',
    },
});

export default DriverStatusScreen;
