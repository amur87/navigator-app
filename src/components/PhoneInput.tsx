import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Keyboard } from 'react-native';
import { countries, getEmojiFlag } from 'countries-list';
import BottomSheet, { BottomSheetView, BottomSheetFlatList, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useTheme, Text, Button, XStack, YStack, Input } from 'tamagui';
import { Portal } from '@gorhom/portal';
import { getCountryByPhoneCode, getCountryByISO2, parsePhoneNumber } from '../utils';
import useAppTheme from '../hooks/use-app-theme';
import { useLanguage } from '../contexts/LanguageContext';

function getDefaultValues(value = null, fallbackCountry = 'US') {
    if (typeof value === 'string' && value.startsWith('+')) {
        const segments = parsePhoneNumber(value);
        return {
            phoneNumber: segments.localNumber ?? '',
            ...segments,
        };
    }

    const country = getCountryByISO2(fallbackCountry);
    return {
        phoneNumber: '',
        country,
    };
}

const countryList = Object.entries(countries).map(([code, details]) => ({
    code,
    name: details.name,
    phone: details.phone[0],
    emoji: getEmojiFlag(code),
}));

const getLocalNumber = (value = '', fixedDialCode = null) => {
    if (typeof value !== 'string') {
        return '';
    }

    if (typeof fixedDialCode === 'string' && fixedDialCode.length > 0) {
        const normalizedDialCode = fixedDialCode.replace('+', '');
        const normalizedValue = value.replace(/[^\d+]/g, '');
        if (normalizedValue.startsWith(`+${normalizedDialCode}`)) {
            return normalizedValue.slice(normalizedDialCode.length + 1);
        }

        if (normalizedValue.startsWith('+')) {
            return normalizedValue.replace(/^\+\d{1,3}/, '');
        }

        return normalizedValue.replace(/[^\d]/g, '');
    }

    return value;
};

const sanitizeDigits = (value = '') => String(value).replace(/\D/g, '');
const getMaskSlotsCount = (maskPattern = '') => (maskPattern.match(/X/g) || []).length;

const formatByMask = (digits = '', maskPattern = '') => {
    if (!maskPattern) {
        return digits;
    }

    let digitIndex = 0;
    let formatted = '';

    for (let i = 0; i < maskPattern.length; i++) {
        const char = maskPattern[i];
        if (char === 'X') {
            formatted += digitIndex < digits.length ? digits[digitIndex] : '_';
            digitIndex += 1;
            continue;
        }

        formatted += char;
    }

    return formatted;
};

const getMaskInputPosition = (maskPattern = '', digitsLength = 0) => {
    if (!maskPattern) {
        return digitsLength;
    }

    let seenSlots = 0;
    for (let i = 0; i < maskPattern.length; i++) {
        if (maskPattern[i] !== 'X') {
            continue;
        }

        if (seenSlots === digitsLength) {
            return i;
        }

        seenSlots += 1;
    }

    return maskPattern.length;
};

