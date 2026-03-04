import React, { useMemo, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, Pressable, Keyboard, StyleSheet } from 'react-native';
import { Spinner, Text, YStack, XStack, Button, useTheme } from 'tamagui';
import { toast } from '@backpackapp-io/react-native-toast';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePromiseWithLoading } from '../hooks/use-promise-with-loading';
import BackButton from '../components/BackButton';
import PhoneInput from '../components/PhoneInput';
import Input from '../components/Input';

const RenderAccountProperty = ({ property, value, onChange }) => {
    return (
        <YStack flex={1} width='100%'>
            {property.component === 'phone-input' ? (
                <PhoneInput value={value} onChange={onChange} wrapperProps={{ flex: 1 }} />
            ) : (
                <Input value={value} onChangeText={onChange} size='$5' placeholder={property.name} />
            )}
        </YStack>
    );
};

const EditAccountPropertyScreen = ({ route }) => {
    const property = route.params?.property;
    const theme = useTheme();
    const navigation = useNavigation<any>();
    const { t, language } = useLanguage();
    const { driver, updateDriver } = useAuth();
    const isCyrillic = language.code === 'ru' || language.code === 'ky';
    const { runWithLoading, isLoading } = usePromiseWithLoading();
    const getDriverValue = useCallback(
        (key: string, fallback = '') => {
            if (!driver) {
                return fallback;
            }

            if (typeof driver.getAttribute === 'function') {
                return driver.getAttribute(key) ?? fallback;
            }

            return driver?.[key] ?? fallback;
        },
        [driver]
    );
    const initialValue = useMemo(() => {
        if (!driver || !property?.key) {
            return '';
        }

        return getDriverValue(property.key, '');
    }, [driver, getDriverValue, property?.key]);
    const [value, setValue] = useState(initialValue);
    const mutated = value !== initialValue;

    const handleUpdateProperty = useCallback(async () => {
        if (!property?.key) {
            return;
        }

        try {
            await runWithLoading(updateDriver({ [property.key]: value }));
            toast.success(t('AccountScreen.propertyChangesSaved', { propertyName: property.name }));
            navigation.goBack();
        } catch (error) {
            toast.error(error.message);
        }
    }, [navigation, property, runWithLoading, t, updateDriver, value]);

    if (!property) {
        return null;
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
            <YStack flex={1} bg='$background' space='$3' padding='$5'>
                <XStack space='$3' alignItems='center' mb='$5'>
                    <BackButton />
                    <Text color='$textPrimary' fontWeight='bold' fontSize='$8' numberOfLines={1} fontFamily={isCyrillic ? undefined : 'Rubik-Bold'}>
                        {property.name}
                    </Text>
                </XStack>
                <XStack width='100%'>
                    <RenderAccountProperty property={property} value={value} onChange={setValue} />
                </XStack>
                <YStack flex={1} position='relative' width='100%'>
                    <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} pointerEvents='box-only' />
                </YStack>
                <XStack position='absolute' bottom={0} left={0} right={0} padding='$5'>
                    <Button onPress={handleUpdateProperty} size='$5' bg='$primary' flex={1} opacity={mutated ? 1 : 0.75} disabled={!mutated}>
                        <Button.Icon>{isLoading() && <Spinner color='$textPrimary' />}</Button.Icon>
                        <Button.Text color='$textPrimary' fontWeight='bold' fontSize='$5' fontFamily={isCyrillic ? undefined : 'Rubik-Bold'}>
                            {t('common.save')}
                        </Button.Text>
                    </Button>
                </XStack>
            </YStack>
        </SafeAreaView>
    );
};

export default EditAccountPropertyScreen;
