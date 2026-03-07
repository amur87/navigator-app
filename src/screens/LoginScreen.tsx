import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, Image, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, YStack, XStack, Button } from 'tamagui';
import { PhoneLoginButton } from '../components/Buttons';
import DeviceInfo from 'react-native-device-info';
import { useLanguage } from '../contexts/LanguageContext';

const LoginScreen = () => {
    const navigation = useNavigation();
    const { t, languages, setLocale, language } = useLanguage();
    const isCyrillic = language.code === 'ru' || language.code === 'ky';
    const insets = useSafeAreaInsets();
    const { height: windowHeight, width: windowWidth } = Dimensions.get('window');
    const localeCode = language.code === 'ru' || language.code === 'ky' ? language.code : 'en';
    const loginCopy = {
        en: {
            welcomeTitle: 'Welcome to delivery max.',
            chooseLanguage: 'You can continue sign in or registration in English, or pick another below',
            registerButtonText: 'Register',
            selectedLanguageName: 'English',
        },
        ru: {
            welcomeTitle: 'Добро пожаловать в delivery max.',
            chooseLanguage: 'Вы можете продолжить вход или регистрацию на русском языке или выбрать удобный для вас ниже',
            registerButtonText: 'Регистрация',
            selectedLanguageName: 'русском',
        },
        ky: {
            welcomeTitle: 'Delivery max. кош келиңиз!',
            chooseLanguage: 'Сиз кирүүнү же каттоону Кыргыз тилинде уланта аласыз же төмөндөн ыңгайлуусун тандаңыз',
            registerButtonText: 'Каттоо',
            selectedLanguageName: 'Кыргыз тилинде',
        },
    }[localeCode];

    const handlePhoneLogin = () => {
        navigation.navigate('PhoneLogin');
    };

    return (
        <YStack flex={1} height="100%" width="100%" bg="#FFFFFF" position="relative">
            <YStack justifyContent="center" alignItems="center" paddingTop={insets.top} marginTop={windowHeight / 3}>
                <Image
                    source={require('../../assets/logo_primary.png')}
                    style={{
                        width: (windowWidth - 48) * 0.7,
                        height: (windowWidth - 48) * 0.3 * 0.7,
                        resizeMode: 'contain',
                    }}
                />
                <Text color="#112b66" fontFamily='Rubik-Black' fontWeight="900" fontSize={20} mt="$3">
                    {loginCopy.welcomeTitle || t('Auth.LoginScreen.welcomeTitle')}
                </Text>
                <Text color="rgba(17,43,102,0.72)" fontFamily='Rubik-Medium' fontSize={14} textAlign="center" mt="$2" px="$6">
                    {loginCopy.chooseLanguage ||
                        t('Auth.LoginScreen.chooseLanguage', {
                            selectedLanguageName: loginCopy.selectedLanguageName,
                        })}
                </Text>
                <XStack mt="$4" space="$2" flexWrap="wrap" justifyContent="center">
                    {languages.map((lang) => {
                        const selected = lang.code === language.code;
                        const baseName =
                            lang.code === 'ky' ? 'Кыргызча' : lang.code === 'ru' ? 'Русский' : lang.code === 'en' ? 'English' : lang.native || lang.name || lang.code.toUpperCase();
                        return (
                            <Button
                                key={lang.code}
                                size="$3"
                                bg={selected ? '#112b66' : '#E9ECF2'}
                                borderColor="transparent"
                                borderWidth={0}
                                onPress={() => setLocale(lang.code)}
                                pressStyle={{ opacity: 0.85 }}
                                justifyContent="center"
                            >
                                <Text
                                    color={selected ? '#FFFFFF' : '#112b66'}
                                    fontFamily='Rubik-Bold'
                                    fontWeight="700"
                                    fontSize={14}
                                    numberOfLines={1}
                                >
                                    {baseName}
                                </Text>
                            </Button>
                        );
                    })}
                </XStack>
            </YStack>
            <SafeAreaView style={{ flex: 1 }}>
                <YStack flex={1} justifyContent="flex-end" alignItems="center" space="$3" px="$5" pb="$6">
                    <YStack width="100%" space="$2">
                        <PhoneLoginButton onPress={handlePhoneLogin} />
                        <Button
                            onPress={() => navigation.navigate('CreateAccount')}
                            bg="#FFFFFF"
                            borderRadius={20}
                            borderWidth={1.5}
                            borderColor="#112b66"
                            height={52}
                            pressStyle={{ opacity: 0.9 }}
                        >
                            <Text color="#112b66" fontFamily='Rubik-Bold' fontWeight="700" fontSize={16}>
                                {loginCopy.registerButtonText || t('Auth.LoginScreen.registerButtonText')}
                            </Text>
                        </Button>
                    </YStack>
                    <Text color="$textSecondary" fontSize="$2">
                        v{DeviceInfo.getVersion()} #{DeviceInfo.getBuildNumber()}
                    </Text>
                </YStack>
            </SafeAreaView>
            {/* Loading overlay retained for future use */}
        </YStack>
    );
};

export default LoginScreen;


