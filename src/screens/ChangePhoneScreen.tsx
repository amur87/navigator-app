import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SafeAreaView, Alert, StatusBar } from 'react-native';
import { Button, Text, YStack } from 'tamagui';
import { toast, ToastPosition } from '@backpackapp-io/react-native-toast';
import { useNavigation } from '@react-navigation/native';
import { OtpInput } from 'react-native-otp-entry';
import { isValidPhoneNumber } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import PhoneInput from '../components/PhoneInput';
import GlassHeader from '../components/GlassHeader';

const RETRY_SECONDS = 60;
const MAX_ATTEMPTS = 3;
const OTP_LENGTH = 6;
const PRIMARY = '#112b66';

type Step = 'phone' | 'otp';

const ChangePhoneScreen = () => {
    const navigation = useNavigation<any>();
    const { driver, login, verifyCode, updateDriver } = useAuth();
    const { language } = useLanguage();
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';

    const copy = {
        en: {
            currentPhone: 'Current number',
            notSet: 'not set',
            enterNewPhone: 'Enter a new phone number',
            sendCode: 'Send code',
            invalidPhone: 'Enter a valid phone number',
            tooManyAttempts: 'Too many attempts. Try again later.',
            codeSent: 'Code sent to',
            errorSending: 'Failed to send code',
            enterCode: 'Enter the code sent to',
            confirm: 'Confirm',
            retry: 'Retry',
            retryIn: 'Retry in',
            attempts: 'Attempts',
            invalidCode: 'Enter a valid code',
            phoneChanged: 'Phone number changed',
            changeNumber: 'Change number',
            blockedTitle: 'Try again in 1 hour',
            blockedMessage: 'You exceeded the number of attempts',
        },
        ru: {
            currentPhone: 'Текущий номер',
            notSet: 'не указан',
            enterNewPhone: 'Введите новый номер телефона',
            sendCode: 'Отправить код',
            invalidPhone: 'Введите корректный номер телефона',
            tooManyAttempts: 'Превышено количество попыток. Попробуйте позже.',
            codeSent: 'Код отправлен на',
            errorSending: 'Не удалось отправить код',
            enterCode: 'Введите код, отправленный на',
            confirm: 'Подтвердить',
            retry: 'Повторить',
            retryIn: 'Повторить через',
            attempts: 'Попытки',
            invalidCode: 'Введите корректный код',
            phoneChanged: 'Номер телефона изменен',
            changeNumber: 'Изменить номер',
            blockedTitle: 'Попробуйте через 1 час',
            blockedMessage: 'Вы превысили количество попыток',
        },
        ky: {
            currentPhone: 'Учурдагы номер',
            notSet: 'көрсөтүлгөн эмес',
            enterNewPhone: 'Жаңы телефон номерин киргизиңиз',
            sendCode: 'Код жөнөтүү',
            invalidPhone: 'Туура телефон номерин киргизиңиз',
            tooManyAttempts: 'Аракеттер санынан ашып кеттиңиз.',
            codeSent: 'Код жөнөтүлдү',
            errorSending: 'Кодду жөнөтүү мүмкүн болгон жок',
            enterCode: 'Номерге жөнөтүлгөн кодду киргизиңиз',
            confirm: 'Ырастоо',
            retry: 'Кайра жөнөтүү',
            retryIn: 'Кайра жөнөтүү',
            attempts: 'Аракеттер',
            invalidCode: 'Туура кодду киргизиңиз',
            phoneChanged: 'Телефон номери өзгөртүлдү',
            changeNumber: 'Номерди өзгөртүү',
            blockedTitle: '1 сааттан кийин кайра аракет кылыңыз',
            blockedMessage: 'Сиз аракеттердин санынан ашып кеттиңиз',
        },
    }[localeCode];

    const getDriverValue = (key: string, fallback = '') => {
        if (!driver) return fallback;
        if (typeof (driver as any).getAttribute === 'function') {
            return (driver as any).getAttribute(key) ?? fallback;
        }
        return (driver as any)?.[key] ?? fallback;
    };

    const currentPhone = getDriverValue('phone', '');
    const [step, setStep] = useState<Step>('phone');
    const [newPhone, setNewPhone] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [code, setCode] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [attempts, setAttempts] = useState(0);
    const [blocked, setBlocked] = useState(false);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [retryTrigger, setRetryTrigger] = useState(0);
    const otpInputRef = useRef<any>(null);

    useEffect(() => {
        if (blocked || step !== 'otp') return;
        const timerId = setInterval(() => {
            setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timerId);
    }, [blocked, retryTrigger, step]);

    const handleSendCode = useCallback(async () => {
        if (isSending) return;
        if (!isValidPhoneNumber(newPhone)) {
            toast.error(copy.invalidPhone);
            return;
        }
        if (attempts >= MAX_ATTEMPTS) {
            toast.error(copy.tooManyAttempts);
            return;
        }

        setIsSending(true);
        try {
            await login(newPhone);
            setStep('otp');
            setSecondsLeft(RETRY_SECONDS);
            setRetryTrigger((v) => v + 1);
            toast.success(`${copy.codeSent} ${newPhone}`, { position: ToastPosition.BOTTOM });
        } catch (error: any) {
            toast.error(error?.message ?? copy.errorSending);
        } finally {
            setIsSending(false);
        }
    }, [newPhone, isSending, attempts, login, copy]);

    const handleVerifyCode = useCallback(async (value: string | null) => {
        if (isVerifying || blocked) return;
        const normalizedCode = (value ?? '').replace(/\D/g, '');
        if (normalizedCode.length !== OTP_LENGTH) {
            setVerifyError(copy.invalidCode);
            toast.error(copy.invalidCode);
            return;
        }

        setIsVerifying(true);
        try {
            setVerifyError(null);
            await verifyCode(normalizedCode);
            await updateDriver({ phone: newPhone });
            toast.success(copy.phoneChanged, { position: ToastPosition.BOTTOM });
            navigation.goBack();
        } catch (error: any) {
            const nextAttempts = attempts + 1;
            setAttempts(nextAttempts);
            if (nextAttempts >= MAX_ATTEMPTS) {
                setBlocked(true);
                Alert.alert(copy.blockedTitle, copy.blockedMessage);
                navigation.goBack();
                return;
            }
            const message = error instanceof Error ? error.message : copy.invalidCode;
            setVerifyError(message);
            toast.error(message);
        } finally {
            setIsVerifying(false);
        }
    }, [isVerifying, blocked, verifyCode, updateDriver, newPhone, navigation, attempts, copy]);

    const handleRetry = useCallback(async () => {
        if (blocked) {
            Alert.alert(copy.blockedTitle, copy.blockedMessage);
            return;
        }
        try {
            await login(newPhone);
            setSecondsLeft(RETRY_SECONDS);
            setRetryTrigger((v) => v + 1);
            setCode('');
            otpInputRef.current?.clear();
            setVerifyError(null);
        } catch (error: any) {
            toast.error(error?.message ?? copy.errorSending);
        }
    }, [blocked, login, newPhone, copy]);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title={copy.changeNumber} />

            {step === 'phone' ? (
                <YStack flex={1} px="$4" justifyContent="center" alignItems="center" width="100%">
                    <YStack space="$4" width="100%" maxWidth={420}>
                        <YStack alignItems="center" space="$3">
                            <Text color={PRIMARY} textAlign="center" fontSize={14} lineHeight={20} fontFamily="Rubik-Bold" fontWeight="800">
                                {copy.enterNewPhone}
                            </Text>
                            <Text color="rgba(17,43,102,0.6)" fontSize={13} fontFamily="Rubik-Medium">
                                {copy.currentPhone}: {currentPhone || copy.notSet}
                            </Text>
                        </YStack>

                        <YStack width="100%">
                            <PhoneInput
                                value={newPhone}
                                onChange={(phoneNumber) => setNewPhone(phoneNumber)}
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
                                focusBorderColor={PRIMARY}
                                inputColor={PRIMARY}
                                dialCodeColor={PRIMARY}
                                inputFontSize={18}
                                inputFontFamily="Rubik-Bold"
                                inputFontWeight="800"
                                placeholderTextColor="rgba(17, 43, 102, 0.45)"
                                wrapperProps={{ space: '$2' }}
                            />
                        </YStack>

                        <Button
                            onPress={handleSendCode}
                            bg={PRIMARY}
                            borderWidth={1.5}
                            borderColor={PRIMARY}
                            size="$5"
                            width="100%"
                            borderRadius={20}
                            height={52}
                            opacity={isSending || !newPhone ? 0.75 : 1}
                            disabled={isSending || !newPhone}
                        >
                            <Button.Text color="#FFFFFF" fontFamily="Rubik-Bold" fontWeight="700">
                                {copy.sendCode}
                            </Button.Text>
                        </Button>
                    </YStack>
                </YStack>
            ) : (
                <YStack flex={1} justifyContent="center" alignItems="center" space="$4" padding="$5">
                    <YStack mb="$3" alignItems="center">
                        <Text color={PRIMARY} fontSize={18} fontFamily="Rubik-Bold" fontWeight="700" textAlign="center">
                            {copy.enterCode}{' '}
                            <Text color={PRIMARY} fontSize={18} fontFamily="Rubik-Bold" fontWeight="800">
                                {newPhone}
                            </Text>
                        </Text>
                    </YStack>

                    <OtpInput
                        ref={otpInputRef}
                        numberOfDigits={OTP_LENGTH}
                        onFilled={handleVerifyCode}
                        onTextChange={(value) => {
                            setCode(value);
                            if (verifyError) setVerifyError(null);
                        }}
                        focusColor={PRIMARY}
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
                                color: PRIMARY,
                                fontSize: 22,
                                fontFamily: 'Rubik-Bold',
                                fontWeight: '700',
                            },
                        }}
                    />

                    <Button
                        size="$5"
                        onPress={() => handleVerifyCode(code)}
                        bg={PRIMARY}
                        width="100%"
                        opacity={isVerifying ? 0.75 : 1}
                        disabled={isVerifying || blocked}
                        borderRadius={20}
                        height={52}
                    >
                        <Button.Text color="#FFFFFF" fontFamily="Rubik-Bold" fontWeight="700">
                            {copy.confirm}
                        </Button.Text>
                    </Button>

                    <Button
                        size="$5"
                        onPress={handleRetry}
                        bg="#F5F6FA"
                        width="100%"
                        borderRadius={20}
                        borderWidth={1.5}
                        borderColor={secondsLeft === 0 && !blocked ? PRIMARY : 'rgba(17,43,102,0.35)'}
                        opacity={secondsLeft === 0 && !blocked ? 1 : 0.5}
                        disabled={secondsLeft > 0 || blocked}
                    >
                        <Button.Text color={PRIMARY} fontFamily="Rubik-Bold" fontWeight="700">
                            {secondsLeft === 0
                                ? copy.retry
                                : `${copy.retryIn} ${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`}
                        </Button.Text>
                    </Button>

                    <YStack alignItems="center" space="$1">
                        <Text color="rgba(17,43,102,0.72)" fontSize={13} textAlign="center">
                            {`${copy.attempts}: ${Math.min(attempts, 3)} / 3`}
                        </Text>
                        {verifyError ? (
                            <Text color="#B42318" fontSize={13} textAlign="center" fontFamily="Rubik-Medium">
                                {verifyError}
                            </Text>
                        ) : null}
                    </YStack>

                    <Button
                        size="$4"
                        onPress={() => { setStep('phone'); setCode(''); setVerifyError(null); }}
                        bg="transparent"
                        borderWidth={0}
                    >
                        <Button.Text color={PRIMARY} fontFamily="Rubik-Medium" fontSize={14}>
                            {copy.changeNumber}
                        </Button.Text>
                    </Button>
                </YStack>
            )}
        </SafeAreaView>
    );
};

export default ChangePhoneScreen;
