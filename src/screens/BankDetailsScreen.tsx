import React, { useState, useCallback } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet, StatusBar } from 'react-native';
import { Spinner } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast, ToastPosition } from '@backpackapp-io/react-native-toast';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import GlassHeader from '../components/GlassHeader';

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
};

const COLORS = {
    screenBg: '#F2F2F7',
    cardBg: '#FFFFFF',
    accent: '#991A4E',
    text: '#111111',
    muted: '#8E8E93',
    white: '#FFFFFF',
    inputBorder: '#D1D1D6',
};

const BankDetailsScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { driver, updateDriver } = useAuth();
    const { t } = useLanguage();

    const getMeta = (key: string, fallback = '') => {
        if (!driver) return fallback;
        const meta = typeof (driver as any).getAttribute === 'function'
            ? (driver as any).getAttribute('meta') ?? {}
            : (driver as any)?.meta ?? {};
        return meta?.[key] ?? fallback;
    };

    const [bankName, setBankName] = useState(getMeta('bank_name'));
    const [accountNumber, setAccountNumber] = useState(getMeta('bank_account'));
    const [bik, setBik] = useState(getMeta('bank_bik'));
    const [isSaving, setIsSaving] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const hasChanges = bankName !== getMeta('bank_name') ||
        accountNumber !== getMeta('bank_account') ||
        bik !== getMeta('bank_bik');

    const handleSave = useCallback(async () => {
        if (!hasChanges) return;
        setIsSaving(true);
        try {
            const currentMeta = typeof (driver as any).getAttribute === 'function'
                ? (driver as any).getAttribute('meta') ?? {}
                : (driver as any)?.meta ?? {};
            await updateDriver({
                meta: {
                    ...currentMeta,
                    bank_name: bankName.trim(),
                    bank_account: accountNumber.trim(),
                    bank_bik: bik.trim(),
                },
            });
            toast.success('Реквизиты сохранены', { position: ToastPosition.BOTTOM });
            navigation.goBack();
        } catch (error: any) {
            toast.error(error?.message ?? 'Ошибка сохранения');
        } finally {
            setIsSaving(false);
        }
    }, [hasChanges, bankName, accountNumber, bik, driver, updateDriver, navigation]);

    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Реквизиты банка" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingTop: topInset + 48 + 16 }]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.card}>
                    <Text style={styles.sectionHint}>
                        Укажите данные для получения выплат
                    </Text>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Наименование банка</Text>
                        <TextInput
                            style={[
                                styles.input,
                                focusedField === 'bankName' && styles.inputFocused,
                            ]}
                            value={bankName}
                            onChangeText={setBankName}
                            placeholder="Например, Оптима Банк"
                            placeholderTextColor={COLORS.muted}
                            onFocus={() => setFocusedField('bankName')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Расчетный счет</Text>
                        <TextInput
                            style={[
                                styles.input,
                                focusedField === 'account' && styles.inputFocused,
                            ]}
                            value={accountNumber}
                            onChangeText={setAccountNumber}
                            placeholder="1234567890123456"
                            placeholderTextColor={COLORS.muted}
                            keyboardType="number-pad"
                            onFocus={() => setFocusedField('account')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>БИК</Text>
                        <TextInput
                            style={[
                                styles.input,
                                focusedField === 'bik' && styles.inputFocused,
                            ]}
                            value={bik}
                            onChangeText={setBik}
                            placeholder="123456789"
                            placeholderTextColor={COLORS.muted}
                            keyboardType="number-pad"
                            onFocus={() => setFocusedField('bik')}
                            onBlur={() => setFocusedField(null)}
                        />
                    </View>
                </View>

                <Pressable
                    onPress={handleSave}
                    disabled={!hasChanges || isSaving}
                    style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
                >
                    {isSaving ? (
                        <Spinner color={COLORS.white} />
                    ) : (
                        <Text style={styles.saveButtonText}>Сохранить</Text>
                    )}
                </Pressable>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.screenBg },
    scroll: {
        paddingHorizontal: 12,
        paddingBottom: 96,
        gap: 12,
    },
    card: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 14,
        padding: 16,
    },
    sectionHint: {
        fontSize: 13,
        fontFamily: FONTS.regular,
        color: COLORS.muted,
        marginBottom: 20,
    },
    fieldGroup: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: COLORS.muted,
        marginBottom: 6,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        fontFamily: FONTS.regular,
        color: COLORS.text,
        backgroundColor: COLORS.white,
    },
    inputFocused: {
        borderColor: COLORS.accent,
        borderWidth: 1.5,
    },
    saveButton: {
        height: 50,
        borderRadius: 14,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        color: COLORS.white,
    },
});

export default BankDetailsScreen;
