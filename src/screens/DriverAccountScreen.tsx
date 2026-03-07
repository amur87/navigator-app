import React, { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, View, Text, Pressable, Linking, StyleSheet, Platform, StatusBar, Alert, TextInput } from 'react-native';
import { Button, Spinner, Switch } from 'tamagui';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { toast, ToastPosition } from '@backpackapp-io/react-native-toast';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faChevronRight,
    faCircleUser,
    faClipboardList,
    faMoneyBillWave,
    faUniversity,
    faCarSide,
    faBuilding,
    faShieldAlt,
    faFileContract,
    faBell,
    faLanguage,
    faPalette,
    faInfoCircle,
    faTrash,
    faLocationCrosshairs,
} from '@fortawesome/free-solid-svg-icons';
import Svg, { Path } from 'react-native-svg';
import { showActionSheet, abbreviateName } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getMaterialRipple } from '../utils/material-ripple';
import useAppTheme from '../hooks/use-app-theme';
import useStorage from '../hooks/use-storage';
import DeviceInfo from 'react-native-device-info';
import storage from '../utils/storage';
import GlassHeader from '../components/GlassHeader';

export const SEARCH_RADIUS_STORAGE_KEY = 'driver_search_radius_km';

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
    success: '#34C759',
};

const rowRipple = getMaterialRipple({ color: 'rgba(17,43,102,0.06)' });

type RowProps = {
    icon: any;
    title: string;
    value?: string;
    valueStyle?: object;
    onPress?: () => void;
    rightNode?: React.ReactNode;
    showChevron?: boolean;
    isLast?: boolean;
};

const AccountRow = ({ icon, title, value, valueStyle, onPress, rightNode, showChevron = true, isLast = false }: RowProps) => (
    <Pressable onPress={onPress} style={[styles.row, isLast && styles.rowLast]} android_ripple={rowRipple}>
        <View style={styles.rowIconWrap}>
            <FontAwesomeIcon icon={icon} size={18} color={COLORS.icon} />
        </View>
        <Text style={styles.rowTitle}>{title}</Text>
        {rightNode ?? (value ? <Text style={[styles.rowValue, valueStyle]}>{value}</Text> : null)}
        {showChevron ? <FontAwesomeIcon icon={faChevronRight} size={14} color={COLORS.chevron} /> : null}
    </Pressable>
);

const DriverAccountScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { language, languages, setLocale, t } = useLanguage();
    const { userColorScheme, changeScheme } = useAppTheme();
    const { driver, logout, isSigningOut, updateDriver, switchOrganization, organizations } = useAuth();
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [searchRadiusKm, setSearchRadiusKm] = useStorage<number>(SEARCH_RADIUS_STORAGE_KEY, 3);

    const getDriverValue = (key: string, fallback = '') => {
        if (!driver) return fallback;
        if (typeof (driver as any).getAttribute === 'function') {
            return (driver as any).getAttribute(key) ?? fallback;
        }
        return (driver as any)?.[key] ?? fallback;
    };

    const metric = (keys: string[], fallback: string) => {
        for (const key of keys) {
            const value = getDriverValue(key, '');
            if (value) return String(value);
        }
        return fallback;
    };

    const languageLabel = useMemo(() => {
        return language?.native || language?.name || language?.code?.toUpperCase() || 'Русский';
    }, [language]);

    if (!driver) {
        return (
            <View style={styles.screen}>
                <View style={styles.loaderWrap}>
                    <Spinner color={COLORS.accent} />
                    <Text style={styles.loaderText}>{t('common.loading')}</Text>
                </View>
            </View>
        );
    }

    const handleOpenTerms = async () => {
        const url = 'https://www.fleetbase.io/terms';
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
    };

    const handleOpenPrivacy = async () => {
        const url = 'https://www.fleetbase.io/privacy-policy';
        const supported = await Linking.canOpenURL(url);
        if (supported) await Linking.openURL(url);
    };

    const handleSignout = () => {
        logout();
        toast.success(t('AccountScreen.signedOut'));
    };

    const handleClearCache = () => {
        storage.clearStore();
        toast.success(t('AccountScreen.cacheCleared'), { position: ToastPosition.BOTTOM });
    };

    const handleToggleScheme = (enabled: boolean) => {
        const next = enabled ? 'dark' : 'light';
        if (next !== userColorScheme) changeScheme(next);
    };

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

    const handleChangeSearchRadius = () => {
        const options = ['1 км', '2 км', '3 км', '5 км', '7 км', '10 км', 'Отмена'];
        const values = [1, 2, 3, 5, 7, 10];
        showActionSheet({
            options,
            cancelButtonIndex: options.length - 1,
            onSelect: (index: number) => {
                if (index < values.length) {
                    setSearchRadiusKm(values[index]);
                    toast.success(`Радиус поиска: ${values[index]} км`);
                }
            },
        });
    };

    const handleSelectOrganization = () => {
        if (!organizations || organizations.length === 0) {
            toast.error(t('ProfileScreen.noOrganizations') ?? t('common.unavailable'));
            return;
        }
        const options = [...organizations.map((org: any) => org.name), t('common.cancel')];
        showActionSheet({
            options,
            cancelButtonIndex: options.length - 1,
            onSelect: async (index) => {
                if (index < organizations.length) await switchOrganization(organizations[index]);
            },
        });
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

    const deliveries = metric(['completed_deliveries', 'completed_orders', 'deliveries_count'], '143');
    const successRate = metric(['success_rate'], '98%');
    const earnings = metric(['total_earnings', 'earnings_total'], '12 490');
    const payout = metric(['pending_payout', 'payout_amount'], '3 200 c');
    const carBrand = metric(['vehicle_brand', 'car_brand', 'vehicle_model'], 'Lada Vesta');
    const vehicleType = metric(['vehicle_type', 'transport_type'], 'Легковой');
    const orgName = metric(['company_name', 'fleet_name'], 'Delivery Max');
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Профиль" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingTop: topInset + 48 + 12 }]}
            >
                <Pressable onPress={handleChangeProfilePhoto} android_ripple={rowRipple}>
                    <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={styles.profileCard}>
                        <View style={styles.profileAvatar}>
                            {isUploadingPhoto ? (
                                <Spinner color={COLORS.white} />
                            ) : (
                                <Text style={styles.profileAvatarText}>{abbreviateName(getDriverValue('name', 'A'))}</Text>
                            )}
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{getDriverValue('name', 'Admin')}</Text>
                            <Text style={styles.profileSub}>{getDriverValue('email')}</Text>
                            <Text style={styles.profileSub}>{getDriverValue('phone')}</Text>
                        </View>
                        <View style={styles.profileEditIcon}>
                            <FontAwesomeIcon icon={faCircleUser} size={22} color="rgba(255,255,255,0.8)" />
                        </View>
                    </LinearGradient>
                </Pressable>

                <View style={styles.stats}>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{deliveries}</Text>
                        <Text style={styles.statLabel}>Доставок</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValue}>{successRate}</Text>
                        <Text style={styles.statLabel}>Успешных</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statValueSmall}>{earnings}</Text>
                        <Text style={styles.statLabel}>Заработано</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <AccountRow icon={faClipboardList} title="Мои заказы" value={deliveries} onPress={() => navigation.navigate('DriverTaskTab' as never)} />
                    <AccountRow icon={faMoneyBillWave} title="Выплаты" value={payout} valueStyle={styles.payoutValue} />
                    <AccountRow icon={faUniversity} title="Мои реквизиты" isLast />
                </View>

                <View style={styles.section}>
                    <AccountRow icon={faCarSide} title="Автомобиль" value={carBrand} showChevron={false} />
                    <AccountRow icon={faBuilding} title="Тип транспорта" value={vehicleType} showChevron={false} isLast />
                </View>

                <View style={styles.section}>
                    <AccountRow icon={faBuilding} title="Парк" value={orgName} onPress={handleSelectOrganization} />
                    <AccountRow icon={faLocationCrosshairs} title="Радиус поиска" value={`${searchRadiusKm} км`} onPress={handleChangeSearchRadius} isLast />
                </View>

                <View style={styles.section}>
                    <AccountRow icon={faBell} title="Уведомления" />
                    <AccountRow icon={faLanguage} title="Язык" value={languageLabel} onPress={handleLanguageSelect} />
                    <AccountRow
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
                    <AccountRow icon={faInfoCircle} title="О приложении" value={`v${DeviceInfo.getVersion()} #${DeviceInfo.getBuildNumber()}`} showChevron={false} isLast />
                </View>

                <View style={styles.section}>
                    <AccountRow icon={faShieldAlt} title="Конфиденциальность" onPress={handleOpenPrivacy} />
                    <AccountRow icon={faFileContract} title="Условия пользования" onPress={handleOpenTerms} />
                    <AccountRow icon={faTrash} title="Очистить кэш" onPress={handleClearCache} isLast />
                </View>

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
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.screenBg },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loaderText: { color: COLORS.muted, fontSize: 14, fontFamily: FONTS.medium },
    scroll: {
        paddingHorizontal: 12,
        paddingBottom: 96,
        gap: 10,
    },
    profileCard: {
        borderRadius: 18,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
    },
    profileAvatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileAvatarText: { color: COLORS.white, fontSize: 20, fontFamily: FONTS.black },
    profileInfo: { flex: 1, marginLeft: 14 },
    profileName: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.white },
    profileSub: { marginTop: 2, fontSize: 12, fontFamily: FONTS.regular, color: 'rgba(255,255,255,0.7)' },
    profileEditIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stats: { flexDirection: 'row', gap: 8 },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.cardBg,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    statValue: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.text },
    statValueSmall: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.text },
    statLabel: { marginTop: 2, fontSize: 9, fontFamily: FONTS.medium, color: COLORS.muted },
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
    payoutValue: { color: COLORS.success, fontFamily: FONTS.bold },
    themeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    signOutButton: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 6,
    },
    signOutGradient: {
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    signOutText: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.white },
});

export default DriverAccountScreen;
