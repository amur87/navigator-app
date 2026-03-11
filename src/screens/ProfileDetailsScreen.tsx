import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, View, Text, Pressable, StyleSheet, StatusBar, Alert } from 'react-native';
import { Spinner } from 'tamagui';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { toast } from '@backpackapp-io/react-native-toast';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faChevronRight,
    faUser,
    faPhone,
    faCamera,
    faUniversity,
} from '@fortawesome/free-solid-svg-icons';
import Svg, { Path } from 'react-native-svg';
import { showActionSheet, abbreviateName } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getMaterialRipple } from '../utils/material-ripple';
import GlassHeader from '../components/GlassHeader';

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
    black: 'Rubik-Black',
};

const COLORS = {
    screenBg: '#F2F2F7',
    cardBg: '#FFFFFF',
    accent: '#991A4E',
    navy: '#142A65',
    navyMid: '#1E3C8A',
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
    showChevron?: boolean;
    isLast?: boolean;
};

const ProfileRow = ({ icon, title, value, onPress, showChevron = true, isLast = false }: RowProps) => (
    <Pressable onPress={onPress} style={[styles.row, isLast && styles.rowLast]} android_ripple={rowRipple}>
        <View style={styles.rowIconWrap}>
            <FontAwesomeIcon icon={icon} size={18} color={COLORS.icon} />
        </View>
        <Text style={styles.rowTitle}>{title}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {showChevron ? <FontAwesomeIcon icon={faChevronRight} size={14} color={COLORS.chevron} /> : null}
    </Pressable>
);

const ProfileDetailsScreen = () => {
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useLanguage();
    const { driver, logout, isSigningOut, updateDriver } = useAuth();
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const getDriverValue = (key: string, fallback = '') => {
        if (!driver) return fallback;
        if (typeof (driver as any).getAttribute === 'function') {
            return (driver as any).getAttribute(key) ?? fallback;
        }
        return (driver as any)?.[key] ?? fallback;
    };

    if (!driver) return null;

    const handleEditName = () => {
        navigation.navigate('EditAccountProperty', {
            property: {
                key: 'name',
                name: 'Имя Фамилия',
                component: 'text',
            },
        });
    };

    const handleChangePhone = () => {
        navigation.navigate('ChangePhone');
    };

    const handleOpenBankDetails = () => {
        navigation.navigate('BankDetails');
    };

    const handleUpdateProfilePhoto = async (response: any) => {
        const asset = response?.assets?.[0];
        if (!asset?.base64) return;
        setIsUploadingPhoto(true);
        try {
            await updateDriver({ photo: asset.base64 });
            toast.success(t('AccountScreen.photoChanged'));
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleRemoveProfilePhoto = async () => {
        setIsUploadingPhoto(true);
        try {
            await updateDriver({ photo: 'REMOVE' });
            toast.success(t('AccountScreen.photoRemoved'));
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleChangeProfilePhoto = () => {
        showActionSheet({
            options: [
                t('AccountScreen.changeProfilePhotoOptions.takePhoto'),
                t('AccountScreen.changeProfilePhotoOptions.photoLibrary'),
                t('AccountScreen.changeProfilePhotoOptions.deleteProfilePhoto'),
                t('common.cancel'),
            ],
            cancelButtonIndex: 3,
            destructiveButtonIndex: 2,
            onSelect: (index) => {
                if (index === 0) launchCamera({ includeBase64: true }, handleUpdateProfilePhoto);
                else if (index === 1) launchImageLibrary({ includeBase64: true }, handleUpdateProfilePhoto);
                else if (index === 2) handleRemoveProfilePhoto();
            },
        });
    };

    const handleSignout = () => {
        logout();
        toast.success(t('AccountScreen.signedOut'));
    };

    const handleDeleteProfile = () => {
        Alert.alert(
            'Удалить профиль',
            'Вы уверены, что хотите удалить свой профиль? Это действие необратимо.',
            [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Удалить',
                    style: 'destructive',
                    onPress: () => {
                        logout();
                        toast.success('Запрос на удаление отправлен');
                    },
                },
            ]
        );
    };

    const driverName = getDriverValue('name', '');
    const driverPhone = getDriverValue('phone', '');
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Профиль" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingTop: topInset + 48 + 12 }]}
            >
                {/* Avatar card */}
                <Pressable onPress={handleChangeProfilePhoto} android_ripple={rowRipple}>
                    <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={styles.avatarCard}>
                        <View style={styles.avatar}>
                            {isUploadingPhoto ? (
                                <Spinner color={COLORS.white} />
                            ) : (
                                <Text style={styles.avatarText}>{abbreviateName(driverName || 'A')}</Text>
                            )}
                        </View>
                        <Text style={styles.avatarHint}>Нажмите, чтобы изменить фото</Text>
                    </LinearGradient>
                </Pressable>

                {/* Profile fields */}
                <View style={styles.section}>
                    <ProfileRow
                        icon={faUser}
                        title="Имя Фамилия"
                        value={driverName || 'Указать'}
                        onPress={handleEditName}
                    />
                    <ProfileRow
                        icon={faPhone}
                        title="Номер телефона"
                        value={driverPhone || 'Указать'}
                        onPress={handleChangePhone}
                    />
                    <ProfileRow
                        icon={faCamera}
                        title="Фото профиля"
                        value="Изменить"
                        onPress={handleChangeProfilePhoto}
                    />
                    <ProfileRow
                        icon={faUniversity}
                        title="Реквизиты банка"
                        onPress={handleOpenBankDetails}
                        isLast
                    />
                </View>

                {/* Sign out */}
                <Pressable style={styles.signOutButton} onPress={handleSignout} android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.20)', foreground: true })}>
                    <LinearGradient colors={[COLORS.accent, '#C0245E']} style={styles.signOutGradient}>
                        {isSigningOut ? (
                            <Spinner color={COLORS.white} />
                        ) : (
                            <>
                                <Svg width={18} height={18} viewBox="0 0 24 24">
                                    <Path fill="#fff" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                                </Svg>
                                <Text style={styles.signOutText}>Выйти</Text>
                            </>
                        )}
                    </LinearGradient>
                </Pressable>

                {/* Delete profile */}
                <Pressable onPress={handleDeleteProfile} style={styles.deleteWrap}>
                    <Text style={styles.deleteText}>Удалить профиль</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.screenBg },
    scroll: {
        paddingHorizontal: 12,
        paddingBottom: 96,
        gap: 10,
    },
    avatarCard: {
        borderRadius: 18,
        padding: 24,
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: COLORS.white, fontSize: 28, fontFamily: FONTS.black },
    avatarHint: {
        marginTop: 10,
        fontSize: 12,
        fontFamily: FONTS.regular,
        color: 'rgba(255,255,255,0.6)',
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
    signOutButton: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 6,
    },
    signOutGradient: {
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    signOutText: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.white },
    deleteWrap: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 20,
    },
    deleteText: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.muted,
        opacity: 0.5,
    },
});

export default ProfileDetailsScreen;
