import React, { useState, useEffect } from 'react';
import { SafeAreaView, Pressable, ActivityIndicator } from 'react-native';
import { Text, YStack, XStack, Button, ScrollView } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faWarehouse, faArrowRight, faCheck, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { useNavigation } from '@react-navigation/native';
import { useLanguage } from '../contexts/LanguageContext';
import useFleetbase from '../hooks/use-fleetbase';
import AuthBackButton from '../components/AuthBackButton';
import { getMaterialRipple } from '../utils/material-ripple';

const FleetSelectScreen = ({ route }) => {
    const navigation = useNavigation<any>();
    const { language } = useLanguage();
    const { adapter } = useFleetbase();
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const [selectedFleet, setSelectedFleet] = useState<any>(null);
    const [fleets, setFleets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const copy = {
        en: {
            title: 'Select Fleet',
            subtitle: 'Choose a fleet you want to join',
            next: 'Continue',
            step: 'Step 2 of 4',
            loading: 'Loading available fleets...',
            noFleets: 'No fleets available at the moment',
            retry: 'Retry',
            error: 'Failed to load fleets',
            skip: 'Skip',
        },
        ru: {
            title: 'Выберите парк',
            subtitle: 'Выберите парк, к которому хотите присоединиться',
            next: 'Продолжить',
            step: 'Шаг 2 из 4',
            loading: 'Загрузка доступных парков...',
            noFleets: 'Нет доступных парков',
            retry: 'Повторить',
            error: 'Не удалось загрузить парки',
            skip: 'Пропустить',
        },
        ky: {
            title: 'Паркты тандаңыз',
            subtitle: 'Кошулгуңуз келген паркты тандаңыз',
            next: 'Улантуу',
            step: '2-кадам 4төн',
            loading: 'Жеткиликтүү парктар жүктөлүүдө...',
            noFleets: 'Учурда парктар жок',
            retry: 'Кайра аракет',
            error: 'Парктарды жүктөө мүмкүн болгон жок',
            skip: 'Өткөрүп жиберүү',
        },
    }[localeCode];

    const loadFleets = async () => {
        if (!adapter) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const response = await adapter.get('fleets');
            const fleetList = response?.data ?? response?.fleets ?? response ?? [];
            setFleets(Array.isArray(fleetList) ? fleetList : []);
        } catch (error) {
            console.warn('[FleetSelectScreen] Failed to load fleets:', error);
            // Use a generic marker; actual localized text is rendered from `copy.error` in JSX
            setLoadError('load_failed');
            setFleets([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadFleets();
    }, [adapter]);

    const handleContinue = () => {
        navigation.navigate('VehicleDetails', {
            ...route.params,
            fleet: selectedFleet ? { id: selectedFleet.id, name: selectedFleet.name ?? selectedFleet.attributes?.name } : null,
        });
    };

    const handleSkip = () => {
        navigation.navigate('VehicleDetails', {
            ...route.params,
            fleet: null,
        });
    };

    const getFleetName = (fleet: any) => {
        return fleet?.name ?? fleet?.attributes?.name ?? fleet?.id ?? 'Unknown';
    };

    const getFleetDescription = (fleet: any) => {
        return fleet?.description ?? fleet?.attributes?.description ?? null;
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
                    <YStack width="50%" height={4} borderRadius={2} bg="#112b66" />
                </XStack>

                {/* Title */}
                <YStack mb="$5" px="$2">
                    <Text color="#112b66" fontSize={24} fontFamily="Rubik-Bold" fontWeight="800" mb="$2">
                        {copy.title}
                    </Text>
                    <Text color="rgba(17,43,102,0.6)" fontSize={14} fontFamily="Rubik-Regular" lineHeight={20}>
                        {copy.subtitle}
                    </Text>
                </YStack>

                {/* Fleet list */}
                <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                    <YStack space="$3" pb="$4">
                        {isLoading && (
                            <YStack py="$8" alignItems="center" space="$3">
                                <ActivityIndicator size="large" color="#112b66" />
                                <Text color="rgba(17,43,102,0.6)" fontSize={14} fontFamily="Rubik-Medium">
                                    {copy.loading}
                                </Text>
                            </YStack>
                        )}

                        {loadError && !isLoading && (
                            <YStack py="$6" alignItems="center" space="$3">
                                <FontAwesomeIcon icon={faExclamationTriangle} size={32} color="rgba(17,43,102,0.3)" />
                                <Text color="rgba(17,43,102,0.6)" fontSize={14} fontFamily="Rubik-Medium" textAlign="center">
                                    {copy.error}
                                </Text>
                                <Button
                                    size="$4"
                                    onPress={loadFleets}
                                    bg="#F5F6FA"
                                    borderRadius={14}
                                    borderWidth={1.5}
                                    borderColor="#D4D9E5"
                                >
                                    <Button.Text color="#112b66" fontFamily="Rubik-Bold" fontWeight="700">
                                        {copy.retry}
                                    </Button.Text>
                                </Button>
                            </YStack>
                        )}

                        {!isLoading && !loadError && fleets.length === 0 && (
                            <YStack py="$8" alignItems="center" space="$3">
                                <FontAwesomeIcon icon={faWarehouse} size={32} color="rgba(17,43,102,0.2)" />
                                <Text color="rgba(17,43,102,0.5)" fontSize={14} fontFamily="Rubik-Medium" textAlign="center">
                                    {copy.noFleets}
                                </Text>
                            </YStack>
                        )}

                        {!isLoading && fleets.map((fleet, index) => {
                            const isSelected = selectedFleet?.id === fleet.id;
                            const name = getFleetName(fleet);
                            const description = getFleetDescription(fleet);
                            return (
                                <Pressable
                                    key={fleet.id ?? index}
                                    onPress={() => setSelectedFleet(fleet)}
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
                                    >
                                        <YStack
                                            width={48}
                                            height={48}
                                            borderRadius={14}
                                            bg={isSelected ? 'rgba(255,255,255,0.15)' : 'rgba(17,43,102,0.08)'}
                                            justifyContent="center"
                                            alignItems="center"
                                            mr="$3"
                                        >
                                            <FontAwesomeIcon
                                                icon={faWarehouse}
                                                size={20}
                                                color={isSelected ? '#FFFFFF' : '#112b66'}
                                            />
                                        </YStack>
                                        <YStack flex={1}>
                                            <Text
                                                color={isSelected ? '#FFFFFF' : '#112b66'}
                                                fontSize={15}
                                                fontFamily="Rubik-Bold"
                                                fontWeight="700"
                                            >
                                                {name}
                                            </Text>
                                            {description ? (
                                                <Text
                                                    color={isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(17,43,102,0.5)'}
                                                    fontSize={12}
                                                    fontFamily="Rubik-Regular"
                                                    mt="$1"
                                                    numberOfLines={2}
                                                >
                                                    {description}
                                                </Text>
                                            ) : null}
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
                </ScrollView>

                {/* Buttons */}
                <YStack space="$3" mt="$2">
                    <Button
                        size="$5"
                        onPress={handleContinue}
                        bg="#112b66"
                        width="100%"
                        borderRadius={20}
                        height={52}
                        opacity={selectedFleet ? 1 : 0.4}
                        disabled={!selectedFleet}
                    >
                        <Button.Text color="#FFFFFF" fontWeight="700" fontFamily="Rubik-Bold">
                            {copy.next}
                        </Button.Text>
                        <Button.Icon>
                            <FontAwesomeIcon icon={faArrowRight} color="#FFFFFF" size={16} />
                        </Button.Icon>
                    </Button>

                    {(fleets.length === 0 || loadError) && !isLoading && (
                        <Button
                            size="$5"
                            onPress={handleSkip}
                            bg="#F5F6FA"
                            width="100%"
                            borderRadius={20}
                            height={52}
                            borderWidth={1.5}
                            borderColor="#D4D9E5"
                        >
                            <Button.Text color="#112b66" fontWeight="700" fontFamily="Rubik-Bold">
                                {copy.skip}
                            </Button.Text>
                        </Button>
                    )}
                </YStack>
            </YStack>
        </SafeAreaView>
    );
};

export default FleetSelectScreen;
