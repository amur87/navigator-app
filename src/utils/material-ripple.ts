import { Platform } from 'react-native';

const DEFAULT_RIPPLE = 'rgba(17,43,102,0.14)';

type RippleOptions = {
    color?: string;
    borderless?: boolean;
    foreground?: boolean;
    radius?: number;
};

export const getMaterialRipple = (options: RippleOptions = {}) => {
    if (Platform.OS !== 'android') {
        return undefined;
    }

    const {
        color = DEFAULT_RIPPLE,
        borderless = false,
        foreground = false,
        radius,
    } = options;

    return {
        color,
        borderless,
        foreground,
        radius,
    };
};

export const getMaterialPressFeedback = (options: RippleOptions = {}) => ({
    android_ripple: getMaterialRipple(options),
});
