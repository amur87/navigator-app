import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Image, Linking, SafeAreaView } from 'react-native';
import { Text, YStack } from 'tamagui';
import { toast } from '@backpackapp-io/react-native-toast';
import { isValidPhoneNumber } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import PhoneInput from '../components/PhoneInput';
import AuthBackButton from '../components/AuthBackButton';
import { PhoneLoginButton } from '../components/Buttons';

const PhoneLoginScreen = () => {
    const navigation = useNavigation<any>();
    const { language } = useLanguage();
    const isCyrillic = language.code === 'ru' || language.code === 'ky';
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const loginCopy = {
        en: {
            invalidPhoneNumber: 'Enter a valid phone number',
            unableToSendSms: 'Unable to send verification code',
            phoneEntryPrompt: 'Enter your phone number to sign in',
            privacyAgreementPrefix: 'By continuing you agree to',
            privacyPolicyLinkText: 'Privacy Policy',
            privacyError: 'Unable to open privacy policy.',
        },
        ru: {
            invalidPhoneNumber: 'Введите корректный номер телефона',
            unableToSendSms: 'Не удалось отправить код',
            phoneEntryPrompt: 'Введите номер телефона, чтобы войти',
            privacyAgreementPrefix: 'Продолжая, вы соглашаетесь с',
            privacyPolicyLinkText: 'политикой конфиденциальности',
            privacyError: 'Не удалось открыть политику конфиденциальности.',
        },
        ky: {
            invalidPhoneNumber: 'Туура телефон номерин киргизиңиз',
            unableToSendSms: 'Кодду жөнөтүү мүмкүн болгон жок',
            phoneEntryPrompt: 'Кирүү үчүн телефон номериңизди киргизиңиз',
            privacyAgreementPrefix: 'Улантуу менен сиз',
            privacyPolicyLinkText: 'купуялык саясатына',
            privacyError: 'Купуялык саясатын ачуу мүмкүн болгон жок.',
        },
    }[localeCode];
    const { login, isSendingCode, phone: phoneState } = useAuth();
    const [phone, setPhone] = useState(phoneState);

    const shouldStartRegistration = (error) => {
        const messageParts = [error?.message, error?.error, error?.response?.data?.error];
        const responseErrors = error?.response?.data?.errors;
        if (Array.isArray(responseErrors)) {
            messageParts.push(...responseErrors);
        }

        const normalized = messageParts
            .filter((part) => typeof part === 'string' && part.length > 0)
            .join(' ')
            .toLowerCase();

        if (!normalized) {
            return false;
        }

        return (
            normalized.includes('not found') ||
            normalized.includes('no driver') ||
            normalized.includes('driver not') ||
            normalized.includes('not registered') ||
            normalized.includes('does not exist') ||
            normalized.includes('invalid user')
        );
    };

    const handleSendVerificationCode = async () => {
        if (isSendingCode) {
            return;
        }

        if (!isValidPhoneNumber(phone)) {
            toast.error(loginCopy.invalidPhoneNumber);
            return;
        }

        try {
            await login(phone);
            navigation.navigate('PhoneLoginVerify');
        } catch (error) {
            if (shouldStartRegistration(error)) {
                navigation.navigate('CreateAccount', { phone });
                return;
            }

            const message = error instanceof Error ? error.message : loginCopy.unableToSendSms;
            toast.error(message);
        }
    };

    const handleOpenPrivacyPolicy = async () => {
        try {
            await Linking.openURL('https://www.fleetbase.io/privacy-policy');
        } catch (error) {
            toast.error(loginCopy.privacyError);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <AuthBackButton />
            <YStack flex={1} px="$4" justifyContent="center" alignItems="center" width="100%">
                <YStack space="$4" width="100%" maxWidth={420}>
                    <YStack alignItems="center" space="$3">
                        <Image source={require('../../assets/logo_primary.png')} style={{ width: 180, height: 72, resizeMode: 'contain' }} />
                        <Text color="#112b66" textAlign="center" fontSize={14} lineHeight={20} fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight="800">
                            {loginCopy.phoneEntryPrompt}
                        </Text>
                    </YStack>

                    <YStack width="100%">
                        <PhoneInput
                            value={phone}
                            onChange={(phoneNumber) => setPhone(phoneNumber)}
                            fixedDialCode="996"
                            maxDigits={9}
                            maskPattern="(XXX) XX - XX - XX"
                            inputPlaceholder="(___) __ - __ - __"
                            size="$6"
                            bg="#F5F6FA"
                            borderRadius={20}
                            containerBorderWidth={0}
                            containerBorderColor="transparent"
                            focusBorderWidth={3}
                            focusBorderColor="#112b66"
                            inputColor="#112b66"
                            dialCodeColor="#112b66"
                            inputFontSize={18}
                            inputFontFamily={isCyrillic ? undefined : 'Rubik-Bold'}
                            inputFontWeight="800"
                            placeholderTextColor="rgba(17, 43, 102, 0.45)"
                            wrapperProps={{ space: '$2' }}
                        />
                    </YStack>

                    <PhoneLoginButton onPress={handleSendVerificationCode} disabled={isSendingCode} />

                    <Text color="rgba(17, 43, 102, 0.7)" fontSize={12} textAlign="center" lineHeight={18} fontFamily={isCyrillic ? undefined : 'Rubik-Medium'}>
                        {loginCopy.privacyAgreementPrefix}{' '}
                        <Text color="#112b66" textDecorationLine="underline" onPress={handleOpenPrivacyPolicy} fontFamily={isCyrillic ? undefined : 'Rubik-Medium'}>
                            {loginCopy.privacyPolicyLinkText}
                        </Text>
                    </Text>
                </YStack>
            </YStack>
        </SafeAreaView>
    );
};

export default PhoneLoginScreen;
