import React, { useState } from 'react';
import { SafeAreaView, ActivityIndicator, Pressable, Linking, ScrollView } from 'react-native';
import { Text, YStack, XStack, Button } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faCheckCircle,
    faArrowRight,
    faExclamationTriangle,
    faCarSide,
    faWarehouse,
    faIdCard,
    faPalette,
    faHashtag,
    faMotorcycle,
    faCar,
    faTruckPickup,
    faLayerGroup,
    faCalendarAlt,
    faSquareCheck,
    faSquare,
    faClock,
} from '@fortawesome/free-solid-svg-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../hooks/use-storage';
import useFleetbase from '../hooks/use-fleetbase';

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

const RegistrationCompleteScreen = ({ route }) => {
    const navigation = useNavigation<any>();
    const { language } = useLanguage();
    const { fleetbase, adapter } = useFleetbase();
    const { driver, updateDriver, updateDriverMeta } = useAuth();
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [agreed, setAgreed] = useState(false);

    const vehicleData = route.params?.vehicle;
    const licenseData = route.params?.license;
    const fleetData = route.params?.fleet;
    const vehicleType = route.params?.vehicleType;

    const vtInfo = VEHICLE_TYPE_LABELS[vehicleType] || null;
    const vehicleTypeLabel = vtInfo?.[localeCode] || vehicleType || '—';
    const colorLabel = vehicleData?.color ? (COLOR_LABELS[vehicleData.color]?.[localeCode] || vehicleData.color) : null;

    const copy = {
        en: {
            reviewTitle: 'Check your details',
            reviewSubtitle: 'Make sure everything is correct before starting',
            processing: 'Setting up your account...',
            successTitle: 'Registration Complete!',
            successSubtitle: 'Your courier account is registered and awaiting review. Once approved, you will be able to go online and accept orders.',
            start: 'Got it',
            errorTitle: 'Something went wrong',
            retry: 'Retry',
            vehicleSection: 'Vehicle',
            fleetSection: 'Fleet',
            licenseSection: "Driver's License",
            makeLabel: 'Make & Model',
            plateLabel: 'Plate Number',
            colorLabel: 'Color',
            typeLabel: 'Type',
            fleetLabel: 'Fleet',
            licenseNumLabel: 'License Number',
            licenseExpiryLabel: 'Valid Until',
            licenseCatLabel: 'Categories',
            agreementPrefix: 'By pressing "Start Working" I agree to the',
            termsLink: 'Terms of Use',
            and: 'and',
            privacyLink: 'Privacy Policy',
            agreementCheckbox: 'I agree to the terms',
        },
        ru: {
            reviewTitle: 'Проверьте данные',
            reviewSubtitle: 'Убедитесь, что всё верно, прежде чем начать',
            processing: 'Настраиваем ваш аккаунт...',
            successTitle: 'Регистрация завершена!',
            successSubtitle: 'Ваш аккаунт курьера зарегистрирован и ожидает проверки. После одобрения вы сможете выйти на линию и принимать заказы.',
            start: 'Понятно',
            errorTitle: 'Что-то пошло не так',
            retry: 'Повторить',
            vehicleSection: 'Транспорт',
            fleetSection: 'Парк',
            licenseSection: 'Водительское удостоверение',
            makeLabel: 'Марка и модель',
            plateLabel: 'Гос. номер',
            colorLabel: 'Цвет',
            typeLabel: 'Тип',
            fleetLabel: 'Парк',
            licenseNumLabel: 'Номер ВУ',
            licenseExpiryLabel: 'Действителен до',
            licenseCatLabel: 'Категории',
            agreementPrefix: 'Нажимая «Начать работу», я соглашаюсь с',
            termsLink: 'условиями использования',
            and: 'и',
            privacyLink: 'политикой конфиденциальности',
            agreementCheckbox: 'Я согласен с условиями',
        },
        ky: {
            reviewTitle: 'Маалыматтарды текшериңиз',
            reviewSubtitle: 'Баштоодон мурун бардыгы туура экенин текшериңиз',
            processing: 'Аккаунтуңуз орнотулууда...',
            successTitle: 'Каттоо аякталды!',
            successSubtitle: 'Сиздин курьер аккаунтуңуз катталган жана текшерүүнү күтүүдө. Бекитилгенден кийин линияга чыгып, заказдарды кабыл алсаңыз болот.',
            start: 'Түшүндүм',
            errorTitle: 'Бир нерсе туура эмес болду',
            retry: 'Кайра аракет',
            vehicleSection: 'Транспорт',
            fleetSection: 'Парк',
            licenseSection: 'Айдоочулук күбөлүк',
            makeLabel: 'Маркасы жана модели',
            plateLabel: 'Мамлекеттик номер',
            colorLabel: 'Түсү',
            typeLabel: 'Түрү',
            fleetLabel: 'Парк',
            licenseNumLabel: 'Күбөлүк номери',
            licenseExpiryLabel: 'Жарактуу мөөнөтү',
            licenseCatLabel: 'Категориялар',
            agreementPrefix: '«Иштей баштоо» басуу менен мен',
            termsLink: 'колдонуу шарттарына',
            and: 'жана',
            privacyLink: 'купуялык саясатына',
            agreementCheckbox: 'Мен шарттарга макулмун',
        },
    }[localeCode];

    // Safely resolve driver ID from the Fleetbase Driver resource
    const getDriverId = (): string | null => {
        if (!driver) return null;
        const d = driver as any;
        // Try getAttribute (Fleetbase Resource)
        if (typeof d.getAttribute === 'function') {
            const id = d.getAttribute('id');
            if (id) return id;
        }
        // Try direct properties
        return d.id || d.uuid || d.public_id || d.attributes?.id || null;
    };

    // Save meta directly to stored driver in MMKV (fallback when server update fails)
    const saveMetaLocally = (newMeta: Record<string, any>) => {
        try {
            const storedDriver = storage.getMap('driver') as any;
            if (storedDriver) {
                storedDriver.meta = { ...(storedDriver.meta ?? {}), ...newMeta };
                storage.setMap('driver', storedDriver);
                console.log('[RegistrationComplete] Meta saved locally to stored driver');
            }
        } catch (_e) {
            console.warn('[RegistrationComplete] Failed to save meta locally:', _e);
        }
    };

    const submitRegistration = async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        const driverId = getDriverId();
        console.log('[RegistrationComplete] Starting registration. driver id:', driverId, 'fleetbase:', !!fleetbase, 'adapter:', !!adapter);
        console.log('[RegistrationComplete] vehicleData:', JSON.stringify(vehicleData));
        console.log('[RegistrationComplete] licenseData keys:', licenseData ? Object.keys(licenseData) : 'null');
        console.log('[RegistrationComplete] fleetData:', JSON.stringify(fleetData));

        const errors: string[] = [];

        try {
            let createdVehicleId: string | null = null;

            // 1. Create vehicle via Fleetbase API
            // Accepted fields: status, make, model, year, trim, type, plate_number, vin, meta, driver
            if (vehicleData) {
                const fullMake = (vehicleData.make ?? '').trim();
                const makeParts = fullMake.split(/\s+/);
                const parsedMake = makeParts[0] || fullMake;
                const parsedModel = makeParts.length > 1 ? makeParts.slice(1).join(' ') : fullMake;

                // Resolve color key to English text label
                const colorText = vehicleData.color
                    ? (COLOR_LABELS[vehicleData.color]?.en || vehicleData.color)
                    : '';

                const vehiclePayload: Record<string, any> = {
                    make: parsedMake,
                    model: parsedModel,
                    plate_number: vehicleData.plate_number,
                    type: vehicleType,
                    status: '',
                    meta: {
                        color: colorText,
                        display_name: fullMake,
                    },
                };

                if (vehicleData.avatar) {
                    vehiclePayload.meta.avatar_url = vehicleData.avatar;
                }

                console.log('[RegistrationComplete] Creating vehicle, payload:', JSON.stringify(vehiclePayload));

                try {
                    if (fleetbase) {
                        // Use SDK Store — handles request/response lifecycle properly
                        const vehicleResource = await (fleetbase as any).vehicles.create(vehiclePayload);
                        console.log('[RegistrationComplete] SDK vehicles.create response:', JSON.stringify(vehicleResource));
                        // SDK Resource: use getAttribute or direct id
                        createdVehicleId = vehicleResource?.id
                            ?? (typeof vehicleResource?.getAttribute === 'function' ? vehicleResource.getAttribute('id') : null)
                            ?? vehicleResource?.attributes?.id
                            ?? vehicleResource?.vehicle?.id
                            ?? null;
                    } else if (adapter) {
                        // Fallback to raw adapter
                        const vehicleResponse = await adapter.post('vehicles', vehiclePayload);
                        console.log('[RegistrationComplete] adapter.post vehicles response:', JSON.stringify(vehicleResponse));
                        createdVehicleId = vehicleResponse?.id ?? vehicleResponse?.vehicle?.id ?? null;
                    } else {
                        errors.push('Fleetbase SDK not initialized');
                    }
                    console.log('[RegistrationComplete] Vehicle created, id:', createdVehicleId);
                } catch (vehicleError: any) {
                    const msg = vehicleError?.message ?? JSON.stringify(vehicleError);
                    console.warn('[RegistrationComplete] Vehicle creation FAILED:', msg);
                    console.warn('[RegistrationComplete] Vehicle error details:', JSON.stringify({
                        status: vehicleError?.response?.status,
                        data: vehicleError?.response?.data,
                    }));
                    errors.push('Vehicle: ' + msg);
                }
            }

            // 2. Save registration metadata locally (API excludes meta from driver update)
            // Vehicle create with `driver` field already set vehicle_uuid on the driver
            if (driverId) {
                const colorText = vehicleData?.color
                    ? (COLOR_LABELS[vehicleData.color]?.en || vehicleData.color)
                    : '';

                const driverMeta: Record<string, any> = {
                    vehicle_type: vehicleType,
                    vehicle_make: vehicleData?.make,
                    vehicle_plate: vehicleData?.plate_number,
                    vehicle_color: colorText,
                    vehicle_avatar: vehicleData?.avatar,
                    registration_completed: true,
                    terms_accepted: true,
                    terms_accepted_at: new Date().toISOString(),
                };

                if (createdVehicleId) {
                    driverMeta.vehicle_uuid = createdVehicleId;
                }

                if (fleetData?.id) {
                    driverMeta.fleet_id = fleetData.id;
                    driverMeta.fleet_name = fleetData.name;
                }

                if (licenseData) {
                    driverMeta.license_number = licenseData.license_number;
                    driverMeta.license_expiry = licenseData.expiry_date;
                    driverMeta.license_categories = licenseData.categories;
                }

                // Link vehicle to driver by setting vehicle_uuid on the driver record.
                // This is the ONLY way to create the relationship — Fleetbase stores it on the drivers table.
                if (createdVehicleId) {
                    try {
                        if (adapter) {
                            const driverUpdateResponse = await adapter.put(`drivers/${driverId}`, { vehicle: createdVehicleId });
                            console.log('[RegistrationComplete] Driver-vehicle linked via adapter:', JSON.stringify(driverUpdateResponse));
                        }
                    } catch (driverError: any) {
                        console.warn('[RegistrationComplete] Driver-vehicle link failed:', driverError?.message);
                        errors.push('Driver-vehicle link: ' + (driverError?.message ?? 'unknown'));
                    }
                }

                saveMetaLocally(driverMeta);
                console.log('[RegistrationComplete] Registration meta saved');
            } else {
                console.warn('[RegistrationComplete] No driver ID — cannot update driver');
                errors.push('Driver ID not found');
            }

            // 4. Upload vehicle photo (non-fatal)
            if (adapter && vehicleData?.photo_base64 && createdVehicleId) {
                try {
                    await adapter.post(`vehicles/${createdVehicleId}/upload-photo`, {
                        photo: vehicleData.photo_base64,
                    });
                    console.log('[RegistrationComplete] Vehicle photo uploaded');
                } catch (photoError) {
                    console.warn('[RegistrationComplete] Vehicle photo upload (non-fatal):', photoError);
                }
            }

            // 5. Upload license photo (non-fatal)
            if (adapter && licenseData?.license_photo_base64 && driverId) {
                try {
                    await adapter.post(`drivers/${driverId}/upload-file`, {
                        file: licenseData.license_photo_base64,
                        type: 'license_photo',
                    });
                    console.log('[RegistrationComplete] License photo uploaded');
                } catch (licensePhotoError) {
                    console.warn('[RegistrationComplete] License photo upload (non-fatal):', licensePhotoError);
                }
            }

            // 6. Assign driver to fleet (non-fatal)
            if (adapter && fleetData?.id && driverId) {
                try {
                    await adapter.post(`fleets/${fleetData.id}/assign-driver`, {
                        driver: driverId,
                    });
                    console.log('[RegistrationComplete] Fleet assigned');
                } catch (fleetError) {
                    console.warn('[RegistrationComplete] Fleet assignment (non-fatal):', fleetError);
                }
            }

            // Only vehicle creation failure is critical — block registration
            const vehicleErr = errors.find(e => e.startsWith('Vehicle:'));
            if (vehicleErr) {
                setSubmitError(vehicleErr);
            } else {
                // Save per-driver flag so BootScreen doesn't re-trigger registration flow
                const driverId = getDriverId();
                if (driverId) {
                    storage.setBool(`registration_completed_${driverId}`, true);
                }
                storage.setBool('registration_completed', true);
                setIsComplete(true);
            }
        } catch (error: any) {
            console.warn('[RegistrationComplete] Registration error:', error);
            setSubmitError(error?.message ?? 'Unknown error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStart = () => {
        navigation.reset({ index: 0, routes: [{ name: 'DriverNavigator' }] });
    };

    const handleSubmitAndStart = () => {
        submitRegistration();
    };

    const handleOpenTerms = async () => {
        try { await Linking.openURL('https://www.fleetbase.io/terms'); } catch (_e) { /* ignore */ }
    };

    const handleOpenPrivacy = async () => {
        try { await Linking.openURL('https://www.fleetbase.io/privacy-policy'); } catch (_e) { /* ignore */ }
    };

    // --- Data row component ---
    const DataRow = ({ label, value, icon }: { label: string; value: string; icon?: any }) => (
        <XStack py="$2.5" px="$1" alignItems="center">
            {icon && (
                <XStack width={28} justifyContent="center" alignItems="center" mr="$2">
                    <FontAwesomeIcon icon={icon} size={14} color="rgba(17,43,102,0.4)" />
                </XStack>
            )}
            <Text color="rgba(17,43,102,0.55)" fontSize={13} fontFamily="Rubik-Medium" width={icon ? 100 : 120}>
                {label}
            </Text>
            <Text color="#112b66" fontSize={14} fontFamily="Rubik-Bold" fontWeight="700" flex={1} textAlign="right">
                {value}
            </Text>
        </XStack>
    );

    // --- LOADING STATE ---
    if (isSubmitting) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                <YStack flex={1} justifyContent="center" alignItems="center" px="$5">
                    <ActivityIndicator size="large" color="#112b66" />
                    <Text color="#112b66" fontSize={18} fontFamily="Rubik-Bold" fontWeight="700" textAlign="center" mt="$4">
                        {copy.processing}
                    </Text>
                </YStack>
            </SafeAreaView>
        );
    }

    // --- SUCCESS STATE ---
    if (isComplete) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                <YStack flex={1} justifyContent="center" alignItems="center" px="$5">
                    <YStack width={96} height={96} borderRadius={48} bg="rgba(52,199,89,0.1)" justifyContent="center" alignItems="center">
                        <FontAwesomeIcon icon={faCheckCircle} size={56} color="#34C759" />
                    </YStack>
                    <Text color="#112b66" fontSize={26} fontFamily="Rubik-Bold" fontWeight="800" textAlign="center" mt="$5">
                        {copy.successTitle}
                    </Text>

                    {/* Moderation notice */}
                    <YStack bg="rgba(255,149,0,0.1)" borderRadius={14} px="$4" py="$3" mt="$4" width="100%">
                        <XStack alignItems="center" space="$2" mb="$1.5">
                            <FontAwesomeIcon icon={faClock} size={18} color="#FF9500" />
                            <Text color="#FF9500" fontSize={15} fontFamily="Rubik-Bold" fontWeight="700">
                                {localeCode === 'ru' ? 'На проверке' : localeCode === 'ky' ? 'Текшерүүдө' : 'Pending Review'}
                            </Text>
                        </XStack>
                        <Text color="rgba(17,43,102,0.7)" fontSize={13} fontFamily="Rubik-Regular" lineHeight={19}>
                            {copy.successSubtitle}
                        </Text>
                    </YStack>

                    <Button size="$5" onPress={handleStart} bg="#112b66" width="100%" borderRadius={20} height={52} mt="$6">
                        <Button.Text color="#FFFFFF" fontWeight="700" fontFamily="Rubik-Bold">{copy.start}</Button.Text>
                        <Button.Icon><FontAwesomeIcon icon={faArrowRight} color="#FFFFFF" size={16} /></Button.Icon>
                    </Button>
                </YStack>
            </SafeAreaView>
        );
    }

    // --- ERROR STATE ---
    if (submitError) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                <YStack flex={1} justifyContent="center" alignItems="center" px="$5">
                    <YStack width={80} height={80} borderRadius={40} bg="rgba(220,38,38,0.08)" justifyContent="center" alignItems="center">
                        <FontAwesomeIcon icon={faExclamationTriangle} size={40} color="#DC2626" />
                    </YStack>
                    <Text color="#112b66" fontSize={20} fontFamily="Rubik-Bold" fontWeight="800" textAlign="center" mt="$4">
                        {copy.errorTitle}
                    </Text>
                    <Text color="rgba(17,43,102,0.5)" fontSize={13} fontFamily="Rubik-Regular" textAlign="center" mt="$2">
                        {submitError}
                    </Text>
                    <Button size="$5" onPress={submitRegistration} bg="#112b66" width="100%" borderRadius={20} height={52} mt="$6">
                        <Button.Text color="#FFFFFF" fontWeight="700" fontFamily="Rubik-Bold">{copy.retry}</Button.Text>
                    </Button>
                    <Button size="$5" onPress={handleStart} bg="#F5F6FA" width="100%" borderRadius={20} height={52} mt="$3" borderWidth={1.5} borderColor="#D4D9E5">
                        <Button.Text color="#112b66" fontWeight="700" fontFamily="Rubik-Bold">{copy.start}</Button.Text>
                    </Button>
                </YStack>
            </SafeAreaView>
        );
    }

    // --- REVIEW STATE (default) ---
    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <YStack flex={1} px="$4" pt="$6">
                {/* Title */}
                <YStack mb="$4" px="$1">
                    <Text color="#112b66" fontSize={24} fontFamily="Rubik-Bold" fontWeight="800" mb="$2">
                        {copy.reviewTitle}
                    </Text>
                    <Text color="rgba(17,43,102,0.6)" fontSize={14} fontFamily="Rubik-Regular" lineHeight={20}>
                        {copy.reviewSubtitle}
                    </Text>
                </YStack>

                <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                    <YStack space="$3" pb="$4">
                        {/* Vehicle section */}
                        {vehicleData && (
                            <YStack bg="#F5F6FA" borderRadius={16} px="$4" py="$3">
                                <Text color="#112b66" fontSize={15} fontFamily="Rubik-Bold" fontWeight="800" mb="$1">
                                    {copy.vehicleSection}
                                </Text>
                                <DataRow icon={vtInfo?.icon || faCarSide} label={copy.typeLabel} value={vehicleTypeLabel} />
                                <DataRow icon={faCarSide} label={copy.makeLabel} value={vehicleData.make} />
                                <DataRow icon={faHashtag} label={copy.plateLabel} value={vehicleData.plate_number} />
                                {colorLabel && <DataRow icon={faPalette} label={copy.colorLabel} value={colorLabel} />}
                            </YStack>
                        )}

                        {/* Fleet section */}
                        {fleetData && (
                            <YStack bg="#F5F6FA" borderRadius={16} px="$4" py="$3">
                                <Text color="#112b66" fontSize={15} fontFamily="Rubik-Bold" fontWeight="800" mb="$1">
                                    {copy.fleetSection}
                                </Text>
                                <DataRow icon={faWarehouse} label={copy.fleetLabel} value={fleetData.name} />
                            </YStack>
                        )}

                        {/* License section */}
                        {licenseData && (
                            <YStack bg="#F5F6FA" borderRadius={16} px="$4" py="$3">
                                <Text color="#112b66" fontSize={15} fontFamily="Rubik-Bold" fontWeight="800" mb="$1">
                                    {copy.licenseSection}
                                </Text>
                                <DataRow icon={faIdCard} label={copy.licenseNumLabel} value={licenseData.license_number} />
                                <DataRow icon={faCalendarAlt} label={copy.licenseExpiryLabel} value={licenseData.expiry_date} />
                                <DataRow icon={faLayerGroup} label={copy.licenseCatLabel} value={licenseData.categories?.join(', ')} />
                            </YStack>
                        )}
                    </YStack>
                </ScrollView>

                {/* Agreement + Button */}
                <YStack pb="$5" pt="$2">
                    {/* Checkbox */}
                    <Pressable onPress={() => setAgreed(!agreed)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, paddingHorizontal: 4 }}>
                        <FontAwesomeIcon
                            icon={agreed ? faSquareCheck : faSquare}
                            size={22}
                            color={agreed ? '#112b66' : 'rgba(17,43,102,0.3)'}
                            style={{ marginTop: 1 }}
                        />
                        <Text color="rgba(17,43,102,0.7)" fontSize={12} lineHeight={18} fontFamily="Rubik-Medium" ml="$2" flex={1}>
                            {copy.agreementPrefix}{' '}
                            <Text color="#112b66" textDecorationLine="underline" onPress={handleOpenTerms} fontFamily="Rubik-Medium" fontSize={12}>
                                {copy.termsLink}
                            </Text>
                            {' '}{copy.and}{' '}
                            <Text color="#112b66" textDecorationLine="underline" onPress={handleOpenPrivacy} fontFamily="Rubik-Medium" fontSize={12}>
                                {copy.privacyLink}
                            </Text>
                        </Text>
                    </Pressable>

                    {/* Start button */}
                    <Button
                        size="$5"
                        onPress={handleSubmitAndStart}
                        bg="#112b66"
                        width="100%"
                        borderRadius={20}
                        height={52}
                        opacity={agreed ? 1 : 0.4}
                        disabled={!agreed}
                    >
                        <Button.Text color="#FFFFFF" fontWeight="700" fontFamily="Rubik-Bold">
                            {copy.start}
                        </Button.Text>
                        <Button.Icon>
                            <FontAwesomeIcon icon={faArrowRight} color="#FFFFFF" size={16} />
                        </Button.Icon>
                    </Button>
                </YStack>
            </YStack>
        </SafeAreaView>
    );
};

export default RegistrationCompleteScreen;