const PhoneInput = ({
    value,
    onChange,
    bg,
    width = '100%',
    defaultCountryCode = 'US',
    fixedDialCode = null,
    size = '$5',
    wrapperProps = {},
    maxDigits = null,
    maskPattern = null,
    inputPlaceholder = null,
    inputColor = '$textPrimary',
    inputFontSize = 16,
    inputFontFamily = undefined,
    inputFontWeight = undefined,
    dialCodeColor = '$textPrimary',
    borderRadius = '$5',
    placeholderTextColor = undefined,
    containerBorderColor = '$borderColorWithShadow',
    containerBorderWidth = 1,
    focusBorderColor = '#142A65',
    focusBorderWidth = 2,
}) => {
    const defaultValue = getDefaultValues(value, defaultCountryCode);
    const theme = useTheme();
    const { t } = useLanguage();
    const { isDarkMode } = useAppTheme();
    const normalizedFixedDialCode = typeof fixedDialCode === 'string' ? fixedDialCode.replace('+', '') : null;
    const isCountrySelectionDisabled = typeof normalizedFixedDialCode === 'string' && normalizedFixedDialCode.length > 0;
    const fixedCountry = isCountrySelectionDisabled ? getCountryByPhoneCode(normalizedFixedDialCode) ?? defaultValue.country : null;
    const [selectedCountry, setSelectedCountry] = useState(defaultValue.country);
    const [phoneNumber, setPhoneNumber] = useState(sanitizeDigits(getLocalNumber(defaultValue.phoneNumber, normalizedFixedDialCode)));
    const [searchTerm, setSearchTerm] = useState('');
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [isFocused, setIsFocused] = useState(false);
    const bottomSheetRef = useRef<BottomSheet>(null);
    const phoneInputRef = useRef(null);
    const searchInputRef = useRef(null);
    const snapPoints = useMemo(() => ['50%', '75%'], []);
    const backgroundColor = bg ? bg : isDarkMode ? '$surface' : '$gray-200';
    const maxAllowedDigits = typeof maxDigits === 'number' && maxDigits > 0 ? maxDigits : null;
    const maskSlotsCount = maskPattern ? getMaskSlotsCount(maskPattern) : null;
    const effectiveMaxDigits = maxAllowedDigits ?? maskSlotsCount;
    const maskedValue = maskPattern ? formatByMask(phoneNumber, maskPattern) : phoneNumber;
    const firstEditablePosition = maskPattern ? Math.max(maskPattern.indexOf('X'), 0) : 0;
    const displayValue = maskedValue;
    const resolvedBorderColor = isFocused ? focusBorderColor : containerBorderColor;
    const resolvedBorderWidth = isFocused ? focusBorderWidth : containerBorderWidth;

    const filteredCountries = useMemo(() => {
        return countryList.filter(({ name, code, phone }) => {
            const lowerSearch = searchTerm.toLowerCase();
            return name.toLowerCase().includes(lowerSearch) || code.toLowerCase().includes(lowerSearch) || String(phone).includes(lowerSearch);
        });
    }, [searchTerm]);

    const openBottomSheet = () => {
        if (isCountrySelectionDisabled) {
            return;
        }

        phoneInputRef.current?.blur();
        bottomSheetRef.current?.collapse();
        searchInputRef.current?.focus();
    };

    const closeBottomSheet = () => {
        Keyboard.dismiss();
        bottomSheetRef.current?.close();
        phoneInputRef.current?.focus();
    };

    const handleInputFocus = () => {
        setIsFocused(true);
        bottomSheetRef.current?.close();
        const nextPosition = maskPattern ? getMaskInputPosition(maskPattern, phoneNumber.length) : Math.max(firstEditablePosition, displayValue.length);
        setSelection({ start: nextPosition, end: nextPosition });
    };

    const handleInputBlur = () => {
        setIsFocused(false);
    };

    const handleCountrySelect = (country: { code: string; phone: string }) => {
        setSelectedCountry(country);
        closeBottomSheet();
    };

    useEffect(() => {
        if (onChange) {
            if (isCountrySelectionDisabled) {
                const combinedValue = `+${normalizedFixedDialCode}${phoneNumber}`;
                onChange(combinedValue, phoneNumber, fixedCountry);
                return;
            }

            const combinedValue = `+${selectedCountry.phone}${phoneNumber}`;
            onChange(combinedValue, phoneNumber, selectedCountry);
        }
    }, [selectedCountry, phoneNumber, onChange, isCountrySelectionDisabled, normalizedFixedDialCode, fixedCountry]);

    useEffect(() => {
        if (phoneNumber.length === 0) {
            setSelection({ start: firstEditablePosition, end: firstEditablePosition });
        }
    }, [phoneNumber, firstEditablePosition]);

    const handlePhoneNumberChange = (text) => {
        const nextDigits = sanitizeDigits(text);
        let normalizedDigits = effectiveMaxDigits ? nextDigits.slice(0, effectiveMaxDigits) : nextDigits;

        // If user deletes a mask separator (space, dash, bracket), remove the previous digit as expected.
        if (maskPattern && normalizedDigits === phoneNumber && phoneNumber.length > 0) {
            normalizedDigits = phoneNumber.slice(0, -1);
        }

        setPhoneNumber(normalizedDigits);
        if (maskPattern) {
            const nextPosition = getMaskInputPosition(maskPattern, normalizedDigits.length);
            setSelection({ start: nextPosition, end: nextPosition });
        }
    };

    const placeholder = inputPlaceholder ?? (maskPattern ? maskPattern.replace(/X/g, '_') : t('PhoneInput.enterPhoneNumberPlaceholder'));
    const computedPlaceholderTextColor = placeholderTextColor ?? (isDarkMode ? '$gray-700' : '$gray-400');

    return (
        <YStack space='$4' {...wrapperProps}>
            <XStack width={width} position='relative' paddingHorizontal={0} shadowOpacity={0} shadowRadius={0} borderWidth={resolvedBorderWidth} borderColor={resolvedBorderColor} borderRadius={borderRadius} bg={backgroundColor}>
                {isCountrySelectionDisabled ? (
                    <XStack position='absolute' left={14} top={0} bottom={0} alignItems='center' space='$2' pointerEvents='none' zIndex={2}>
                        <Text fontSize={size}>{getEmojiFlag(fixedCountry?.code || 'KG')}</Text>
                        <Text fontSize={size} color={dialCodeColor} fontFamily={inputFontFamily} fontWeight={inputFontWeight}>
                            +{normalizedFixedDialCode}
                        </Text>
                    </XStack>
                ) : null}

                {!isCountrySelectionDisabled ? (
                    <Button size={size} onPress={openBottomSheet} bg={backgroundColor} borderWidth={0} width={105} maxWidth={105} borderRadius={borderRadius}>
                        <XStack alignItems='center' space='$2'>
                            <Text fontSize={size}>{getEmojiFlag(selectedCountry.code)}</Text>
                            <Text fontSize={size} color={dialCodeColor} fontWeight={inputFontWeight}>
                                +{selectedCountry.phone}
                            </Text>
                        </XStack>
                    </Button>
                ) : null}
                <Input
                    size={size}
                    ref={phoneInputRef}
                    flex={1}
                    placeholder={placeholder}
                    keyboardType='phone-pad'
                    value={displayValue}
                    onChangeText={handlePhoneNumberChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    bg={backgroundColor}
                    color={inputColor}
                    fontSize={inputFontSize}
                    fontFamily={inputFontFamily}
                    fontWeight={inputFontWeight}
                    borderRadius={borderRadius}
                    borderTopRightRadius={borderRadius}
                    borderBottomRightRadius={borderRadius}
                    borderTopLeftRadius={borderRadius}
                    borderBottomLeftRadius={borderRadius}
                    paddingLeft={isCountrySelectionDisabled ? 90 : undefined}
                    overflow='hidden'
                    placeholderTextColor={computedPlaceholderTextColor}
                    selection={selection}
                />
            </XStack>

            {!isCountrySelectionDisabled && (
                <Portal hostName='MainPortal'>
                    <BottomSheet
                        ref={bottomSheetRef}
                        index={-1}
                        snapPoints={snapPoints}
                        keyboardBehavior='extend'
                        keyboardBlurBehavior='none'
                        enableDynamicSizing={false}
                        enablePanDownToClose={true}
                        enableOverDrag={false}
                        style={{ flex: 1, width: '100%' }}
                        backgroundStyle={{ backgroundColor: theme.background.val, borderWidth: 1, borderColor: theme.borderColorWithShadow.val }}
                        handleIndicatorStyle={{ backgroundColor: theme.secondary.val }}
                    >
                        <YStack px='$2'>
                            <BottomSheetTextInput
                                ref={searchInputRef}
                                placeholder={t('PhoneInput.searchCountryPlaceholder')}
                                onChangeText={setSearchTerm}
                                autoCapitalize={false}
                                autoComplete='off'
                                autoCorrect={false}
                                style={{
                                    color: theme.textPrimary.val,
                                    backgroundColor: theme.surface.val,
                                    borderWidth: 1,
                                    borderColor: theme.borderColor.val,
                                    padding: 14,
                                    borderRadius: 12,
                                    fontSize: 13,
                                    marginBottom: 10,
                                }}
                            />
                        </YStack>
                        <BottomSheetView
                            style={{ flex: 1, backgroundColor: theme.background.val, paddingHorizontal: 8, borderColor: theme.borderColorWithShadow.val, borderWidth: 1, borderTopWidth: 0 }}
                        >
                            <BottomSheetFlatList
                                data={filteredCountries}
                                keyExtractor={(item) => item.code}
                                renderItem={({ item }) => (
                                    <Button
                                        size='$4'
                                        onPress={() => handleCountrySelect({ code: item.code, phone: item.phone })}
                                        bg='$surface'
                                        justifyContent='space-between'
                                        space='$2'
                                        mb='$2'
                                        px='$3'
                                        hoverStyle={{
                                            scale: 0.9,
                                            opacity: 0.5,
                                        }}
                                        pressStyle={{
                                            scale: 0.9,
                                            opacity: 0.5,
                                        }}
                                    >
                                        <XStack alignItems='center' space='$2'>
                                            <Text>{item.emoji}</Text>
                                            <Text>{item.name}</Text>
                                        </XStack>
                                        <Text>+{item.phone}</Text>
                                    </Button>
                                )}
                            />
                        </BottomSheetView>
                    </BottomSheet>
                </Portal>
            )}
        </YStack>
    );
};

export default PhoneInput;
