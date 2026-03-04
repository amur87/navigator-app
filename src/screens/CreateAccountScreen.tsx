import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, Image, Linking } from 'react-native';
import { Spinner, Text, YStack, Button } from 'tamagui';
import { toast } from '@backpackapp-io/react-native-toast';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import { isValidPhoneNumber } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import PhoneInput from '../components/PhoneInput';
import Input from '../components/Input';
import AuthBackButton from '../components/AuthBackButton';

const CreateAccountScreen = ({ route }) => {
    const params = route.params || {};
    const navigation = useNavigation<any>();
    const { t, language } = useLanguage();
    const isCyrillic = language.code === 'ru' || language.code === 'ky';
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const createCopy = {
        en: {
            privacyAgreementPrefix: 'By continuing you agree to',
            privacyPolicyLinkText: 'Privacy Policy',
            privacyError: 'Unable to open privacy policy.',
        },
        ru: {
            privacyAgreementPrefix: 'Продолжая, вы соглашаетесь с',
            privacyPolicyLinkText: 'политикой конфиденциальности',
            privacyError: 'Не удалось открыть политику конфиденциальности.',
        },
        ky: {
            privacyAgreementPrefix: 'Улантуу менен сиз',
            privacyPolicyLinkText: 'купуялык саясатына',
            privacyError: 'Купуялык саясатын ачуу мүмкүн болгон жок.',
        },
    }[localeCode];
    const { requestCreationCode, login, isSendingCode, phone: phoneState } = useAuth();
    const [phone, setPhone] = useState(phoneState);
    const [name, setName] = useState(`${params.name ?? ''}`);

    const isAlreadyRegisteredError = (error) => {
        const messageParts = [error?.message, error?.error, error?.response?.data?.error];
        const responseErrors = error?.response?.data?.errors;
        if (Array.isArray(responseErrors)) {
            messageParts.push(...responseErrors);
        }

        const normalized = messageParts
            .filter((part) => typeof part === 'string' && part.length > 0)
            .join(' ')
            .toLowerCase();

        return normalized.includes('already exists') || normalized.includes('already registered') || normalized.includes('уже существует') || normalized.includes('уже зарегистр');
    };

    const handleSendVerificationCode = async () => {
        if (isSendingCode) {
            return;
        }

        const normalizedName = `${name ?? ''}`.trim();
        const normalizedPhone = `${phone ?? ''}`.trim();

        if (!isValidPhoneNumber(normalizedPhone)) {
            return toast.error(t('Auth.LoginScreen.invalidPhoneNumber'));
        }

        try {
            await requestCreationCode(normalizedPhone);
            navigation.navigate('CreateAccountVerify', { name: normalizedName || null, phone: normalizedPhone });
        } catch (error) {
            if (isAlreadyRegisteredError(error)) {
                try {
                    await login(normalizedPhone);
                    navigation.navigate('PhoneLoginVerify');
                    return;
                } catch (loginError) {
                    toast.error(loginError?.message ?? `${loginError}`);
                    return;
                }
            }

            toast.error(error.message);
        }
    };

    const handleLogin = () => {
        navigation.navigate('PhoneLogin');
    };

    const handleOpenPrivacyPolicy = async () => {
        try {
            await Linking.openURL('https://www.fleetbase.io/privacy-policy');
        } catch (error) {
            toast.error(createCopy.privacyError);
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
                            {t('Auth.CreateAccountScreen.title')}
                        </Text>
                    </YStack>

                    <YStack width="100%" space="$3">
                        <Input
                            value={name}
                            onChangeText={(text) => setName(text)}
                            placeholder={t('Auth.CreateAccountScreen.nameInputPlaceholder')}
                            keyboardType='default'
                            autoCapitalize='words'
                            textContentType='name'
                            bg="#F5F6FA"
                            borderRadius={20}
                            borderWidth={0}
                            color="#112b66"
                            placeholderTextColor="rgba(17, 43, 102, 0.45)"
                            fontSize={17}
                            fontFamily={isCyrillic ? undefined : 'Rubik-Bold'}
                            fontWeight="700"
                            containerHeight={52}
                        />
                        <PhoneInput
                            value={phone}
                            onChange={(phoneNumber) => setPhone(phoneNumber)}
                            fixedDialCode='996'
                            maxDigits={9}
                            maskPattern='(XXX) XX - XX - XX'
                            inputPlaceholder='(___) __ - __ - __'
                            size='$6'
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

                    <Button size="$5" mt="$2" onPress={handleSendVerificationCode} bg="#112b66" width="100%" opacity={isSendingCode ? 0.75 : 1} disabled={isSendingCode} borderRadius={20} height={52}>
                        <Button.Icon>{isSendingCode ? <Spinner color="#FFFFFF" /> : <FontAwesomeIcon icon={faPaperPlane} color="#FFFFFF" />}</Button.Icon>
                        <Button.Text color="#FFFFFF" fontWeight="700" fontFamily={isCyrillic ? undefined : 'Rubik-Bold'}>
                            {t('Auth.CreateAccountScreen.sendVerificationCodeButtonText')}
                        </Button.Text>
                    </Button>

                    <Button size="$5" onPress={handleLogin} bg="#F5F6FA" width="100%" opacity={isSendingCode ? 0.75 : 1} disabled={isSendingCode} borderRadius={20} borderWidth={1.5} borderColor="#D4D9E5" height={52}>
                        <Button.Text color="#112b66" fontWeight="700" fontFamily={isCyrillic ? undefined : 'Rubik-Bold'}>
                            {t('Auth.CreateAccountScreen.haveAccountLoginButtonText')}
                        </Button.Text>
                    </Button>

                    <Text color="rgba(17, 43, 102, 0.7)" fontSize={12} textAlign="center" lineHeight={18} fontFamily={isCyrillic ? undefined : 'Rubik-Medium'}>
                        {createCopy.privacyAgreementPrefix}{' '}
                        <Text color="#112b66" textDecorationLine="underline" onPress={handleOpenPrivacyPolicy} fontFamily={isCyrillic ? undefined : 'Rubik-Medium'}>
                            {createCopy.privacyPolicyLinkText}
                        </Text>
                    </Text>
                </YStack>
            </YStack>
        </SafeAreaView>
    );
};

export default CreateAccountScreen;
