import { useEffect, useMemo, useRef } from 'react';
import { useColorScheme } from 'react-native';
import useStorage, { getString, setString } from './use-storage';
import { navigatorConfig, getTheme } from '../utils';
import { capitalize } from '../utils/format';

export const USER_COLOR_SCHEME_KEY = 'user_color_scheme';
export const APP_THEME_KEY = 'app_theme';
export const schemes = ['light', 'dark'] as const;

export default function useAppTheme() {
    const baseTheme = capitalize(navigatorConfig('theme')); // e.g., 'Indigo'
    const systemColorScheme = useColorScheme(); // 'light' or 'dark';
    const [userColorScheme, setUserColorScheme] = useStorage<string>(USER_COLOR_SCHEME_KEY, systemColorScheme || 'light');
    const [appTheme, setAppTheme] = useStorage<string>(APP_THEME_KEY, `${userColorScheme}${baseTheme}`);
    const initializedRef = useRef(false);

    const isDarkMode = userColorScheme === 'dark';
    const isLightMode = userColorScheme === 'light';

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const computedTheme = `${userColorScheme}${baseTheme}`;
        const validThemes = schemes.map((scheme) => `${scheme}${baseTheme}`);

        // Synchronously check persistent storage and migrate legacy values (e.g. "courier").
        const storedTheme = getString(APP_THEME_KEY);
        if (!storedTheme || !validThemes.includes(storedTheme)) {
            setString(APP_THEME_KEY, computedTheme);
            setAppTheme(computedTheme);
        }
    }, [userColorScheme, baseTheme, setAppTheme]);

    const changeScheme = (newScheme: string) => {
        const newTheme = `${newScheme}${baseTheme}`;
        setUserColorScheme(newScheme);
        setAppTheme(newTheme);
    };

    const themeContext = useMemo(
        () => ({
            appTheme,
            userColorScheme,
            changeScheme,
            schemes,
            isDarkMode,
            isLightMode,
            textPrimary: getTheme('textPrimary'),
            textSecondary: getTheme('textSecondary'),
            primary: getTheme('primary'),
            secondary: getTheme('secondary'),
        }),
        [appTheme, userColorScheme, changeScheme, isDarkMode, isLightMode]
    );

    return themeContext;
}
