import React, { useState, useCallback } from 'react';
import { SafeAreaView, Pressable, Image, Alert } from 'react-native';
import { Text, YStack, XStack, Button, ScrollView } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCamera, faArrowRight, faIdCard, faCalendarAlt, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import { useNavigation } from '@react-navigation/native';
import { toast } from '@backpackapp-io/react-native-toast';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useLanguage } from '../contexts/LanguageContext';
import Input from '../components/Input';
import AuthBackButton from '../components/AuthBackButton';
import { getMaterialRipple } from '../utils/material-ripple';

const LICENSE_CATEGORIES = ['A', 'A1', 'B', 'B1', 'C', 'C1', 'D', 'D1', 'BE', 'CE', 'DE'];

const DriverLicenseScreen = ({ route }) => {
    const navigation = useNavigation<any>();
    const { language } = useLanguage();
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';

    const [licenseNumber, setLicenseNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [licensePhotoUri, setLicensePhotoUri] = useState<string | null>(null);
    const [licensePhotoBase64, setLicensePhotoBase64] = useState<string | null>(null);

    const copy = {
        en: {
            title: "Driver's License",
            subtitle: 'Add your driving license information for verification',
            photoLabel: 'License Photo',
            addPhoto: 'Take photo of your license',
            numberPlaceholder: 'License number',
            expiryPlaceholder: 'Expiry date (DD.MM.YYYY)',
            categoryLabel: 'License category',
            next: 'Complete Registration',
            step: 'Step 4 of 4',
            fillRequired: 'Please fill in license number and expiry date',
            selectCategory: 'Please select at least one category',
            invalidDate: 'Please enter a valid expiry date',
            expiredLicense: 'Your license has expired',
        },
        ru: {
            title: 'Водительское удостоверение',
            subtitle: 'Добавьте данные ВУ для верификации',
            photoLabel: 'Фото удостоверения',
            addPhoto: 'Сфотографируйте ВУ',
            numberPlaceholder: 'Номер удостоверения',
            expiryPlaceholder: 'Срок годности (ДД.ММ.ГГГГ)',
            categoryLabel: 'Категория',
            next: 'Завершить регистрацию',
            step: 'Шаг 4 из 4',
            fillRequired: 'Заполните номер ВУ и срок годности',
            selectCategory: 'Выберите хотя бы одну категорию',
            invalidDate: 'Введите корректную дату',
            expiredLicense: 'Срок действия ВУ истёк',
        },
        ky: {
            title: 'Айдоочулук күбөлүк',
            subtitle: 'Текшерүү үчүн айдоочулук күбөлүгүңүздү кошуңуз',
            photoLabel: 'Күбөлүк сүрөтү',
            addPhoto: 'Күбөлүгүңүздү сүрөткө тартыңыз',
            numberPlaceholder: 'Күбөлүк номери',
            expiryPlaceholder: 'Жарактуулук мөөнөтү (КК.АА.ЖЖЖЖ)',
            categoryLabel: 'Категориясы',
            next: 'Каттоону аяктоо',
            step: '4-кадам 4төн',
            fillRequired: 'Күбөлүк номерин жана мөөнөтүн толтуруңуз',
            selectCategory: 'Жок дегенде бир категорияны тандаңыз',
            invalidDate: 'Жарактуу датаны киргизиңиз',
            expiredLicense: 'Күбөлүгүңүздүн мөөнөтү бүткөн',
        },
    }[localeCode];

    const toggleCategory = (cat: string) => {
        setSelectedCategories((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        );
    };

    const handleTakePhoto = useCallback(() => {
        const options = { mediaType: 'photo' as const, quality: 0.8 as const, maxWidth: 1400, maxHeight: 1400, includeBase64: true };

        Alert.alert(
            localeCode === 'ru' ? 'Фото ВУ' : localeCode === 'ky' ? 'Күбөлүк сүрөтү' : 'License Photo',
            '',
            [
                {
                    text: localeCode === 'ru' ? 'Камера' : localeCode === 'ky' ? 'Камера' : 'Camera',
                    onPress: () => {
                        launchCamera(options, (response) => {
                            if (response.assets?.[0]?.uri) {
                                setLicensePhotoUri(response.assets[0].uri);
                                setLicensePhotoBase64(response.assets[0].base64 ?? null);
                            }
                        });
                    },
                },
                {
                    text: localeCode === 'ru' ? 'Галерея' : localeCode === 'ky' ? 'Галерея' : 'Gallery',
                    onPress: () => {
                        launchImageLibrary(options, (response) => {
                            if (response.assets?.[0]?.uri) {
                                setLicensePhotoUri(response.assets[0].uri);
                                setLicensePhotoBase64(response.assets[0].base64 ?? null);
                            }
                        });
                    },
                },
                { text: localeCode === 'ru' ? 'Отмена' : localeCode === 'ky' ? 'Жокко чыгаруу' : 'Cancel', style: 'cancel' },
            ]
        );
    }, [localeCode]);

    const formatExpiryDate = (text: string) => {
        // Auto-format DD.MM.YYYY
        const digits = text.replace(/\D/g, '');
        let formatted = '';
        if (digits.length > 0) formatted += digits.slice(0, 2);
        if (digits.length > 2) formatted += '.' + digits.slice(2, 4);
        if (digits.length > 4) formatted += '.' + digits.slice(4, 8);
        setExpiryDate(formatted);
    };

    // Validate DD.MM.YYYY format and check the date is real and not expired
    const parseExpiryDate = (dateStr: string): Date | null => {
        const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (!match) return null;
        const [, dd, mm, yyyy] = match;
        const day = parseInt(dd, 10);
        const month = parseInt(mm, 10);
        const year = parseInt(yyyy, 10);
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) return null;
        const date = new Date(year, month - 1, day);
        // Check the date components match (catches invalid dates like 31.02.2025)
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
        return date;
    };

    const canContinue = licenseNumber.trim().length > 0 && expiryDate.trim().length >= 10;

    const handleContinue = () => {
        if (!canContinue) {
            toast.error(copy.fillRequired);
            return;
        }

        const parsedDate = parseExpiryDate(expiryDate.trim());
        if (!parsedDate) {
            toast.error(copy.invalidDate);
            return;
        }

        if (parsedDate < new Date()) {
            toast.error(copy.expiredLicense);
            return;
        }

        if (selectedCategories.length === 0) {
            toast.error(copy.selectCategory);
            return;
        }

        const licenseData = {
            license_number: licenseNumber.trim(),
            expiry_date: expiryDate.trim(),
            categories: selectedCategories,
            license_photo_uri: licensePhotoUri,
            license_photo_base64: licensePhotoBase64,
        };

        navigation.navigate('RegistrationComplete', {
            ...route.params,
            license: licenseData,
        });
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
                    <YStack width="100%" height={4} borderRadius={2} bg="#112b66" />
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
                        {/* License Photo */}
                        <YStack>
                            <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" mb="$2" px="$1">
                                {copy.photoLabel}
                            </Text>
                            <Pressable onPress={handleTakePhoto} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.08)' })}>
                                <YStack
                                    bg="#F5F6FA"
                                    borderRadius={16}
                                    height={160}
                                    justifyContent="center"
                                    alignItems="center"
                                    borderWidth={2}
                                    borderColor="#E8EAF0"
                                    borderStyle="dashed"
                                    overflow="hidden"
                                >
                                    {licensePhotoUri ? (
                                        <Image
                                            source={{ uri: licensePhotoUri }}
                                            style={{ width: '100%', height: '100%', borderRadius: 14 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <YStack alignItems="center" space="$2">
                                            <YStack
                                                width={56}
                                                height={56}
                                                borderRadius={16}
                                                bg="rgba(17,43,102,0.08)"
                                                justifyContent="center"
                                                alignItems="center"
                                            >
                                                <FontAwesomeIcon icon={faCamera} size={24} color="rgba(17,43,102,0.35)" />
                                            </YStack>
                                            <Text color="rgba(17,43,102,0.5)" fontSize={13} fontFamily="Rubik-Medium">
                                                {copy.addPhoto}
                                            </Text>
                                        </YStack>
                                    )}
                                </YStack>
                            </Pressable>
                        </YStack>

                        {/* License Number */}
                        <YStack>
                            <XStack alignItems="center" mb="$2" px="$1">
                                <FontAwesomeIcon icon={faIdCard} size={14} color="rgba(17,43,102,0.5)" />
                                <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" ml="$2">
                                    {copy.numberPlaceholder}
                                </Text>
                            </XStack>
                            <Input
                                value={licenseNumber}
                                onChangeText={setLicenseNumber}
                                placeholder={copy.numberPlaceholder}
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

                        {/* Expiry Date */}
                        <YStack>
                            <XStack alignItems="center" mb="$2" px="$1">
                                <FontAwesomeIcon icon={faCalendarAlt} size={14} color="rgba(17,43,102,0.5)" />
                                <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" ml="$2">
                                    {copy.expiryPlaceholder.split('(')[0].trim()}
                                </Text>
                            </XStack>
                            <Input
                                value={expiryDate}
                                onChangeText={formatExpiryDate}
                                placeholder={copy.expiryPlaceholder}
                                bg="#F5F6FA"
                                borderRadius={16}
                                borderWidth={0}
                                color="#112b66"
                                placeholderTextColor="rgba(17, 43, 102, 0.35)"
                                fontSize={15}
                                fontFamily="Rubik-Bold"
                                fontWeight="700"
                                containerHeight={50}
                                keyboardType="numeric"
                                maxLength={10}
                            />
                        </YStack>

                        {/* License Categories */}
                        <YStack>
                            <XStack alignItems="center" mb="$2" px="$1">
                                <FontAwesomeIcon icon={faLayerGroup} size={14} color="rgba(17,43,102,0.5)" />
                                <Text color="#112b66" fontSize={13} fontFamily="Rubik-Bold" fontWeight="700" ml="$2">
                                    {copy.categoryLabel}
                                </Text>
                            </XStack>
                            <XStack flexWrap="wrap" gap="$2">
                                {LICENSE_CATEGORIES.map((cat) => {
                                    const isSelected = selectedCategories.includes(cat);
                                    return (
                                        <Pressable key={cat} onPress={() => toggleCategory(cat)}>
                                            <YStack
                                                px="$3"
                                                py="$2"
                                                borderRadius={12}
                                                bg={isSelected ? '#112b66' : '#F5F6FA'}
                                                borderWidth={1.5}
                                                borderColor={isSelected ? '#112b66' : '#E8EAF0'}
                                                minWidth={48}
                                                alignItems="center"
                                            >
                                                <Text
                                                    color={isSelected ? '#FFFFFF' : '#112b66'}
                                                    fontSize={14}
                                                    fontFamily="Rubik-Bold"
                                                    fontWeight="700"
                                                >
                                                    {cat}
                                                </Text>
                                            </YStack>
                                        </Pressable>
                                    );
                                })}
                            </XStack>
                        </YStack>
                    </YStack>
                </ScrollView>

                {/* Complete Registration button */}
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

export default DriverLicenseScreen;
