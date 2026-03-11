import React, { useState, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, View, Text, Pressable, StyleSheet, StatusBar } from 'react-native';
import { Spinner } from 'tamagui';
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
    faWallet,
    faCarSide,
    faBuilding,
    faLocationCrosshairs,
    faUser,
    faCog,
    faInfoCircle,
    faMotorcycle,
    faCar,
    faTruckPickup,
    faPalette,
} from '@fortawesome/free-solid-svg-icons';
import { showActionSheet, abbreviateName } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getDriverStatusMeta } from '../utils/driver-status';
import { getMaterialRipple } from '../utils/material-ripple';
import useStorage from '../hooks/use-storage';
import useFleetbase from '../hooks/use-fleetbase';
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

const VEHICLE_TYPE_LABELS = {
    motorbike: { ru: 'Мотобайк', en: 'Motorbike', ky: 'Мотобайк', icon: faMotorcycle },
    car: { ru: 'Автомобиль', en: 'Car', ky: 'Автомобиль', icon: faCar },
    van: { ru: 'Лёгкий коммерческий', en: 'Light Commercial', ky: 'Жеңил коммерциялык', icon: faTruckPickup },
};

const COLOR_LABELS = {
    white: { ru: 'Белый', en: 'White', ky: 'Ак' },
    black: { ru: 'Чёрный', en: 'Black', ky: 'Кара' },
    silver: { ru: 'Серебристый', en: 'Silver', ky: 'Күмүш' },
    red: { ru: 'Красный', en: 'Red', ky: 'Кызыл' },
    blue: { ru: 'Синий', en: 'Blue', ky: 'Көк' },
    green: { ru: 'Зелёный', en: 'Green', ky: 'Жашыл' },
    yellow: { ru: 'Жёлтый', en: 'Yellow', ky: 'Сары' },
    gray: { ru: 'Серый', en: 'Gray', ky: 'Боз' },
};

