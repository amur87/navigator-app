import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView } from 'react-native';
import { Button, Text, XStack, YStack } from 'tamagui';
import { toast } from '@backpackapp-io/react-native-toast';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { OtpInput } from 'react-native-otp-entry';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import AuthBackButton from '../components/AuthBackButton';

const PhoneLoginVerifyScreen = () => {
    const navigation = useNavigation<any>();
    const { language } = useLanguage();
    const isCyrillic = language.code === 'ru' || language.code === 'ky';
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const verifyCopy = {
        en: {
            retryIn: 'Retry in',
            retryButtonText: 'Retry',
            attempts: 'Attempts',
            invalidCode: 'Enter a valid code',
            unableToSendSms: 'Unable to send verification code',
            awaitingVerificationTitle: 'Enter the code sent to',
            verifyCodeButtonText: 'Confirm',
            blockedTitle: 'Try again in 1 hour',
            blockedMessage: 'You exceeded the number of attempts',
            verificationCodeSentVia: 'Code sent via',
        },
        ru: {
            retryIn: 'Повторить через',
            retryButtonText: 'Повторить',
            attempts: 'Попытки',
            invalidCode: 'Введите корректный код',
            unableToSendSms: 'Не удалось отправить код',
            awaitingVerificationTitle: 'Введите код, отправленный на',
            verifyCodeButtonText: 'Подтвердить',
            blockedTitle: 'Попробуйте через 1 час',
            blockedMessage: 'Вы превысили количество попыток',
            verificationCodeSentVia: 'Код отправлен через',
        },
        ky: {
            retryIn: 'Кайра жөнөтүү',
            retryButtonText: 'Кайра жөнөтүү',
            attempts: 'Аракеттер',
            invalidCode: 'Туура кодду киргизиңиз',
            unableToSendSms: 'Кодду жөнөтүү мүмкүн болгон жок',
            awaitingVerificationTitle: 'Номерге жөнөтүлгөн кодду киргизиңиз',
            verifyCodeButtonText: 'Ырастоо',
            blockedTitle: '1 сааттан кийин кайра аракет кылыңыз',
            blockedMessage: 'Сиз аракеттердин санынан ашып кеттиңиз',
            verificationCodeSentVia: 'Код жөнөтүлгөн канал:',
        },
    }[localeCode];

    const { phone, verifyCode, login, isVerifyingCode, loginMethod, isAuthenticated } = useAuth();
    const [code, setCode] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(60);
    const [attempts, setAttempts] = useState(0);
    const [blocked, setBlocked] = useState(false);

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

    const handleVerifyCode = async (value: string | null) => {
        if (isVerifyingCode || blocked) {
            return;
        }

        const normalizedCode = (value ?? '').replace(/\D/g, '');
        if (normalizedCode.length !== 6) {
            toast.error(verifyCopy.invalidCode);
            return;
        }

        try {
            await verifyCode(normalizedCode);
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
        if (blocked) {
            Alert.alert(verifyCopy.blockedTitle, verifyCopy.blockedMessage);
            return;
        }

        try {
            await login(phone);
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
            <YStack flex={1} justifyContent="center" alignItems="center" space="$4" padding="$5">
                <YStack mb="$3" alignItems="center">
                    <Image source={require('../../assets/logo_primary.png')} style={{ width: 180, height: 72, resizeMode: 'contain' }} />
                    <Text color="#112b66" fontSize={18} fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight="700" textAlign="center" mt="$3">
                        {verifyCopy.awaitingVerificationTitle}{' '}
                        <Text color="#112b66" fontSize={18} fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight="800" textAlign="center">
                            {phone ?? ''}
                        </Text>
                    </Text>
                </YStack>

                <OtpInput
                    numberOfDigits={6}
                    onTextChange={setCode}
                    onFilled={handleVerifyCode}
                    focusColor="#112b66"
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
                    size="$5"
                    onPress={() => handleVerifyCode(code)}
                    bg="#112b66"
                    width="100%"
                    opacity={isVerifyingCode ? 0.75 : 1}
                    disabled={isVerifyingCode || blocked}
                    borderRadius={20}
                    height={52}
                >
                    <Button.Text color="#FFFFFF" fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight="700">
                        {verifyCopy.verifyCodeButtonText}
                    </Button.Text>
                </Button>

                <Button
                    size="$5"
                    onPress={handleRetry}
                    bg="#F5F6FA"
                    width="100%"
                    borderRadius={20}
                    borderWidth={1.5}
                    borderColor={secondsLeft === 0 && !blocked ? '#112b66' : 'rgba(17,43,102,0.35)'}
                    opacity={secondsLeft === 0 && !blocked ? 1 : 0.5}
                    disabled={secondsLeft > 0 || blocked}
                >
                    <Button.Text color="#112b66" fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight="700">
                        {secondsLeft === 0
                            ? verifyCopy.retryButtonText
                            : `${verifyCopy.retryIn || 'Retry in'} ${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`}
                    </Button.Text>
                </Button>

                <YStack alignItems="center" space="$1">
                    <Text color="rgba(17,43,102,0.72)" fontSize={13} textAlign="center">
                        {`${verifyCopy.attempts || 'Attempts'}: ${Math.min(attempts, 3)} / 3`}
                    </Text>
                </YStack>

                {loginMethod === 'email' && (
                    <YStack mt="$4">
                        <XStack
                            bg="rgba(17,43,102,0.08)"
                            borderWidth={1}
                            borderColor="rgba(17,43,102,0.18)"
                            borderRadius="$4"
                            alignItems="flex-start"
                            px="$3"
                            py="$3"
                            space="$2"
                            flexWrap="wrap"
                        >
                            <YStack pt={2}>
                                <FontAwesomeIcon icon={faCircleInfo} color="#112b66" size={20} />
                            </YStack>
                            <YStack flex={1}>
                                <Text fontSize={15} color="#112b66" fontFamily={isCyrillic ? undefined : 'Rubik-Bold'} fontWeight="700">
                                    {verifyCopy.unableToSendSms}
                                </Text>
                                <Text fontSize={15} color="#112b66">
                                    {`${verifyCopy.verificationCodeSentVia} ${loginMethod}`}
                                </Text>
                            </YStack>
                        </XStack>
                    </YStack>
                )}
            </YStack>
        </SafeAreaView>
    );
};

export default PhoneLoginVerifyScreen;
