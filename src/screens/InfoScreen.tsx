import React from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faChevronRight,
    faShieldAlt,
    faFileContract,
    faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import { getMaterialRipple } from '../utils/material-ripple';
import DeviceInfo from 'react-native-device-info';
import GlassHeader from '../components/GlassHeader';

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
};

const COLORS = {
    screenBg: '#F2F2F7',
    cardBg: '#FFFFFF',
    text: '#111111',
    muted: '#8E8E93',
    icon: '#AEAEB2',
    chevron: '#C7C7CC',
    border: 'rgba(0,0,0,0.06)',
};

const rowRipple = getMaterialRipple({ color: 'rgba(17,43,102,0.06)' });

type RowProps = {
    icon: any;
    title: string;
    value?: string;
    onPress?: () => void;
    isLast?: boolean;
};

const InfoRow = ({ icon, title, value, onPress, isLast = false }: RowProps) => (
    <Pressable onPress={onPress} style={[styles.row, isLast && styles.rowLast]} android_ripple={rowRipple}>
        <View style={styles.rowIconWrap}>
            <FontAwesomeIcon icon={icon} size={18} color={COLORS.icon} />
        </View>
        <Text style={styles.rowTitle}>{title}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        <FontAwesomeIcon icon={faChevronRight} size={14} color={COLORS.chevron} />
    </Pressable>
);

const InfoScreen = () => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Информация" />

            <View style={[styles.content, { paddingTop: topInset + 48 + 12 }]}>
                <View style={styles.section}>
                    <InfoRow icon={faShieldAlt} title="Конфиденциальность" onPress={() => navigation.navigate('PrivacyPolicy')} />
                    <InfoRow icon={faFileContract} title="Условия пользования" onPress={() => navigation.navigate('TermsOfUse')} />
                    <InfoRow icon={faInfoCircle} title="О приложении" value={`v${DeviceInfo.getVersion()}`} onPress={() => navigation.navigate('AboutApp')} isLast />
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
});

export default InfoScreen;