const LicensePlate = ({ plateNumber }: { plateNumber: string }) => {
    if (!plateNumber) return null;

    // Parse KG plate format: "01KG 777 AAA" or "01 KG 777 AAA" or free text
    const normalized = plateNumber.replace(/\s+/g, '').trim().toUpperCase();
    const match = normalized.match(/^(\d{1,2})KG(\d{2,3})([A-Z]{2,3})$/);

    const region = match ? match[1].padStart(2, '0') : '';
    const digits = match ? match[2] : '';
    const letters = match ? match[3] : '';
    const isFull = !!match;

    return (
        <View style={plateStyles.plateOuter}>
            <View style={plateStyles.plate}>
                {isFull ? (
                    <>
                        {/* Left block: region on top, flag+KG on bottom */}
                        <View style={plateStyles.leftBlock}>
                            <Text style={plateStyles.regionText}>{region}</Text>
                            <View style={plateStyles.flagKgRow}>
                                <View style={plateStyles.flagWrap}>
                                    <View style={plateStyles.flagRedBg}>
                                        <View style={plateStyles.flagSun} />
                                    </View>
                                </View>
                                <Text style={plateStyles.kgText}>KG</Text>
                            </View>
                        </View>
                        {/* Right block: large number */}
                        <View style={plateStyles.mainSection}>
                            <Text style={plateStyles.mainNumber}>{digits}</Text>
                            <Text style={plateStyles.mainLetters}>{letters}</Text>
                        </View>
                    </>
                ) : (
                    <View style={plateStyles.mainSection}>
                        <Text style={plateStyles.mainNumber}>{normalized}</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

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
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t, language } = useLanguage();
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const { driver, updateDriver, switchOrganization, organizations, loadOrganizations, driverStatus, phone: authPhone } = useAuth();
    const { fleetbase, adapter } = useFleetbase();
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [searchRadiusKm, setSearchRadiusKm] = useStorage<number>(SEARCH_RADIUS_STORAGE_KEY, 3);
    const [vehicleFromApi, setVehicleFromApi] = useState<any>(null);

    const getDriverValue = (key: string, fallback = '') => {
        if (!driver) return fallback;
        if (typeof (driver as any).getAttribute === 'function') {
            return (driver as any).getAttribute(key) ?? fallback;
        }
        return (driver as any)?.[key] ?? fallback;
    };

    const getDriverMeta = () => {
        if (!driver) return {};
        if (typeof (driver as any).getAttribute === 'function') {
            return (driver as any).getAttribute('meta') ?? {};
        }
        return (driver as any)?.meta ?? {};
    };

    const metric = (keys: string[], fallback: string) => {
        for (const key of keys) {
            const value = getDriverValue(key, '');
            if (value) return String(value);
        }
        return fallback;
    };

    // Safely resolve driver ID
    const getDriverId = (): string | null => {
        if (!driver) return null;
        const d = driver as any;
        if (typeof d.getAttribute === 'function') {
            const id = d.getAttribute('id');
            if (id) return id;
        }
        return d.id || d.uuid || d.public_id || d.attributes?.id || null;
    };

    // Fetch fresh driver data (with meta) and vehicle from API
    const [freshMeta, setFreshMeta] = useState<Record<string, any> | null>(null);

    useEffect(() => {
        const fetchDriverAndVehicle = async () => {
            if (!driver) return;
            const driverId = getDriverId();
            if (!driverId) {
                console.warn('[DriverAccountScreen] No driver ID found');
                return;
            }

            try {
                let driverData: any = null;

                // 1. Fetch fresh driver via SDK Store (preferred) or raw adapter
                if (fleetbase) {
                    const driverResource = await (fleetbase as any).drivers.findRecord(driverId);
                    console.log('[DriverAccountScreen] SDK drivers.findRecord response:', JSON.stringify(driverResource));
                    // SDK Resource — attributes are stored directly
                    driverData = driverResource?.attributes ?? driverResource;
                } else if (adapter) {
                    const driverResponse = await adapter.get(`drivers/${driverId}`);
                    console.log('[DriverAccountScreen] adapter.get drivers response:', JSON.stringify(driverResponse));
                    driverData = driverResponse?.driver ?? driverResponse?.data ?? driverResponse;
                }

                if (!driverData) return;

                // Extract meta from API response
                const apiMeta = driverData?.meta ?? null;
                if (apiMeta && typeof apiMeta === 'object') {
                    console.log('[DriverAccountScreen] API meta:', JSON.stringify(apiMeta));
                    setFreshMeta(apiMeta);
                }

                // Extract vehicle — check embedded, then fetch by UUID
                const vehicleUuid = driverData?.vehicle_uuid ?? driverData?.current_vehicle_uuid ?? apiMeta?.vehicle_uuid ?? '';
                const embeddedVehicle = driverData?.current_vehicle ?? driverData?.vehicle ?? null;

                if (embeddedVehicle && typeof embeddedVehicle === 'object') {
                    console.log('[DriverAccountScreen] Embedded vehicle:', JSON.stringify(embeddedVehicle));
                    setVehicleFromApi(embeddedVehicle);
                } else if (vehicleUuid) {
                    try {
                        let vehicleData: any = null;
                        if (fleetbase) {
                            const vehicleResource = await (fleetbase as any).vehicles.findRecord(vehicleUuid);
                            console.log('[DriverAccountScreen] SDK vehicles.findRecord response:', JSON.stringify(vehicleResource));
                            vehicleData = vehicleResource?.attributes ?? vehicleResource;
                        } else if (adapter) {
                            const vehicleResp = await adapter.get(`vehicles/${vehicleUuid}`);
                            vehicleData = vehicleResp?.vehicle ?? vehicleResp?.data ?? vehicleResp;
                        }
                        if (vehicleData && typeof vehicleData === 'object') {
                            setVehicleFromApi(vehicleData);
                        }
                    } catch (vErr) {
                        console.warn('[DriverAccountScreen] Failed to fetch vehicle:', vErr);
                    }
                }
            } catch (error) {
                console.warn('[DriverAccountScreen] Failed to fetch driver data:', error);
            }
        };
        fetchDriverAndVehicle();
    }, [fleetbase, adapter, driver]);

    // Load organizations for fleet/park display
    useEffect(() => {
        if (driver && loadOrganizations) {
            loadOrganizations();
        }
    }, [driver, loadOrganizations]);

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

    // Meta: prefer fresh from API, then from driver resource
    const localMeta = getDriverMeta();
    const meta = (freshMeta && Object.keys(freshMeta).length > 0) ? freshMeta : localMeta;

    const deliveries = metric(['completed_deliveries', 'completed_orders', 'deliveries_count'], '0');
    const successRate = metric(['success_rate'], '0%');
    const earnings = metric(['total_earnings', 'earnings_total'], '0');
    const payout = metric(['pending_payout', 'payout_amount'], '0 c');

    // Vehicle data: API vehicle first, then meta, then driver attributes
    const apiVehicleAttr = (key: string) => {
        if (!vehicleFromApi) return '';
        return vehicleFromApi?.attributes?.[key] ?? vehicleFromApi?.[key] ?? '';
    };
    const apiVehicleMeta = (key: string) => {
        if (!vehicleFromApi) return '';
        const vmeta = vehicleFromApi?.attributes?.meta ?? vehicleFromApi?.meta ?? {};
        return vmeta?.[key] ?? '';
    };
    // Display name: vehicle meta.display_name > make + model > driver meta
    const vehicleDisplayName = apiVehicleMeta('display_name');
    const vehicleMake = vehicleDisplayName || apiVehicleAttr('make') || apiVehicleAttr('model') || meta?.vehicle_make || metric(['vehicle_brand', 'car_brand', 'vehicle_model'], '—');
    const vehicleTypeKey = apiVehicleAttr('type') || meta?.vehicle_type || metric(['vehicle_type', 'transport_type'], '');
    const vehiclePlate = apiVehicleAttr('plate_number') || meta?.vehicle_plate || metric(['vehicle_plate', 'plate_number'], '');
    const vehicleTypeInfo = VEHICLE_TYPE_LABELS[vehicleTypeKey] || null;
    const vehicleTypeLabel = vehicleTypeInfo?.[localeCode] || vehicleTypeKey || '—';
    const vehicleTypeIcon = vehicleTypeInfo?.icon || faCarSide;

    // Vehicle color: from vehicle meta.color > vehicle top-level > driver meta
    const vehicleColorRaw = apiVehicleMeta('color') || apiVehicleAttr('color') || meta?.vehicle_color || metric(['vehicle_color'], '');
    // Try to match against COLOR_LABELS keys first, then display as-is (already text from API)
    const vehicleColorLabel = COLOR_LABELS[vehicleColorRaw]?.[localeCode] || vehicleColorRaw || '—';

    // Phone: try multiple attribute keys, fall back to auth context phone
    const rawPhone = getDriverValue('phone', '') || getDriverValue('phone_number', '') || getDriverValue('mobile', '') || authPhone || '';
    // Ensure full format with +996 for KG numbers
    const driverPhone = (() => {
        if (!rawPhone) return '';
        const digits = rawPhone.replace(/[^\d+]/g, '');
        if (digits.startsWith('+')) return digits;
        if (digits.startsWith('996')) return '+' + digits;
        if (digits.startsWith('0')) return '+996' + digits.slice(1);
        if (digits.length === 9) return '+996' + digits;
        return rawPhone;
    })();

    // Driver status from AuthContext (reactive, updates automatically via polling)
    const statusMeta = getDriverStatusMeta(driverStatus);
    const statusInfo = { label: statusMeta.label, color: statusMeta.color, bg: statusMeta.bgColor };
    const statusLabel = statusInfo.label[localeCode] || statusInfo.label.en;

    // Fleet/Park name: from organizations API, then meta, then driver attributes
    const currentOrg = Array.isArray(organizations) && organizations.length > 0 ? organizations[0] : null;
    const orgName = currentOrg?.name || meta?.fleet_name || metric(['company_name', 'fleet_name'], '—');
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
                            {getDriverValue('email') ? <Text style={styles.profileSub}>{getDriverValue('email')}</Text> : null}
                            <Text style={styles.profileSub}>{driverPhone || '—'}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                            <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
                            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusLabel}</Text>
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
                    <AccountRow icon={faMoneyBillWave} title="Выплаты" value={payout} valueStyle={styles.payoutValue} onPress={() => navigation.navigate('Payouts')} />
                    <AccountRow icon={faWallet} title="Баланс" onPress={() => navigation.navigate('Balance')} isLast />
                </View>

                <View style={styles.section}>
                    <AccountRow icon={faCarSide} title="Автомобиль" value={vehicleMake} showChevron={false} />
                    <AccountRow icon={vehicleTypeIcon} title="Тип транспорта" value={vehicleTypeLabel} showChevron={false} />
                    <AccountRow icon={faPalette} title="Цвет" value={vehicleColorLabel} showChevron={false} isLast={!vehiclePlate} />
                    {vehiclePlate ? (
                        <View style={[styles.row, styles.rowLast, { justifyContent: 'center', paddingVertical: 16 }]}>
                            <LicensePlate plateNumber={vehiclePlate} />
                        </View>
                    ) : null}
                </View>

                <View style={styles.section}>
                    <AccountRow icon={faBuilding} title="Автопарк" value={orgName} onPress={handleSelectOrganization} />
                    <AccountRow icon={faLocationCrosshairs} title="Радиус поиска" value={`${searchRadiusKm} км`} onPress={handleChangeSearchRadius} isLast />
                </View>

                <View style={styles.section}>
                    <AccountRow icon={faUser} title="Профиль" onPress={() => navigation.navigate('ProfileDetails')} />
                    <AccountRow icon={faCog} title="Настройки" onPress={() => navigation.navigate('Settings')} />
                    <AccountRow icon={faInfoCircle} title="Информация" onPress={() => navigation.navigate('Info')} isLast />
                </View>
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
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 5,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    statusText: {
        fontSize: 11,
        fontFamily: FONTS.bold,
    },
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
});

