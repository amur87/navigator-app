import React from 'react';
import { View, Text, ScrollView, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import GlassHeader from '../components/GlassHeader';

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
    black: 'Rubik-Black',
};

const COLORS = {
    screenBg: '#F2F2F7',
    cardBg: '#FFFFFF',
    text: '#111111',
    muted: '#8E8E93',
    border: 'rgba(0,0,0,0.06)',
    success: '#34C759',
};

const MOCK_PAYOUTS = [
    { id: '1', date: '07.03.2026', amount: '3 200', status: 'Выплачено' },
    { id: '2', date: '28.02.2026', amount: '4 500', status: 'Выплачено' },
    { id: '3', date: '14.02.2026', amount: '2 800', status: 'Выплачено' },
    { id: '4', date: '31.01.2026', amount: '5 100', status: 'Выплачено' },
    { id: '5', date: '15.01.2026', amount: '3 750', status: 'Выплачено' },
    { id: '6', date: '31.12.2025', amount: '4 200', status: 'Выплачено' },
];

const PayoutsScreen = () => {
    const insets = useSafeAreaInsets();
    const { driver } = useAuth();
    const topInset = Math.max(insets.top, 0);

    const getDriverValue = (key: string, fallback = '') => {
        if (!driver) return fallback;
        if (typeof (driver as any).getAttribute === 'function') {
            return (driver as any).getAttribute(key) ?? fallback;
        }
        return (driver as any)?.[key] ?? fallback;
    };

    const totalEarnings = getDriverValue('total_earnings', '') || getDriverValue('earnings_total', '') || '12 490';
    const pendingPayout = getDriverValue('pending_payout', '') || getDriverValue('payout_amount', '') || '3 200';

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Выплаты" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingTop: topInset + 48 + 12 }]}
            >
                <View style={styles.summaryRow}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>Всего заработано</Text>
                        <Text style={styles.summaryValue}>{totalEarnings} c</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryLabel}>К выплате</Text>
                        <Text style={[styles.summaryValue, styles.summaryValueGreen]}>{pendingPayout} c</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    {MOCK_PAYOUTS.map((item, index) => {
                        const isLast = index === MOCK_PAYOUTS.length - 1;
                        return (
                            <View key={item.id} style={[styles.row, isLast && styles.rowLast]}>
                                <View style={styles.rowLeft}>
                                    <Text style={styles.rowDate}>{item.date}</Text>
                                    <Text style={styles.rowStatus}>{item.status}</Text>
                                </View>
                                <Text style={styles.rowAmount}>{item.amount} c</Text>
                            </View>
                        );
                    })}
                </View>

                {MOCK_PAYOUTS.length === 0 && (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>Нет выплат</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.screenBg },
    scroll: {
        paddingHorizontal: 12,
        paddingBottom: 96,
        gap: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        gap: 8,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: COLORS.cardBg,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 11,
        fontFamily: FONTS.medium,
        color: COLORS.muted,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: 20,
        fontFamily: FONTS.black,
        color: COLORS.text,
    },
    summaryValueGreen: {
        color: COLORS.success,
    },
    section: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 14,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    rowLast: { borderBottomWidth: 0 },
    rowLeft: { flex: 1 },
    rowDate: {
        fontSize: 15,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    rowStatus: {
        fontSize: 12,
        fontFamily: FONTS.medium,
        color: COLORS.success,
        marginTop: 2,
    },
    rowAmount: {
        fontSize: 17,
        fontFamily: FONTS.black,
        color: COLORS.text,
    },
    emptyWrap: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontFamily: FONTS.medium,
        color: COLORS.muted,
    },
});

export default PayoutsScreen;
