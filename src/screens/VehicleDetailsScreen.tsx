import React, { useState, useCallback, useEffect } from 'react';
import { SafeAreaView, Pressable, Image, Platform, Alert } from 'react-native';
import { Text, YStack, XStack, Button, ScrollView } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCamera, faArrowRight, faPalette, faHashtag, faCarSide, faImage } from '@fortawesome/free-solid-svg-icons';
import { useNavigation } from '@react-navigation/native';
import { toast } from '@backpackapp-io/react-native-toast';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useLanguage } from '../contexts/LanguageContext';
import useFleetbase from '../hooks/use-fleetbase';
import Input from '../components/Input';
import AuthBackButton from '../components/AuthBackButton';
import { getMaterialRipple } from '../utils/material-ripple';

const COLORS = [
    { key: 'white', hex: '#FFFFFF', border: '#D4D9E5', labelRu: 'Белый', labelEn: 'White', labelKy: 'Ак' },
    { key: 'black', hex: '#1F1F1F', border: '#1F1F1F', labelRu: 'Чёрный', labelEn: 'Black', labelKy: 'Кара' },
    { key: 'silver', hex: '#C0C0C0', border: '#A0A0A0', labelRu: 'Серебристый', labelEn: 'Silver', labelKy: 'Күмүш' },
    { key: 'red', hex: '#DC2626', border: '#DC2626', labelRu: 'Красный', labelEn: 'Red', labelKy: 'Кызыл' },
    { key: 'blue', hex: '#2563EB', border: '#2563EB', labelRu: 'Синий', labelEn: 'Blue', labelKy: 'Көк' },
    { key: 'green', hex: '#16A34A', border: '#16A34A', labelRu: 'Зелёный', labelEn: 'Green', labelKy: 'Жашыл' },
    { key: 'yellow', hex: '#EAB308', border: '#EAB308', labelRu: 'Жёлтый', labelEn: 'Yellow', labelKy: 'Сары' },
    { key: 'gray', hex: '#6B7280', border: '#6B7280', labelRu: 'Серый', labelEn: 'Gray', labelKy: 'Боз' },
];