const plateStyles = StyleSheet.create({
    plateOuter: {
        alignItems: 'center',
    },
    plate: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#1A1A1A',
        borderRadius: 6,
        overflow: 'hidden',
        height: 50,
        alignItems: 'stretch',
    },
    leftBlock: {
        width: 44,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderRightWidth: 1.5,
        borderRightColor: '#1A1A1A',
        paddingVertical: 3,
    },
    regionText: {
        fontSize: 16,
        fontFamily: FONTS.black,
        color: '#1A1A1A',
        lineHeight: 18,
    },
    flagKgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 1,
        gap: 2,
    },
    flagWrap: {
        width: 20,
        height: 13,
        borderRadius: 1,
        overflow: 'hidden',
        borderWidth: 0.5,
        borderColor: '#CCC',
    },
    flagRedBg: {
        flex: 1,
        backgroundColor: '#E8112D',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flagSun: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#FFC72C',
    },
    kgText: {
        fontSize: 8,
        fontFamily: FONTS.bold,
        color: '#1A1A1A',
        letterSpacing: 0.5,
    },
    mainSection: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        gap: 4,
    },
    mainNumber: {
        fontSize: 26,
        fontFamily: FONTS.black,
        color: '#1A1A1A',
        letterSpacing: 2,
    },
    mainLetters: {
        fontSize: 26,
        fontFamily: FONTS.black,
        color: '#1A1A1A',
        letterSpacing: 2,
    },
});

export default DriverAccountScreen;
