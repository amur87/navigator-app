import React, { useState } from 'react';
import { SafeAreaView, Pressable, StyleSheet } from 'react-native';
import { Text, YStack, XStack, Button } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMotorcycle, faCar, faTruckPickup, faArrowRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../contexts/LanguageContext';
import AuthBackButton from '../components/AuthBackButton';
import { getMaterialRipple } from '../utils/material-ripple';

const VEHICLE_TYPES = [
    { key: 'motorbike', icon: faMotorcycle, labelEn: 'Motorbike', labelRu: 'Мотобайк', labelKy: 'Мотобайк', requiresLicense: false },
    { key: 'car', icon: faCar, labelEn: 'Car', labelRu: 'Автомобиль', labelKy: 'Автомобиль', requiresLicense: true },
    { key: 'van', icon: faTruckPickup, labelEn: 'Light Commercial', labelRu: 'Лёгкий коммерческий', labelKy: 'Жеңил коммерциялык', requiresLicense: true },
];

const VehicleTypeSelectScreen = ({ route }) => {
    const navigation = useNavigation<any>();
    const { language } = useLanguage();
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const [selectedType, setSelectedType] = useState<string | null>(null);

    const copy = {
        en: {
            title: 'Select Vehicle Type',
            subtitle: 'Choose the type of vehicle you will use for deliveries',
            next: 'Continue',
            step: 'Step 1 of 4',
        },
        ru: {
            title: 'Выберите тип транспорта',
            subtitle: 'Выберите транспортное средство, которое будете использовать для доставок',
            next: 'Продолжить',
            step: 'Шаг 1 из 4',
        },
        ky: {
            title: 'Транспорт түрүн тандаңыз',
            subtitle: 'Жеткирүү үчүн колдоно турган транспортту тандаңыз',
            next: 'Улантуу',
            step: '1-кадам 4төн',
        },
    }[localeCode];

    const getLabel = (item: typeof VEHICLE_TYPES[0]) => {
        if (localeCode === 'ru') return item.labelRu;
        if (localeCode === 'ky') return item.labelKy;
        return item.labelEn;
    };

    const selectedVehicle = VEHICLE_TYPES.find((v) => v.key === selectedType);

    const handleContinue = () => {
        if (!selectedVehicle) return;
        navigation.navigate('FleetSelect', {
            ...route.params,
            vehicleType: selectedVehicle.key,
            requiresLicense: selectedVehicle.requiresLicense,
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
                    <YStack width="25%" height={4} borderRadius={2} bg="#112b66" />
                </XStack>

                {/* Title */}
                <YStack mb="$6" px="$2">
                    <Text color="#112b66" fontSize={24} fontFamily="Rubik-Bold" fontWeight="800" mb="$2">
                        {copy.title}
                    </Text>
                    <Text color="rgba(17,43,102,0.6)" fontSize={14} fontFamily="Rubik-Regular" lineHeight={20}>
                        {copy.subtitle}
                    </Text>
                </YStack>

                {/* Vehicle type cards */}
                <YStack space="$3" flex={1}>
                    {VEHICLE_TYPES.map((item) => {
                        const isSelected = selectedType === item.key;
                        return (
                            <Pressable
                                key={item.key}
                                onPress={() => setSelectedType(item.key)}
                                android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.08)' })}
                            >
                                <XStack
                                    bg={isSelected ? '#112b66' : '#F5F6FA'}
                                    borderRadius={16}
                                    px="$4"
                                    py="$4"
                                    alignItems="center"
                                    borderWidth={2}
                                    borderColor={isSelected ? '#112b66' : 'transparent'}
                                    animation="quick"
                                >
                                    <YStack
                                        width={52}
                                        height={52}
                                        borderRadius={14}
                                        bg={isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(17,43,102,0.08)'}
                                        justifyContent="center"
                                        alignItems="center"
                                        mr="$3"
                                    >
                                        <FontAwesomeIcon
                                            icon={item.icon}
                                            size={24}
                                            color={isSelected ? '#FFFFFF' : '#112b66'}
                                        />
                                    </YStack>
                                    <YStack flex={1}>
                                        <Text
                                            color={isSelected ? '#FFFFFF' : '#112b66'}
                                            fontSize={16}
                                            fontFamily="Rubik-Bold"
                                            fontWeight="700"
                                        >
                                            {getLabel(item)}
                                        </Text>
                                    </YStack>
                                    {isSelected && (
                                        <YStack
                                            width={28}
                                            height={28}
                                            borderRadius={14}
                                            bg="rgba(255,255,255,0.25)"
                                            justifyContent="center"
                                            alignItems="center"
                                        >
                                            <FontAwesomeIcon icon={faCheck} size={14} color="#FFFFFF" />
                                        </YStack>
                                    )}
                                </XStack>
                            </Pressable>
                        );
                    })}
                </YStack>

                {/* Continue button */}
                <Button
                    size="$5"
                    onPress={handleContinue}
                    bg="#112b66"
                    width="100%"
                    borderRadius={20}
                    height={52}
                    opacity={selectedType ? 1 : 0.4}
                    disabled={!selectedType}
                    mt="$4"
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

export default VehicleTypeSelectScreen;
