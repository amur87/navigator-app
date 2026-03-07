import { config as baseConfig } from '@tamagui/config/v3';
import { createFont, createTamagui, createTheme, createTokens } from 'tamagui';
import { config, parseConfigObjectString, flattenTailwindCssColorsObject } from './src/utils/tamagui';

const customColors = parseConfigObjectString(config('CUSTOM_COLORS', ''));
const customColorsDark = parseConfigObjectString(config('CUSTOM_COLORS_DARK', ''));
const customColorsLight = parseConfigObjectString(config('CUSTOM_COLORS_LIGHT', ''));

const globalColors = {
    transparent: 'rgba(0,0,0,0)',
    white: '#FFFFFF',
    black: '#000000',
};

// Full Tailwind CSS Color Palette
const colors = {
    gray: {
        50: '#f9fafb',
        100: '#f3f4f6',
        200: '#e5e7eb',
        300: '#d1d5db',
        400: '#9ca3af',
        500: '#6b7280',
        600: '#4b5563',
        700: '#374151',
        800: '#1f2937',
        900: '#111827',
    },
    red: {
        50: '#fef2f2',
        100: '#fee2e2',
        200: '#fecaca',
        300: '#fca5a5',
        400: '#f87171',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
        900: '#7f1d1d',
    },
    blue: {
        50: '#eff6ff',
        100: '#dbeafe',
        200: '#bfdbfe',
        300: '#93c5fd',
        400: '#60a5fa',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
        800: '#1e40af',
        900: '#1e3a8a',
    },
    green: {
        50: '#f0fdf4',
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
    },
    yellow: {
        50: '#fefce8',
        100: '#fef9c3',
        200: '#fef08a',
        300: '#fde047',
        400: '#facc15',
        500: '#eab308',
        600: '#ca8a04',
        700: '#a16207',
        800: '#854d0e',
        900: '#713f12',
    },
    orange: {
        50: '#fff7ed',
        100: '#ffedd5',
        200: '#fed7aa',
        300: '#fdba74',
        400: '#fb923c',
        500: '#f97316',
        600: '#ea580c',
        700: '#c2410c',
        800: '#9a3412',
        900: '#7c2d12',
    },
    indigo: {
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#6366f1',
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
    },
    purple: {
        50: '#f5f3ff',
        100: '#ede9fe',
        200: '#ddd6fe',
        300: '#c4b5fd',
        400: '#a78bfa',
        500: '#8b5cf6',
        600: '#7c3aed',
        700: '#6d28d9',
        800: '#5b21b6',
        900: '#4c1d95',
    },
    pink: {
        50: '#fdf2f8',
        100: '#fce7f3',
        200: '#fbcfe8',
        300: '#f9a8d4',
        400: '#f472b6',
        500: '#ec4899',
        600: '#db2777',
        700: '#be185d',
        800: '#9d174d',
        900: '#831843',
    },
};

// Define Light and Dark Bases Using Tailwind Colors
const lightBase = {
    ...globalColors,
    ...customColors,
    ...customColorsLight,
    background: '#F5F5F5',
    surface: '#FFFFFF',
    subsurface: '#F0F0F0',
    color: '#1F1F1F',
    tabIconBlur: '#8C8C8C',
    textPrimary: '#1F1F1F',
    textSecondary: '#5C5C5C',
    textPlaceholder: '#8C8C8C',
    primary: '#FFCC00',
    primaryBorder: '#E6B800',
    primaryText: '#1F1F1F',
    secondary: '#EFEFEF',
    secondaryBorder: '#D8D8D8',
    borderColor: '#E6E6E6',
    borderColorWithShadow: '#DADADA',
    shadowColor: colors.gray[900],
    borderActive: '#FFCC00',
    default: colors.gray[600],
    success: colors.green[700],
    error: colors.red[600],
    warning: colors.yellow[600],
    info: '#FFCC00',
    defaultBorder: colors.gray[700],
    successBorder: colors.green[700],
    errorBorder: colors.red[700],
    warningBorder: colors.yellow[700],
    infoBorder: '#E6B800',
    defaultText: colors.gray[100],
    successText: colors.green[100],
    errorText: colors.red[100],
    warningText: colors.yellow[100],
    infoText: '#1F1F1F',
    ...flattenTailwindCssColorsObject(colors),
};

