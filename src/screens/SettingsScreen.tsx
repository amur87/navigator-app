import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { Switch } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast, ToastPosition } from '@backpackapp-io/react-native-toast';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faChevronRight,
    faBell,
    faLanguage,
    faPalette,
    faTrash,
} from '@fortawesome/free-solid-svg-icons';
import { showActionSheet } from '../utils';
import { useLanguage } from '../contexts/LanguageContext';
import { getMaterialRipple } from '../utils/material-ripple';
import useAppTheme from '../hooks/use-app-theme';
import storage from '../utils/storage';
import GlassHeader from '../components/GlassHeader';

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
};

const COLORS = {
    screenBg: '#F2F2F7',
    cardBg: '#FFFFFF',
    accent: '#991A4E',
    text: '#111111',
    muted: '#8E8E93',
    icon: '#AEAEB2',
    chevron: '#C7C7CC',
    border: 'rgba(0,0,0,0.06)',
    white: '#FFFFFF',
};

const rowRipple = getMaterialRipple({ color: 'rgba(17,43,102,0.06)' });

type RowProps = {
    icon: any;
    title: string;
    value?: string;
    onPress?: () => void;
    rightNode?: React.ReactNode;
    showChevron?: boolean;
    isLast?: boolean;
};

const SettingsRow = ({ icon, title, value, onPress, rightNode, showChevron = true, isLast = false }: RowProps) => (
    <Pressable onPress={onPress} style={[styles.row, isLast && styles.rowLast]} android_ripple={rowRipple}>
        <View style={styles.rowIconWrap}>
            <FontAwesomeIcon icon={icon} size={18} color={COLORS.icon} />
        </View>
        <Text style={styles.rowTitle}>{title}</Text>
        {rightNode ?? (value ? <Text style={styles.rowValue}>{value}</Text> : null)}
        {showChevron ? <FontAwesomeIcon icon={faChevronRight} size={14} color={COLORS.chevron} /> : null}
    </Pressable>
);

const SettingsScreen = () => {
    const insets = useSafeAreaInsets();
    const { language, languages, setLocale, t } = useLanguage();
    const { userColorScheme, changeScheme } = useAppTheme();

    const languageLabel = useMemo(() => {
        return language?.native || language?.name || language?.code?.toUpperCase() || 'Русский';
    }, [language]);

    const handleLanguageSelect = () => {
        const preferredCodes = ['ru', 'ky', 'en'];
        const available = preferredCodes.map((code) => languages.find((lang) => lang.code === code)).filter(Boolean) as any[];
        const options = [...available.map((lang) => lang.native || lang.name || lang.code.toUpperCase()), t('common.cancel')];
        showActionSheet({
            options,
            cancelButtonIndex: options.length - 1,
            onSelect: (index) => {
                if (index < available.length) setLocale(available[index].code);
            },
        });
    };

    const handleToggleScheme = (enabled: boolean) => {
        const next = enabled ? 'dark' : 'light';
        if (next !== userColorScheme) changeScheme(next);
    };

    const handleClearCache = () => {
        storage.clearStore();
        toast.success(t('AccountScreen.cacheCleared'), { position: ToastPosition.BOTTOM });
    };

    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Настройки" />

            <View style={[styles.content, { paddingTop: topInset + 48 + 12 }]}>
                <View style={styles.section}>
                    <SettingsRow icon={faBell} title="Уведомления" />
                    <SettingsRow icon={faLanguage} title="Язык" value={languageLabel} onPress={handleLanguageSelect} />
                    <SettingsRow
                        icon={faPalette}
                        title="Тема"
                        showChevron={false}
                        onPress={() => handleToggleScheme(userColorScheme !== 'dark')}
                        rightNode={
                            <View style={styles.themeWrap}>
                                <Text style={styles.rowValue}>{userColorScheme === 'dark' ? 'Темная' : 'Светлая'}</Text>
                                <Switch
                                    checked={userColorScheme === 'dark'}
                                    onCheckedChange={handleToggleScheme}
                                    bg={userColorScheme === 'dark' ? COLORS.accent : '#E5E5EA'}
                                    borderWidth={0}
                                >
                                    <Switch.Thumb animation="quick" bg={COLORS.white} />
                                </Switch>
                            </View>
                        }
                    />
                    <SettingsRow icon={faTrash} title="Очистить кэш" onPress={handleClearCache} isLast />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.screenBg },
    content: {
        paddingHorizontal: 12,
        gap: 10,
    },
    section: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 14,
        overflow: 'hidden',
    },
    row: {
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
        gap: 10,
    },
    rowLast: { borderBottomWidth: 0 },
    rowIconWrap: { width: 28, alignItems: 'center', justifyContent: 'center' },
    rowTitle: { flex: 1, fontSize: 15, fontFamily: FONTS.medium, color: COLORS.text },
    rowValue: { fontSize: 13, fontFamily: FONTS.regular, color: COLORS.muted },
    themeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

export default SettingsScreen;
