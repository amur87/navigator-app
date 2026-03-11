import React, { useMemo, useState, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { View, Pressable, Keyboard, StyleSheet, StatusBar } from 'react-native';
import { Spinner, Text, YStack, XStack, Button } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from '@backpackapp-io/react-native-toast';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePromiseWithLoading } from '../hooks/use-promise-with-loading';
import PhoneInput from '../components/PhoneInput';
import Input from '../components/Input';
import GlassHeader from '../components/GlassHeader';

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
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { t } = useLanguage();
    const { driver, updateDriver } = useAuth();
    const { runWithLoading, isLoading } = usePromiseWithLoading();
    const topInset = Math.max(insets.top, 0);

    const getDriverValue = useCallback(
        (key: string, fallback = '') => {
            if (!driver) return fallback;
            if (typeof driver.getAttribute === 'function') {
                return driver.getAttribute(key) ?? fallback;
            }
            return driver?.[key] ?? fallback;
        },
        [driver]
    );

    const initialValue = useMemo(() => {
        if (!driver || !property?.key) return '';
        return getDriverValue(property.key, '');
    }, [driver, getDriverValue, property?.key]);

    const [value, setValue] = useState(initialValue);
    const mutated = value !== initialValue;

    const handleUpdateProperty = useCallback(async () => {
        if (!property?.key) return;
        try {
            await runWithLoading(updateDriver({ [property.key]: value }));
            toast.success(t('AccountScreen.propertyChangesSaved', { propertyName: property.name }));
            navigation.goBack();
        } catch (error) {
            toast.error(error.message);
        }
    }, [navigation, property, runWithLoading, t, updateDriver, value]);

    if (!property) return null;

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title={property.name} />

            <View style={[styles.content, { paddingTop: topInset + 48 + 20 }]}>
                <View style={styles.inputWrap}>
                    <RenderAccountProperty property={property} value={value} onChange={setValue} />
                </View>

                <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} pointerEvents='box-none' />

                <View style={styles.buttonWrap}>
                    <Button
                        onPress={handleUpdateProperty}
                        size='$5'
                        bg='#112b66'
                        width='100%'
                        opacity={mutated ? 1 : 0.75}
                        disabled={!mutated}
                        borderRadius={20}
                        height={52}
                    >
                        <Button.Icon>{isLoading() && <Spinner color='#FFFFFF' />}</Button.Icon>
                        <Button.Text color='#FFFFFF' fontWeight='bold' fontSize='$5' fontFamily='Rubik-Bold'>
                            {t('common.save')}
                        </Button.Text>
                    </Button>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F2F2F7' },
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
    inputWrap: {
        width: '100%',
    },
    buttonWrap: {
        position: 'absolute',
        bottom: 32,
        left: 16,
        right: 16,
    },
});

export default EditAccountPropertyScreen;