const VehicleDetailsScreen = ({ route }) => {
    const navigation = useNavigation<any>();
    const { language } = useLanguage();
    const { adapter } = useFleetbase();
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const vehicleType = route.params?.vehicleType;
    const requiresLicense = route.params?.requiresLicense ?? false;

    const [make, setMake] = useState('');
    const [plateNumber, setPlateNumber] = useState('');
    const [selectedColor, setSelectedColor] = useState<string | null>(null);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [avatars, setAvatars] = useState<any[]>([]);
    const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
    const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);

    const copy = {
        en: {
            title: 'Vehicle Details',
            subtitle: 'Add information about your vehicle',
            makePlaceholder: 'Make & Model (e.g. Toyota Camry)',
            platePlaceholder: 'Plate number (e.g. 01KG 123 ABC)',
            colorLabel: 'Color',
            photoLabel: 'Vehicle Photo',
            addPhoto: 'Take photo',
            avatarLabel: 'Vehicle Avatar',
            next: 'Continue',
            step: 'Step 3 of 4',
            fillRequired: 'Please fill in make and plate number',
        },
        ru: {
            title: 'Данные транспорта',
            subtitle: 'Добавьте информацию о вашем транспортном средстве',
            makePlaceholder: 'Марка и модель (напр. Toyota Camry)',
            platePlaceholder: 'Гос. номер (напр. 01KG 123 ABC)',
            colorLabel: 'Цвет',
            photoLabel: 'Фото транспорта',
            addPhoto: 'Сделать фото',
            avatarLabel: 'Аватар транспорта',
            next: 'Продолжить',
            step: 'Шаг 3 из 4',
            fillRequired: 'Заполните марку и гос. номер',
        },
        ky: {
            title: 'Транспорт маалыматы',
            subtitle: 'Транспортуңуз тууралуу маалымат кошуңуз',
            makePlaceholder: 'Маркасы жана модели (мис. Toyota Camry)',
            platePlaceholder: 'Мамлекеттик номер (мис. 01KG 123 ABC)',
            colorLabel: 'Түсү',
            photoLabel: 'Транспорт сүрөтү',
            addPhoto: 'Сүрөткө тартуу',
            avatarLabel: 'Транспорт аватары',
            next: 'Улантуу',
            step: '3-кадам 4төн',
            fillRequired: 'Маркасын жана номерин толтуруңуз',
        },
    }[localeCode];

    // Load vehicle avatars from backend
    useEffect(() => {
        const loadAvatars = async () => {
            if (!adapter) return;
            setIsLoadingAvatars(true);
            try {
                const response = await adapter.get('vehicle-avatars', { type: vehicleType });
                const avatarList = response?.data ?? response?.avatars ?? response ?? [];
                setAvatars(Array.isArray(avatarList) ? avatarList : []);
            } catch (error) {
                console.warn('[VehicleDetailsScreen] Failed to load avatars:', error);
                setAvatars([]);
            } finally {
                setIsLoadingAvatars(false);
            }
        };
        loadAvatars();
    }, [adapter, vehicleType]);

    const handleTakePhoto = useCallback(() => {
        const options = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 1200, maxHeight: 1200, includeBase64: true };

        const showPicker = () => {
            Alert.alert(
                localeCode === 'ru' ? 'Фото транспорта' : localeCode === 'ky' ? 'Транспорт сүрөтү' : 'Vehicle Photo',
                '',
                [
                    {
                        text: localeCode === 'ru' ? 'Камера' : localeCode === 'ky' ? 'Камера' : 'Camera',
                        onPress: () => {
                            launchCamera(options, (response) => {
                                if (response.assets?.[0]?.uri) {
                                    setPhotoUri(response.assets[0].uri);
                                    setPhotoBase64(response.assets[0].base64 ?? null);
                                }
                            });
                        },
                    },
                    {
                        text: localeCode === 'ru' ? 'Галерея' : localeCode === 'ky' ? 'Галерея' : 'Gallery',
                        onPress: () => {
                            launchImageLibrary(options, (response) => {
                                if (response.assets?.[0]?.uri) {
                                    setPhotoUri(response.assets[0].uri);
                                    setPhotoBase64(response.assets[0].base64 ?? null);
                                }
                            });
                        },
                    },
                    { text: localeCode === 'ru' ? 'Отмена' : localeCode === 'ky' ? 'Жокко чыгаруу' : 'Cancel', style: 'cancel' },
                ]
            );
        };

        showPicker();
    }, [localeCode]);

    const getColorLabel = (color: typeof COLORS[0]) => {
        if (localeCode === 'ru') return color.labelRu;
        if (localeCode === 'ky') return color.labelKy;
        return color.labelEn;
    };

    const canContinue = make.trim().length > 0 && plateNumber.trim().length > 0;

    const handleContinue = () => {
        if (!canContinue) {
            toast.error(copy.fillRequired);
            return;
        }

        const vehicleData = {
            make: make.trim(),
            plate_number: plateNumber.trim(),
            color: selectedColor,
            photo_uri: photoUri,
            photo_base64: photoBase64,
            avatar: selectedAvatar,
            vehicle_type: vehicleType,
        };

        if (requiresLicense) {
            navigation.navigate('DriverLicense', {
                ...route.params,
                vehicle: vehicleData,
            });
        } else {
            navigation.navigate('RegistrationComplete', {
                ...route.params,
                vehicle: vehicleData,
            });
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <AuthBackButton />
            <YStack flex={1} px="$4" pt={80} pb="$4">
                {/* Step indicator */}
                <YStack alignItems="center" mb="$2">
                    <Text color="rgba(17,43,102,0.5)" fontSize={13} fontFamily="Rubik-Medium">
                        {copy.step}
                    </Text>
                </YStack>

                {/* Progress bar */}
                <XStack height={4} borderRadius={2} bg="#E8EAF0" mb="$5" mx="$2">
                    <YStack width="75%" height={4} borderRadius={2} bg="#112b66" />
                </XStack>

                {/* Title */}
                <YStack mb="$4" px="$2">
                    <Text color="#112b66" fontSize={24} fontFamily="Rubik-Bold" fontWeight="800" mb="$2">
                        {copy.title}
                    </Text>
                    <Text color="rgba(17,43,102,0.6)" fontSize={14} fontFamily="Rubik-Regular" lineHeight={20}>
                        {copy.subtitle}
                    </Text>
                </YStack>

                <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                    <YStack space="$4" pb="$4">
                        {/* Vehicle Photo */}
                        <YStack>
                            <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" mb="$2" px="$1">
                                {copy.photoLabel}
                            </Text>
                            <Pressable onPress={handleTakePhoto} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.08)' })}>
                                <YStack
                                    bg="#F5F6FA"
                                    borderRadius={16}
                                    height={140}
                                    justifyContent="center"
                                    alignItems="center"
                                    borderWidth={2}
                                    borderColor="#E8EAF0"
                                    borderStyle="dashed"
                                    overflow="hidden"
                                >
                                    {photoUri ? (
                                        <Image
                                            source={{ uri: photoUri }}
                                            style={{ width: '100%', height: '100%', borderRadius: 14 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <YStack alignItems="center" space="$2">
                                            <FontAwesomeIcon icon={faCamera} size={28} color="rgba(17,43,102,0.3)" />
                                            <Text color="rgba(17,43,102,0.5)" fontSize={13} fontFamily="Rubik-Medium">
                                                {copy.addPhoto}
                                            </Text>
                                        </YStack>
                                    )}
                                </YStack>
                            </Pressable>
                        </YStack>

                        {/* Make & Model */}
                        <YStack>
                            <XStack alignItems="center" mb="$2" px="$1">
                                <FontAwesomeIcon icon={faCarSide} size={14} color="rgba(17,43,102,0.5)" />
                                <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" ml="$2">
                                    {copy.makePlaceholder.split('(')[0].trim()}
                                </Text>
                            </XStack>
                            <Input
                                value={make}
                                onChangeText={setMake}
                                placeholder={copy.makePlaceholder}
                                bg="#F5F6FA"
                                borderRadius={16}
                                borderWidth={0}
                                color="#112b66"
                                placeholderTextColor="rgba(17, 43, 102, 0.35)"
                                fontSize={15}
                                fontFamily="Rubik-Bold"
                                fontWeight="700"
                                containerHeight={50}
                                autoCapitalize="words"
                            />
                        </YStack>

                        {/* Plate Number */}
                        <YStack>
                            <XStack alignItems="center" mb="$2" px="$1">
                                <FontAwesomeIcon icon={faHashtag} size={14} color="rgba(17,43,102,0.5)" />
                                <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" ml="$2">
                                    {copy.platePlaceholder.split('(')[0].trim()}
                                </Text>
                            </XStack>
                            <Input
                                value={plateNumber}
                                onChangeText={setPlateNumber}
                                placeholder={copy.platePlaceholder}
                                bg="#F5F6FA"
                                borderRadius={16}
                                borderWidth={0}
                                color="#112b66"
                                placeholderTextColor="rgba(17, 43, 102, 0.35)"
                                fontSize={15}
                                fontFamily="Rubik-Bold"
                                fontWeight="700"
                                containerHeight={50}
                                autoCapitalize="characters"
                            />
                        </YStack>

                        {/* Color Selection */}
                        <YStack>
                            <XStack alignItems="center" mb="$2" px="$1">
                                <FontAwesomeIcon icon={faPalette} size={14} color="rgba(17,43,102,0.5)" />
                                <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" ml="$2">
                                    {copy.colorLabel}
                                </Text>
                            </XStack>
                            <XStack flexWrap="wrap" gap="$2">
                                {COLORS.map((color) => {
                                    const isSelected = selectedColor === color.key;
                                    return (
                                        <Pressable key={color.key} onPress={() => setSelectedColor(color.key)}>
                                            <YStack alignItems="center" space="$1" width={72} py="$2">
                                                <YStack
                                                    width={40}
                                                    height={40}
                                                    borderRadius={20}
                                                    bg={color.hex}
                                                    borderWidth={isSelected ? 3 : 1.5}
                                                    borderColor={isSelected ? '#112b66' : color.border}
                                                    justifyContent="center"
                                                    alignItems="center"
                                                >
                                                    {isSelected && (
                                                        <YStack
                                                            width={14}
                                                            height={14}
                                                            borderRadius={7}
                                                            bg="#112b66"
                                                        />
                                                    )}
                                                </YStack>
                                                <Text
                                                    color={isSelected ? '#112b66' : 'rgba(17,43,102,0.5)'}
                                                    fontSize={10}
                                                    fontFamily={isSelected ? 'Rubik-Bold' : 'Rubik-Regular'}
                                                    textAlign="center"
                                                >
                                                    {getColorLabel(color)}
                                                </Text>
                                            </YStack>
                                        </Pressable>
                                    );
                                })}
                            </XStack>
                        </YStack>

                        {/* Vehicle Avatars from backend */}
                        {avatars.length > 0 && (
                            <YStack>
                                <XStack alignItems="center" mb="$2" px="$1">
                                    <FontAwesomeIcon icon={faImage} size={14} color="rgba(17,43,102,0.5)" />
                                    <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" ml="$2">
                                        {copy.avatarLabel}
                                    </Text>
                                </XStack>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <XStack space="$2" py="$1">
                                        {avatars.map((avatar, index) => {
                                            const avatarUrl = avatar?.url ?? avatar?.uri ?? avatar;
                                            const avatarId = avatar?.id ?? `${index}`;
                                            const isSelected = selectedAvatar === avatarId;
                                            return (
                                                <Pressable key={avatarId} onPress={() => setSelectedAvatar(avatarId)}>
                                                    <YStack
                                                        width={72}
                                                        height={72}
                                                        borderRadius={14}
                                                        borderWidth={isSelected ? 3 : 1.5}
                                                        borderColor={isSelected ? '#112b66' : '#E8EAF0'}
                                                        overflow="hidden"
                                                        bg="#F5F6FA"
                                                    >
                                                        <Image
                                                            source={{ uri: typeof avatarUrl === 'string' ? avatarUrl : '' }}
                                                            style={{ width: '100%', height: '100%' }}
                                                            resizeMode="contain"
                                                        />
                                                    </YStack>
                                                </Pressable>
                                            );
                                        })}
                                    </XStack>
                                </ScrollView>
                            </YStack>
                        )}
                    </YStack>
                </ScrollView>

                {/* Continue button */}
                <Button
                    size="$5"
                    onPress={handleContinue}
                    bg="#112b66"
                    width="100%"
                    borderRadius={20}
                    height={52}
                    opacity={canContinue ? 1 : 0.4}
                    disabled={!canContinue}
                    mt="$2"
                >
                    <Button.Text color="#FFFFFF" fontWeight="700" fontFamily="Rubik-Bold">
                        {copy.next}
                    </Button.Text>
                    <Button.Icon>
                        <FontAwesomeIcon icon={faArrowRight} color="#FFFFFF" size={16} />
                    </Button.Icon>
                </Button>
            </YStack>
        </SafeAreaView>
    );
};

export default VehicleDetailsScreen;
