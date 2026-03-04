import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { getLangNameFromCode } from 'language-name-map';
import { navigatorConfig } from '../utils';
import { getAvailableLocales } from '../utils/localize';
import localeEmoji from 'locale-emoji';
import useStorage from '../hooks/use-storage';
import I18n from 'react-native-i18n';
import * as RNLocalize from 'react-native-localize';

I18n.fallbacks = true;
I18n.translations = {
    ...getAvailableLocales(),
};

const getDefaultSystemLocale = () => {
    const availableLocales = Object.keys(I18n.translations);
    const appFallbackLocale = navigatorConfig('defaultLocale', 'en');
    const deviceLocales = RNLocalize.getLocales();

    for (const locale of deviceLocales) {
        const normalizedLanguageCode = String(locale.languageCode || '').toLowerCase();
        if (availableLocales.includes(normalizedLanguageCode)) {
            return normalizedLanguageCode;
        }

        const normalizedLanguageTag = String(locale.languageTag || '').toLowerCase();
        if (availableLocales.includes(normalizedLanguageTag)) {
            return normalizedLanguageTag;
        }
    }

    return availableLocales.includes(appFallbackLocale) ? appFallbackLocale : 'en';
};

interface LangInfo {
    code: string;
    name?: string;
    native?: string;
    emoji?: string;
}

interface LanguageContextProps {
    locale: string;
    setLocale: (locale: string) => void;
    t: (key: string, options?: Record<string, any>) => string;
    language: LangInfo;
    languages: LangInfo[];
}

const LanguageContext = createContext<LanguageContextProps>({
    locale: 'en',
    setLocale: () => {},
    t: () => '',
    language: { code: 'en' },
    languages: [],
});

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
    const systemLocale = getDefaultSystemLocale();
    const [locale, setLocaleState] = useStorage<string>('_locale', systemLocale);

    const languages = Object.keys(I18n.translations).map((code) => {
        return { code, ...getLangNameFromCode(code), emoji: localeEmoji(code) };
    });

    const language = useMemo(() => {
        return { code: locale, ...getLangNameFromCode(locale), emoji: localeEmoji(locale) };
    }, [locale]);

    // Set locale synchronously on every render so t() always uses the correct locale,
    // including on the initial render when the stored locale is loaded from MMKV.
    I18n.locale = locale;

    const setLocale = useCallback(
        (newLocale: string) => {
            I18n.locale = newLocale;
            setLocaleState(newLocale);
        },
        [setLocaleState]
    );

    const t = useCallback((key: string, options?: Record<string, any>) => I18n.t(key, options), [locale]);

    return <LanguageContext.Provider value={{ locale, setLocale, t, language, languages }}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
    return useContext(LanguageContext);
};
