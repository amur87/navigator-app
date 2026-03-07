import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBolt } from '@fortawesome/free-solid-svg-icons';
import { Button, useTheme } from 'tamagui';
import { getMaterialRipple } from '../utils/material-ripple';

const HeaderButton = ({ icon, size = 35, onPress, bg = '#D9DBE6', iconColor = '#112b66', borderWidth = 0, borderColor = 'transparent', ...props }) => {
    const theme = useTheme();

    const handlePress = function () {
        if (typeof onPress === 'function') {
            onPress();
        }
    };

    const resolvedIconColor = typeof iconColor === 'string' && iconColor.startsWith('$') ? theme[iconColor]?.val ?? '#112b66' : iconColor;

    return (
        <Button onPress={handlePress} justifyContent='center' alignItems='center' bg={bg} borderWidth={borderWidth} borderColor={borderColor} borderRadius={10} size={size} pressStyle={{ opacity: 0.88 }} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.16)', foreground: true })} {...props}>
            <Button.Icon>
                <FontAwesomeIcon icon={icon ? icon : faBolt} color={resolvedIconColor} />
            </Button.Icon>
        </Button>
    );
};

export default HeaderButton;
