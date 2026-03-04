import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView } from 'react-native';
import { Button, Text, YStack } from 'tamagui';
import { toast } from '@backpackapp-io/react-native-toast';
import { OtpInput } from 'react-native-otp-entry';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import AuthBackButton from '../components/AuthBackButton';

const CreateAccountVerifyScreen = ({ route }) => {
    const navigation = useNavigation<any>();
    const { language, t } = useLanguage();
    const isCyrillic = language.code === 'ru' || language.code === 'ky';
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const verifyCopy = {
        en: {
            retryIn: 'Retry in',
            retryButtonText: t('Auth.CreateAccountScreen.retryButtonText'),
            attempts: 'Attempts',
            invalidCode: t('Auth.CreateAccountScreen.codeRequiredError'),
            unableToSendSms: 'Unable to send verification code',
            awaitingVerificationTitle: t('Auth.CreateAccountScreen.awaitingVerificationTitle'),
            verifyCodeButtonText: t('Auth.CreateAccountScreen.verifyCodeButtonText'),
            blockedTitle: 'Try again in 1 hour',
            blockedMessage: 'You exceeded the number of attempts',
        },
        ru: {
            retryIn: 'Повторить через',
            retryButtonText: t('Auth.CreateAccountScreen.retryButtonText'),
            attempts: 'Попытки',
            invalidCode: t('Auth.CreateAccountScreen.codeRequiredError'),
            unableToSendSms: 'Не удалось отправить код',
            awaitingVerificationTitle: t('Auth.CreateAccountScreen.awaitingVerificationTitle'),
            verifyCodeButtonText: t('Auth.CreateAccountScreen.verifyCodeButtonText'),
            blockedTitle: 'Попробуйте через 1 час',
            blockedMessage: 'Вы превысили количество попыток',
        },
        ky: {
            retryIn: 'Кайра жөнөтүү',
            retryButtonText: t('Auth.CreateAccountScreen.retryButtonText'),
            attempts: 'Аракеттер',
            invalidCode: t('Auth.CreateAccountScreen.codeRequiredError'),
            unableToSendSms: 'Кодду жөнөтүү мүмкүн болгон жок',
            awaitingVerificationTitle: t('Auth.CreateAccountScreen.awaitingVerificationTitle'),
            verifyCodeButtonText: t('Auth.CreateAccountScreen.verifyCodeButtonText'),
            blockedTitle: '1 сааттан кийин кайра аракет кылыңыз',
            blockedMessage: 'Сиз аракеттердин санынан ашып кеттиңиз',
        },
    }[localeCode];

    const { phone: contextPhone, verifyAccountCreation, requestCreationCode, isVerifyingCode, isAuthenticated } = useAuth();
    const [code, setCode] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(60);
    const [attempts, setAttempts] = useState(0);
    const [blocked, setBlocked] = useState(false);
    const name = route?.params?.name;
    const phone = route?.params?.phone ?? contextPhone;

    useEffect(() => {
        if (blocked || secondsLeft <= 0) {
            return;
        }

        const id = setInterval(() => {
            setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
        }, 1000);

        return () => clearInterval(id);
    }, [secondsLeft, blocked]);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        navigation.reset({ index: 0, routes: [{ name: 'DriverNavigator' }] });
    }, [isAuthenticated, navigation]);

    const handleVerifyCode = async (inputCode: string | null) => {
        if (isVerifyingCode || blocked) {
            return;
        }

        const normalizedCode = `${inputCode ?? ''}`.replace(/\D/g, '');
        if (normalizedCode.length !== 6) {
            toast.error(verifyCopy.invalidCode);
            return;
        }

        if (!phone) {
            toast.error(t('Auth.CreateAccountScreen.missingPhoneError'));
            return;
        }

        try {
            await verifyAccountCreation(phone, normalizedCode, { name, phone });
        } catch (error) {
            const nextAttempts = attempts + 1;
            setAttempts(nextAttempts);

            if (nextAttempts >= 3) {
                setBlocked(true);
                Alert.alert(verifyCopy.blockedTitle, verifyCopy.blockedMessage);
                navigation.reset({ index: 0, routes: [{ name: 'PhoneLogin' }] });
                return;
            }

            const message = error instanceof Error ? error.message : verifyCopy.invalidCode;
            toast.error(message);
        }
    };

    const handleRetry = async () => {
        if (!phone || blocked) {
            if (blocked) {
                Alert.alert(verifyCopy.blockedTitle, verifyCopy.blockedMessage);
            }
            return;
        }

        try {
            await requestCreationCode(phone);
            setSecondsLeft(60);
            setCode('');
        } catch (error) {
            const message = error instanceof Error ? error.message : verifyCopy.unableToSendSms;
            toast.error(message);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <AuthBackButton />
            <YStack flex={1} justifyContent='center' alignItems='center' space='$4' padding='$5'>
                <YStack mb='$3' alignItems='center'>
                    <Image source={require('../../assets/logo_primary.png')} style={{ width: 180, height: 72, resizeMode: 'contain' }} />
                    <Text color='#112b66' fontSize={18} fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight='700' textAlign='center' mt='$3'>
                        {verifyCopy.awaitingVerificationTitle}{' '}
                        <Text color='#112b66' fontSize={18} fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight='800' textAlign='center'>
                            {phone ?? ''}
                        </Text>
                    </Text>
                </YStack>

                <OtpInput
                    numberOfDigits={6}
                    onTextChange={setCode}
                    onFilled={handleVerifyCode}
                    focusColor='#112b66'
                    theme={{
                        pinCodeContainerStyle: {
                            borderColor: 'transparent',
                            height: 54,
                            width: 54,
                            borderRadius: 14,
                            borderWidth: 2,
                            backgroundColor: '#F2F3F5',
                        },
                        pinCodeTextStyle: {
                            color: '#112b66',
                            fontSize: 22,
                            fontFamily: isCyrillic ? undefined : 'Rubik-Bold',
                            fontWeight: '700',
                        },
                    }}
                />

                <Button
                    size='$5'
                    onPress={() => handleVerifyCode(code)}
                    bg='#112b66'
                    width='100%'
                    opacity={isVerifyingCode ? 0.75 : 1}
                    disabled={isVerifyingCode || blocked}
                    borderRadius={20}
                    height={52}
                >
                    <Button.Text color='#FFFFFF' fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight='700'>
                        {verifyCopy.verifyCodeButtonText}
                    </Button.Text>
                </Button>

                <Button
                    size='$5'
                    onPress={handleRetry}
                    bg='#F5F6FA'
                    width='100%'
                    borderRadius={20}
                    borderWidth={1.5}
                    borderColor={secondsLeft === 0 && !blocked ? '#112b66' : 'rgba(17,43,102,0.35)'}
                    opacity={secondsLeft === 0 && !blocked ? 1 : 0.5}
                    disabled={secondsLeft > 0 || blocked}
                >
                    <Button.Text color='#112b66' fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight='700'>
                        {secondsLeft === 0
                            ? verifyCopy.retryButtonText
                            : `${verifyCopy.retryIn} ${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`}
                    </Button.Text>
                </Button>

                <YStack alignItems='center' space='$1'>
                    <Text color='rgba(17,43,102,0.72)' fontSize={13} textAlign='center'>
                        {`${verifyCopy.attempts}: ${Math.min(attempts, 3)} / 3`}
                    </Text>
                </YStack>
            </YStack>
        </SafeAreaView>
    );
};

export default CreateAccountVerifyScreen;
