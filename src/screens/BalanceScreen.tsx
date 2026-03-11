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
    danger: '#FF3B30',
    navy: '#142A65',
    white: '#FFFFFF',
};

type Transaction = {
    id: string;
    date: string;
    description: string;
    amount: string;
    type: 'income' | 'expense' | 'bonus' | 'penalty';
};

const MOCK_TRANSACTIONS: Transaction[] = [
    { id: '1', date: '07.03.2026', description: 'Доставка #12847', amount: '+320', type: 'income' },
    { id: '2', date: '07.03.2026', description: 'Доставка #12845', amount: '+280', type: 'income' },
    { id: '3', date: '06.03.2026', description: 'Штраф за опоздание', amount: '-150', type: 'penalty' },
    { id: '4', date: '06.03.2026', description: 'Доставка #12840', amount: '+410', type: 'income' },
    { id: '5', date: '06.03.2026', description: 'Бонус за 10 доставок', amount: '+500', type: 'bonus' },
    { id: '6', date: '05.03.2026', description: 'Доставка #12835', amount: '+350', type: 'income' },
    { id: '7', date: '05.03.2026', description: 'Комиссия платформы', amount: '-85', type: 'expense' },
    { id: '8', date: '05.03.2026', description: 'Доставка #12830', amount: '+290', type: 'income' },
    { id: '9', date: '04.03.2026', description: 'Доставка #12825', amount: '+380', type: 'income' },
    { id: '10', date: '04.03.2026', description: 'Выплата на карту', amount: '-3 200', type: 'expense' },
];

const getTypeLabel = (type: Transaction['type']) => {
    switch (type) {
        case 'income': return 'Зачисление';
        case 'expense': return 'Списание';
        case 'bonus': return 'Бонус';
        case 'penalty': return 'Штраф';
    }
};

const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
        case 'income':
        case 'bonus':
            return COLORS.success;
        case 'expense':
        case 'penalty':
            return COLORS.danger;
    }
};

const groupByDate = (transactions: Transaction[]) => {
    const groups: { date: string; items: Transaction[] }[] = [];
    for (const t of transactions) {
        const last = groups[groups.length - 1];
        if (last && last.date === t.date) {
            last.items.push(t);
        } else {
            groups.push({ date: t.date, items: [t] });
        }
    }
    return groups;
};

const BalanceScreen = () => {
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

    const balance = getDriverValue('balance', '') || getDriverValue('pending_payout', '') || '3 200';
    const groups = groupByDate(MOCK_TRANSACTIONS);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Баланс" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingTop: topInset + 48 + 12 }]}
            >
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>Текущий баланс</Text>
                    <Text style={styles.balanceValue}>{balance} c</Text>
                </View>

                {groups.map((group) => (
                    <View key={group.date}>
                        <Text style={styles.dateHeader}>{group.date}</Text>
                        <View style={styles.section}>
                            {group.items.map((item, idx) => {
                                const isLast = idx === group.items.length - 1;
                                const isPositive = item.amount.startsWith('+');
                                return (
                                    <View key={item.id} style={[styles.row, isLast && styles.rowLast]}>
                                        <View style={[styles.indicator, { backgroundColor: getTypeColor(item.type) }]} />
                                        <View style={styles.rowContent}>
                                            <Text style={styles.rowDesc}>{item.description}</Text>
                                            <Text style={[styles.rowType, { color: getTypeColor(item.type) }]}>
                                                {getTypeLabel(item.type)}
                                            </Text>
                                        </View>
                                        <Text style={[styles.rowAmount, { color: isPositive ? COLORS.success : COLORS.danger }]}>
                                            {item.amount} c
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                ))}

                {MOCK_TRANSACTIONS.length === 0 && (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>Нет операций</Text>
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
    balanceCard: {
        backgroundColor: COLORS.navy,
        borderRadius: 18,
        padding: 24,
        alignItems: 'center',
    },
    balanceLabel: {
        fontSize: 13,
        fontFamily: FONTS.medium,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
    },
    balanceValue: {
        fontSize: 32,
        fontFamily: FONTS.black,
        color: COLORS.white,
    },
    dateHeader: {
        fontSize: 13,
        fontFamily: FONTS.bold,
        color: COLORS.muted,
        marginLeft: 4,
        marginTop: 4,
        marginBottom: 4,
    },
    section: {
        backgroundColor: COLORS.cardBg,
        borderRadius: 14,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    rowLast: { borderBottomWidth: 0 },
    indicator: {
        width: 4,
        height: 32,
        borderRadius: 2,
        marginRight: 12,
    },
    rowContent: {
        flex: 1,
    },
    rowDesc: {
        fontSize: 14,
        fontFamily: FONTS.bold,
        color: COLORS.text,
    },
    rowType: {
        fontSize: 11,
        fontFamily: FONTS.medium,
        marginTop: 2,
    },
    rowAmount: {
        fontSize: 16,
        fontFamily: FONTS.black,
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

export default BalanceScreen;
