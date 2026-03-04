import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Platform, Animated, Easing, useWindowDimensions } from 'react-native';
import { check, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { Spinner, XStack, YStack } from 'tamagui';
import { useFocusEffect } from '@react-navigation/native';
import { later } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import BootSplash from 'react-native-bootsplash';
import SetupWarningScreen from './SetupWarningScreen';

const BootScreen = ({ route }) => {
    const params = route.params ?? {};
    const navigation = useNavigation();
    const { isAuthenticated } = useAuth();
    const [error, setError] = useState<Error | null>(null);
    const scale = useRef(new Animated.Value(0.7)).current;
    const { width: screenWidth } = useWindowDimensions();
    const logoWidth = Math.min(screenWidth - 48, 180);
    const logoHeight = 72;
    const backgroundColor = '#112b66';
    const locationEnabled = params.locationEnabled;

    useFocusEffect(
        useCallback(() => {
            const initializeNavigator = async () => {
                try {
                    later(() => {
                        try {
                            // Any initialization processes will run here
                            if (isAuthenticated) {
                                navigation.navigate('DriverNavigator');
                            } else {
                                navigation.navigate('Login');
                            }
                        } catch (err) {
                            console.warn('Failed to navigate to screen:', err);
                        }
                    }, 0);
                } catch (initializationError) {
                    setError(initializationError);
                } finally {
                    later(() => BootSplash.hide(), 300);
                }
            };

            if (!isAuthenticated) {
                later(() => initializeNavigator(), 0);
                return;
            }

            const checkLocationPermission = async () => {
                const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;

                const result = await check(permission);
                if (result === RESULTS.GRANTED) {
                    initializeNavigator();
                } else {
                    later(() => BootSplash.hide(), 300);
                    // If the locationEnabled flag is set meaning not null or undefined then initialize navigator
                    if (locationEnabled !== undefined && locationEnabled !== null) {
                        initializeNavigator();
                    } else {
                        navigation.navigate('LocationPermission');
                    }
                }
            };

            checkLocationPermission();
        }, [navigation, isAuthenticated, locationEnabled])
    );

    useEffect(() => {
        Animated.sequence([
            Animated.timing(scale, { toValue: 1.15, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1.0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]).start(() => {
            later(() => BootSplash.hide(), 200);
        });
    }, [scale]);

    if (error) {
        return <SetupWarningScreen error={error} />;
    }

    return (
        <YStack flex={1} bg={backgroundColor} alignItems='center' justifyContent='center' width='100%' height='100%'>
            <YStack alignItems='center' justifyContent='center'>
                <Animated.Image
                    source={require('../../assets/logo_white_big.png')}
                    style={{ width: logoWidth, height: logoHeight, transform: [{ scale }] }}
                    resizeMode='contain'
                />
                <XStack mt='$2' alignItems='center' justifyContent='center' space='$3'>
                    <Spinner size='small' color='$textPrimary' />
                </XStack>
            </YStack>
        </YStack>
    );
};

export default BootScreen;
