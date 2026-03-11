import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, Image, Linking } from 'react-native';
import { Spinner, Text, YStack, XStack, Input as TamaguiInput, Button } from 'tamagui';
import { toast } from '@backpackapp-io/react-native-toast';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faArrowRight, faUser, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { isValidPhoneNumber } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import PhoneInput from '../components/PhoneInput';
import AuthBackButton from '../components/AuthBackButton';

const inputStyle = {
    bg: '#F5F6FA',
    borderRadius: 20,
    color: '#112b66',
    fontSize: 18,
    fontFamily: 'Rubik-Bold',
    fontWeight: '800' as const,
    placeholderTextColor: 'rgba(17, 43, 102, 0.45)',
    borderWidth: 0,
    borderColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    focusStyle: {
        borderWidth: 3,
        borderColor: '#112b66',
    },
};

const CreateAccountScreen = ({ route }) => {
    const params = route.params || {};
    const navigation = useNavigation<any>();
    const { t, language } = useLanguage();
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const createCopy = {
        en: {
            title: 'Create an account to start delivering',
            privacyAgreementPrefix: 'By continuing you agree to',
            privacyPolicyLinkText: 'Privacy Policy',
            privacyError: 'Unable to open privacy policy.',
            registerButton: 'Continue',
            nameRequired: 'Please enter your name',
            emailRequired: 'Please enter your email',
            emailInvalid: 'Please enter a valid email',
            namePlaceholder: 'Full name',
            emailPlaceholder: 'Email',
            haveAccount: 'Already have an account? Sign in',
        },
        ru: {
            title: 'Создайте аккаунт, чтобы начать доставлять',
            privacyAgreementPrefix: 'Продолжая, вы соглашаетесь с',
            privacyPolicyLinkText: 'политикой конфиденциальности',
            privacyError: 'Не удалось открыть политику конфиденциальности.',
            registerButton: 'Продолжить',
            nameRequired: 'Введите ваше имя',
            emailRequired: 'Введите вашу почту',
            emailInvalid: 'Введите корректную почту',
            namePlaceholder: 'Имя и фамилия',
            emailPlaceholder: 'Электронная почта',
            haveAccount: 'Уже есть аккаунт? Войти',
        },
        ky: {
            title: 'Жеткирүүнү баштоо үчүн аккаунт түзүңүз',
            privacyAgreementPrefix: 'Улантуу менен сиз',
            privacyPolicyLinkText: 'купуялык саясатына',
            privacyError: 'Купуялык саясатын ачуу мүмкүн болгон жок.',
            registerButton: 'Улантуу',
            nameRequired: 'Атыңызды жазыңыз',
            emailRequired: 'Электрондук почтаңызды жазыңыз',
            emailInvalid: 'Туура электрондук почта жазыңыз',
            namePlaceholder: 'Аты-жөнүңүз',
            emailPlaceholder: 'Электрондук почта',
            haveAccount: 'Аккаунтуңуз барбы? Кирүү',
        },
    }[localeCode];
    const { verifyAccountCreation, login, isSendingCode, isVerifyingCode, phone: phoneState } = useAuth();
    const [phone, setPhone] = useState(phoneState);
    const [name, setName] = useState(`${params.name ?? ''}`);
    const [email, setEmail] = useState('');
    const isLoading = isSendingCode || isVerifyingCode;

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

    const handleRegister = async () => {
        if (isLoading) {
            return;
        }

        const normalizedName = `${name ?? ''}`.trim();
        const normalizedPhone = `${phone ?? ''}`.trim();
        const normalizedEmail = `${email ?? ''}`.trim().toLowerCase();

        if (!normalizedName) {
            return toast.error(createCopy.nameRequired);
        }

        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return toast.error(!normalizedEmail ? createCopy.emailRequired : createCopy.emailInvalid);
        }

        if (!isValidPhoneNumber(normalizedPhone)) {
            return toast.error(t('Auth.LoginScreen.invalidPhoneNumber'));
        }

        let isExistingUser = false;

        try {
            // Step 1: Create driver account on Fleetbase (no authentication yet)
            await verifyAccountCreation(normalizedPhone, '999000', { name: normalizedName, phone: normalizedPhone, email: normalizedEmail });
        } catch (error) {
            // If already registered — mark as existing user and proceed to SMS
            if (isAlreadyRegisteredError(error)) {
                isExistingUser = true;
            } else {
                toast.error(error.message);
                return;
            }
        }

        try {
            // Step 2: Send SMS verification code to confirm the phone number
            await login(normalizedPhone);
            // Pass context so Boot can decide: existing user → Dashboard, new user → registration flow
            navigation.navigate('PhoneLoginVerify', {
                name: normalizedName,
                phone: normalizedPhone,
                email: normalizedEmail,
                isExistingUser,
            });
        } catch (loginError) {
            toast.error(loginError?.message ?? `${loginError}`);
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
                        <Text color="#112b66" textAlign="center" fontSize={14} lineHeight={20} fontFamily='Rubik-Bold' fontWeight="800" px="$4">
                            {createCopy.title}
                        </Text>
                    </YStack>

                    <YStack width="100%" space="$2.5">
                        {/* Name input — styled like PhoneInput */}
                        <XStack
                            width="100%"
                            height={52}
                            bg="#F5F6FA"
                            borderRadius={20}
                            borderWidth={0}
                            borderColor="transparent"
                            alignItems="center"
                            overflow="hidden"
                        >
                            <XStack position="absolute" left={16} top={0} bottom={0} alignItems="center" zIndex={2} pointerEvents="none">
                                <FontAwesomeIcon icon={faUser} size={16} color="rgba(17, 43, 102, 0.35)" />
                            </XStack>
                            <TamaguiInput
                                flex={1}
                                size="$6"
                                value={name}
                                onChangeText={(text) => setName(text)}
                                placeholder={createCopy.namePlaceholder}
                                keyboardType="default"
                                autoCapitalize="words"
                                textContentType="name"
                                paddingLeft={44}
                                {...inputStyle}
                            />
                        </XStack>

                        {/* Email input — styled like PhoneInput */}
                        <XStack
                            width="100%"
                            height={52}
                            bg="#F5F6FA"
                            borderRadius={20}
                            borderWidth={0}
                            borderColor="transparent"
                            alignItems="center"
                            overflow="hidden"
                        >
                            <XStack position="absolute" left={16} top={0} bottom={0} alignItems="center" zIndex={2} pointerEvents="none">
                                <FontAwesomeIcon icon={faEnvelope} size={16} color="rgba(17, 43, 102, 0.35)" />
                            </XStack>
                            <TamaguiInput
                                flex={1}
                                size="$6"
                                value={email}
                                onChangeText={(text) => setEmail(text)}
                                placeholder={createCopy.emailPlaceholder}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                textContentType="emailAddress"
                                paddingLeft={44}
                                {...inputStyle}
                            />
                        </XStack>

                        {/* Phone input */}
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
                            inputFontFamily='Rubik-Bold'
                            inputFontWeight="800"
                            placeholderTextColor="rgba(17, 43, 102, 0.45)"
                            wrapperProps={{ space: '$2' }}
                        />
                    </YStack>

                    <Button size="$5" mt="$2" onPress={handleRegister} bg="#112b66" width="100%" opacity={isLoading ? 0.75 : 1} disabled={isLoading} borderRadius={20} height={52}>
                        {isLoading ? (
                            <Button.Icon><Spinner color="#FFFFFF" /></Button.Icon>
                        ) : null}
                        <Button.Text color="#FFFFFF" fontWeight="700" fontFamily='Rubik-Bold'>
                            {createCopy.registerButton}
                        </Button.Text>
                        {!isLoading ? (
                            <Button.Icon><FontAwesomeIcon icon={faArrowRight} color="#FFFFFF" size={16} /></Button.Icon>
                        ) : null}
                    </Button>

                    <Button size="$5" onPress={handleLogin} bg="#F5F6FA" width="100%" opacity={isLoading ? 0.75 : 1} disabled={isLoading} borderRadius={20} borderWidth={1.5} borderColor="#D4D9E5" height={52}>
                        <Button.Text color="#112b66" fontWeight="700" fontFamily='Rubik-Bold'>
                            {createCopy.haveAccount}
                        </Button.Text>
                    </Button>

                    <Text color="rgba(17, 43, 102, 0.7)" fontSize={12} textAlign="center" lineHeight={18} fontFamily='Rubik-Medium'>
                        {createCopy.privacyAgreementPrefix}{' '}
                        <Text color="#112b66" textDecorationLine="underline" onPress={handleOpenPrivacyPolicy} fontFamily='Rubik-Medium'>
                            {createCopy.privacyPolicyLinkText}
                        </Text>
                    </Text>
                </YStack>
            </YStack>
        </SafeAreaView>
    );
};

export default CreateAccountScreen;
