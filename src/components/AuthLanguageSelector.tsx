import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text, XStack, YStack, Stack } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../contexts/LanguageContext';

type LabelMap = Record<string, string>;

const LANGUAGE_LABELS: LabelMap = {
    ru: 'Русский',
    ky: 'Кыргызча',
    en: 'English',
};

const PREFERRED_ORDER = ['ru', 'ky', 'en'];

const AuthLanguageSelector = () => {
    const { language, languages, setLocale } = useLanguage();
    const isCyrillic = language.code === 'ru' || language.code === 'ky';
    const insets = useSafeAreaInsets();
    const [open, setOpen] = useState(false);

    const orderedLanguages = useMemo(() => {
        const byCode = Object.fromEntries(languages.map((lang) => [lang.code, lang]));
        const fromPreferred = PREFERRED_ORDER.filter((code) => byCode[code]).map((code) => ({
            ...byCode[code],
            displayName: LANGUAGE_LABELS[code] ?? byCode[code].native ?? byCode[code].name ?? code.toUpperCase(),
        }));

        const remaining = languages
            .filter((lang) => !PREFERRED_ORDER.includes(lang.code))
            .map((lang) => ({
                ...lang,
                displayName: LANGUAGE_LABELS[lang.code] ?? lang.native ?? lang.name ?? lang.code.toUpperCase(),
            }));

        return [...fromPreferred, ...remaining];
    }, [languages]);

    const current = useMemo(() => {
        return orderedLanguages.find((lang) => lang.code === language.code) ?? orderedLanguages[0];
    }, [language.code, orderedLanguages]);

    const handleSelect = (code: string) => {
        setLocale(code);
        setOpen(false);
    };

    return (
        <Stack position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="box-none" zIndex={50}>
            {open && <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />}

            <XStack justifyContent="flex-end" paddingRight={16} paddingTop={insets.top + 8} pointerEvents="box-none">
                <YStack alignItems="flex-end" pointerEvents="box-none">
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => setOpen((value) => !value)}
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 16,
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.24)',
                        }}
                    >
                        <Text fontSize={24}>{current?.emoji ?? '🇷🇺'}</Text>
                    </TouchableOpacity>

                    {open && (
                        <YStack
                            mt="$2"
                            bg="rgba(255,255,255,0.96)"
                            borderRadius={14}
                            padding="$2"
                            shadowColor="rgba(0,0,0,0.25)"
                            shadowOffset={{ width: 0, height: 8 }}
                            shadowOpacity={0.3}
                            shadowRadius={12}
                            elevation={10}
                            width={180}
                            gap="$1"
                        >
                            {orderedLanguages.map((lang) => (
                                <TouchableOpacity key={lang.code} activeOpacity={0.9} onPress={() => handleSelect(lang.code)}>
                                    <XStack
                                        alignItems="center"
                                        space="$2"
                                        px="$3"
                                        py="$2"
                                        borderRadius={10}
                                        bg={lang.code === language.code ? 'rgba(20,42,101,0.08)' : 'transparent'}
                                    >
                                        <Text fontSize={22}>{lang.emoji ?? '🏳️'}</Text>
                                        <Text color="#142A65" fontFamily={isCyrillic ? undefined : 'Rubik-Medium'} fontSize={14}>
                                            {lang.displayName}
                                        </Text>
                                    </XStack>
                                </TouchableOpacity>
                            ))}
                        </YStack>
                    )}
                </YStack>
            </XStack>
        </Stack>
    );
};

export default AuthLanguageSelector;
