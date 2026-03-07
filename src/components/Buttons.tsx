import React from 'react';
import { Button } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faFacebook, faInstagram, faGoogle, faApple } from '@fortawesome/free-brands-svg-icons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from 'tamagui';
import { useLanguage } from '../contexts/LanguageContext';
import { getMaterialRipple } from '../utils/material-ripple';

export const PhoneLoginButton = ({ onPress, ...props }) => {
    const { t, language } = useLanguage();
    const isCyrillic = language?.code === 'ru' || language?.code === 'ky';
    const localeCode = language?.code === 'ru' || language?.code === 'ky' ? language.code : 'en';
    const labelByLocale = {
        en: 'Sign in',
        ru: 'Войти',
        ky: 'Кирүү',
    };

    return (
        <Button
            onPress={onPress}
            bg="#112b66"
            borderWidth={1.5}
            borderColor="#112b66"
            width="100%"
            height={52}
            pressStyle={{ opacity: 0.92 }}
            android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.22)', foreground: true })}
            {...props}
            borderRadius={20}
        >
            <Button.Text color="#FFFFFF" fontFamily='Rubik-Bold' fontSize={16} fontWeight="700">
                {labelByLocale[localeCode] || t('Auth.LoginScreen.continueWithPhoneButtonText')}
            </Button.Text>
        </Button>
    );
};

export const AppleLoginButton = ({ onPress, ...props }) => {
    const theme = useTheme();
    return (
        <Button onPress={onPress} bg="$white" borderWidth={1} borderColor="$gray-200" pressStyle={{ opacity: 0.94 }} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.10)', foreground: true })} {...props} rounded>
            <Button.Icon>
                <FontAwesomeIcon icon={faApple} color={theme['$gray-900'].val} />
            </Button.Icon>
        </Button>
    );
};

export const FacebookLoginButton = ({ onPress, ...props }) => {
    const theme = useTheme();
    return (
        <Button onPress={onPress} bg="$blue-600" borderWidth={1} borderColor="$blue-800" pressStyle={{ opacity: 0.94 }} android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.20)', foreground: true })} {...props} rounded>
            <Button.Icon>
                <FontAwesomeIcon icon={faFacebook} color={theme['$blue-100'].val} />
            </Button.Icon>
        </Button>
    );
};

export const InstagramLoginButton = ({ onPress, style = {}, ...props }) => {
    const theme = useTheme();
    return (
        <LinearGradient
            colors={['#feda75', '#fa7e1e', '#d62976', '#962fbf', '#4f5bd5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[style, { width: '100%', borderRadius: 8 }]}
            {...props}
        >
            <Button onPress={onPress} bg="transparent" width="100%" pressStyle={{ opacity: 0.96 }} android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.22)', foreground: true })} rounded>
                <Button.Icon>
                    <FontAwesomeIcon icon={faInstagram} color={theme.$white.val} />
                </Button.Icon>
            </Button>
        </LinearGradient>
    );
};

export const GoogleLoginButton = ({ onPress, ...props }) => (
    <Button onPress={onPress} bg="#4285F4" pressStyle={{ opacity: 0.94 }} android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.22)', foreground: true })} {...props} rounded>
        <Button.Icon>
            <FontAwesomeIcon icon={faGoogle} color="white" />
        </Button.Icon>
    </Button>
);

