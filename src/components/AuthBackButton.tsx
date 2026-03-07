import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, YStack } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { getMaterialRipple } from '../utils/material-ripple';

const AuthBackButton = ({ onPress }: { onPress?: () => void }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const handlePress = () => {
        if (typeof onPress === 'function') {
            onPress();
            return;
        }
        if (navigation?.canGoBack?.()) {
            navigation.goBack();
        }
    };

    return (
        <YStack position='absolute' top={insets.top + 10} left={16} zIndex={20}>
            <Button onPress={handlePress} width={44} height={44} borderRadius={10} bg='#D9DBE6' borderWidth={0} justifyContent='center' alignItems='center' pressStyle={{ opacity: 0.9 }} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.16)', foreground: true })}>
                <Button.Icon>
                    <FontAwesomeIcon icon={faArrowLeft} color='#112b66' />
                </Button.Icon>
            </Button>
        </YStack>
    );
};

export default AuthBackButton;