const darkBase = {
    ...globalColors,
    ...customColors,
    ...customColorsDark,
    background: '#1F1F1F',
    surface: '#2A2A2A',
    subsurface: '#333333',
    color: '#F5F5F5',
    tabIconBlur: '#8E8E8E',
    textPrimary: '#F5F5F5',
    textSecondary: '#B8B8B8',
    textPlaceholder: '#8E8E8E',
    primary: '#FFCC00',
    primaryBorder: '#E6B800',
    primaryText: '#1F1F1F',
    secondary: '#363636',
    secondaryBorder: '#4A4A4A',
    borderColor: '#3A3A3A',
    borderColorWithShadow: '#333333',
    shadowColor: colors.gray[900],
    borderActive: '#FFCC00',
    default: colors.gray[800],
    success: colors.green[900],
    error: colors.red[900],
    warning: colors.yellow[900],
    info: '#FFCC00',
    defaultBorder: colors.gray[600],
    successBorder: colors.green[600],
    errorBorder: colors.red[600],
    warningBorder: colors.yellow[600],
    infoBorder: '#E6B800',
    defaultText: colors.gray[100],
    successText: colors.green[100],
    errorText: colors.red[100],
    warningText: colors.yellow[100],
    infoText: '#1F1F1F',
    ...flattenTailwindCssColorsObject(colors),
};

// Define Themes Using Light and Dark Bases
export const themes = {
    // Light mode themes
    lightBlue: createTheme({
        ...lightBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),
    lightRed: createTheme({
        ...lightBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),
    lightGreen: createTheme({
        ...lightBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),
    lightIndigo: createTheme({
        ...lightBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),
    lightOrange: createTheme({
        ...lightBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),

    // Dark mode themes
    darkBlue: createTheme({
        ...darkBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),
    darkRed: createTheme({
        ...darkBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),
    darkGreen: createTheme({
        ...darkBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),
    darkIndigo: createTheme({
        ...darkBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),
    darkOrange: createTheme({
        ...darkBase,
        primary: '#FFCC00',
        primaryBorder: '#E6B800',
        primaryText: '#1F1F1F',
    }),

    // Courier app theme (post-auth screens)
    courier: createTheme({
        ...darkBase,
        background: '#142A65',
        surface: '#1c3476',
        subsurface: '#243e84',
        color: '#ffffff',
        tabIconBlur: '#b8c4e6',
        textPrimary: '#ffffff',
        textSecondary: '#d6def3',
        textPlaceholder: '#b8c4e6',
        primary: '#142A65',
        primaryBorder: '#142A65',
        primaryText: '#ffffff',
        secondary: '#213b7d',
        secondaryBorder: '#2d4a95',
        borderColor: '#2d4a95',
        borderColorWithShadow: '#2d4a95',
        shadowColor: '#142A65',
        borderActive: '#142A65',
        successBorder: '#ffffff',
    }),
};

const tokens = createTokens({
    ...baseConfig.tokens,
    color: {
        ...globalColors,
        ...flattenTailwindCssColorsObject(colors),
    },
});

const rubikFont = createFont({
    family: 'Rubik-Regular',
    size: baseConfig.fonts.body.size,
    lineHeight: baseConfig.fonts.body.lineHeight,
    weight: {
        1: '400',
        2: '400',
        3: '400',
        4: '400',
        5: '500',
        6: '500',
        7: '700',
        8: '700',
        9: '900',
        10: '900',
    },
    letterSpacing: baseConfig.fonts.body.letterSpacing,
    face: {
        400: { normal: 'Rubik-Regular' },
        500: { normal: 'Rubik-Medium' },
        700: { normal: 'Rubik-Bold' },
        900: { normal: 'Rubik-Black' },
    },
});

const appConfig = createTamagui({
    ...baseConfig,
    fonts: {
        ...baseConfig.fonts,
        body: rubikFont,
        heading: rubikFont,
    },
    defaultFont: 'body',
    themes,
    tokens,
});

export type AppConfig = typeof appConfig;

declare module 'tamagui' {
    interface TamaguiCustomConfig extends AppConfig {}
}

export default appConfig;
