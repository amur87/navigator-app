import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { useLocation } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { getMaterialRipple } from '../utils/material-ripple';
import { getDistance as getGeoDistance } from '../utils/location';
import {
    HISTORY_ORDER_STATUSES,
    TERMINAL_ORDER_STATUSES,
    ACTIVE_COURIER_ORDER_STATUSES,
    getCourierWorkflowStage,
    getOrderStatusLabel,
} from '../utils/order-workflow';
import GlassHeader from '../components/GlassHeader';

const COLORS = {
    background: '#F2F2F7',
    primary: '#991A4E',
    primaryLight: '#C0245E',
    navy: '#142A65',
    navyMid: '#1E3C8A',
    green: '#34C759',
    text: '#111111',
    muted: '#8E8E93',
    lightMuted: '#AEAEB2',
    border: '#E5E5EA',
    chipBg: '#F2F2F6',
};

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
    black: 'Rubik-Black',
};

const ACTIVE_OFFER_SECONDS = 15 * 60;
const cardRipple = getMaterialRipple({ color: 'rgba(17,43,102,0.10)', foreground: true });
const darkRipple = getMaterialRipple({ color: 'rgba(255,255,255,0.18)', foreground: true });

const isSdkOrder = (order: any) => typeof order?.getAttribute === 'function';
const getPayload = (order: any) => (isSdkOrder(order) ? order.getAttribute('payload') ?? {} : order?.payload ?? {});
const getOrderId = (order: any) => String(isSdkOrder(order) ? order.id ?? order.getAttribute('id') : order?.id ?? order?.uuid ?? '');
const getTracking = (order: any) =>
    String(isSdkOrder(order) ? order.getAttribute('tracking_number.tracking_number') ?? order.id : order?.tracking_number ?? order?.id)
        .replace(/^MAX-0*/i, '').trim();
const getStatus = (order: any) => String(isSdkOrder(order) ? order.getAttribute('status') : order?.status ?? '').toLowerCase();
const getCreatedAt = (order: any) => (isSdkOrder(order) ? order.getAttribute('created_at') : order?.created_at);
const getDriverAssigned = (order: any) => (isSdkOrder(order) ? order.getAttribute('driver_assigned') : order?.driver_assigned);
const getPickup = (order: any) => getPayload(order)?.pickup?.street1 ?? '-';
const getDropoff = (order: any) => getPayload(order)?.dropoff?.street1 ?? '-';
const getCoords = (order: any) => {
    const location = getPayload(order)?.pickup?.location;
    if (Array.isArray(location?.coordinates) && location.coordinates.length >= 2) {
        return { latitude: Number(location.coordinates[1]), longitude: Number(location.coordinates[0]) };
    }
    if (typeof location?.latitude === 'number' && typeof location?.longitude === 'number') {
        return { latitude: location.latitude, longitude: location.longitude };
    }
    return null;
};
const getPriceLabel = (order: any) => {
    const meta = isSdkOrder(order) ? order.getAttribute('meta') ?? {} : order?.meta ?? {};
    const value = meta?.price ?? meta?.amount ?? (isSdkOrder(order) ? order.getAttribute('cod_amount') : order?.cod_amount);
    if (!value) return '0 c';
    const numeric = Number(String(value).replace(/[^\d.]/g, ''));
    return Number.isFinite(numeric) ? `${numeric} c` : `${value}`;
};
const getDistanceLabel = (distanceMeters: number | null, order: any) => {
    if (Number.isFinite(distanceMeters as number)) {
        return `${Math.max((distanceMeters as number) / 1000, 0.1).toFixed(1)} км`;
    }
    const metaDistance = isSdkOrder(order) ? order.getAttribute('meta.distance') : order?.meta?.distance;
    return metaDistance ? `${metaDistance}` : '-';
};
const getRemainingSeconds = (order: any, now: number) => {
    const createdAt = getCreatedAt(order);
    const createdDate = createdAt ? new Date(createdAt) : null;
    if (!createdDate || Number.isNaN(createdDate.getTime())) return ACTIVE_OFFER_SECONDS;
    const expiry = new Date(createdDate.getTime() + ACTIVE_OFFER_SECONDS * 1000);
    return Math.max(0, Math.floor((expiry.getTime() - now) / 1000));
};
const formatCountdown = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const getHistoryStatusLabel = (order: any) => {
    const status = getStatus(order);
    if (status === 'completed' || status === 'order_completed') return 'Выполнен';
    if (status === 'canceled' || status === 'order_canceled') return 'Отменён';
    return 'Завершён';
};
const getHistoryStatusColor = (order: any) => {
    const status = getStatus(order);
    return (status === 'canceled' || status === 'order_canceled') ? COLORS.primary : COLORS.green;
};
const getCompletedAt = (order: any) => {
    const v = (isSdkOrder(order) ? order.getAttribute('completed_at') : order?.completed_at)
        ?? (isSdkOrder(order) ? order.getAttribute('updated_at') : order?.updated_at)
        ?? getCreatedAt(order);
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
};

// --- Cards ---

const ActiveOrderCard = React.memo(function ActiveOrderCard({
    order, distanceMeters, isAccepting, now, onOpen, onAccept,
}: {
    order: any; distanceMeters: number | null; isAccepting: boolean; now: number;
    onOpen: (o: any) => void; onAccept: (o: any) => void;
}) {
    const remaining = getRemainingSeconds(order, now);
    const dist = getDistanceLabel(distanceMeters, order);

    return (
        <Pressable style={s.card} onPress={() => onOpen(order)} android_ripple={cardRipple}>
            <View style={s.cardHeader}>
                <View style={s.cardTitleRow}>
                    <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={s.cardIcon}>
                        <Svg width={12} height={12} viewBox="0 0 24 24"><Path fill="#fff" d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z" /></Svg>
                    </LinearGradient>
                    <Text style={s.cardTracking}>#{getTracking(order)}</Text>
                </View>
                <View style={s.timerChip}>
                    <Text style={s.timerText}>{formatCountdown(remaining)}</Text>
                </View>
            </View>
            <View style={s.route}>
                <View style={s.routeStop}><View style={[s.routeDot, { backgroundColor: COLORS.navy }]}><Text style={s.routeDotText}>A</Text></View><Text style={s.routeAddr} numberOfLines={1}>{getPickup(order)}</Text></View>
                <View style={s.routeConnector} />
                <View style={s.routeStop}><View style={[s.routeDot, { backgroundColor: COLORS.primary }]}><Text style={s.routeDotText}>B</Text></View><Text style={s.routeAddr} numberOfLines={1}>{getDropoff(order)}</Text></View>
            </View>
            <View style={s.cardFooter}>
                <View style={s.chipRow}>
                    <View style={s.chip}><Text style={s.chipText}>{dist}</Text></View>
                    <View style={s.chip}><Text style={s.chipText}>{getPriceLabel(order)}</Text></View>
                </View>
                <Pressable style={s.acceptBtn} onPress={() => onAccept(order)} disabled={isAccepting} android_ripple={darkRipple}>
                    <LinearGradient colors={[COLORS.green, '#2DB84E']} style={[s.acceptGrad, isAccepting && { opacity: 0.7 }]}>
                        {isAccepting ? <ActivityIndicator color="#fff" size="small" /> : (
                            <>
                                <Svg width={14} height={14} viewBox="0 0 24 24"><Path fill="#fff" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></Svg>
                                <Text style={s.acceptText}>Принять</Text>
                            </>
                        )}
                    </LinearGradient>
                </Pressable>
            </View>
        </Pressable>
    );
});

const MyOrderCard = React.memo(function MyOrderCard({
    order, isAdvancing, onOpen, onAdvance,
}: {
    order: any; isAdvancing: boolean; onOpen: (o: any) => void; onAdvance: (o: any) => void;
}) {
    const statusLabel = getOrderStatusLabel(getStatus(order));
    const status = getStatus(order);
    const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
    const actionLabel = stage === 'accepted' ? 'Начать маршрут' : (stage === 'enroute' || stage === 'active') ? 'Обновить статус' : null;

    return (
        <View style={s.card}>
            <Pressable style={s.cardInner} onPress={() => onOpen(order)} android_ripple={cardRipple}>
                <View style={s.cardHeader}>
                    <View style={s.cardTitleRow}>
                        <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={s.cardIcon}>
                            <Svg width={12} height={12} viewBox="0 0 24 24"><Path fill="#fff" d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z" /></Svg>
                        </LinearGradient>
                        <Text style={s.cardTracking}>#{getTracking(order)}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: stage === 'enroute' ? '#E67E22' : stage === 'active' ? COLORS.primary : COLORS.navy }]}>
                        <Text style={s.statusBadgeText}>{statusLabel}</Text>
                    </View>
                </View>
                <View style={s.route}>
                    <View style={s.routeStop}><View style={[s.routeDot, { backgroundColor: COLORS.navy }]}><Text style={s.routeDotText}>A</Text></View><Text style={s.routeAddr} numberOfLines={1}>{getPickup(order)}</Text></View>
                    <View style={s.routeConnector} />
                    <View style={s.routeStop}><View style={[s.routeDot, { backgroundColor: COLORS.primary }]}><Text style={s.routeDotText}>B</Text></View><Text style={s.routeAddr} numberOfLines={1}>{getDropoff(order)}</Text></View>
                </View>
            </Pressable>
            {actionLabel ? (
                <Pressable style={s.actionBtnWrap} onPress={() => onAdvance(order)} disabled={isAdvancing} android_ripple={darkRipple}>
                    <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={s.actionBtn}>
                        {isAdvancing ? <ActivityIndicator color="#fff" size="small" /> : (
                            <>
                                <Svg width={14} height={14} viewBox="0 0 24 24"><Path fill="#fff" d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" /></Svg>
                                <Text style={s.actionBtnText}>{actionLabel}</Text>
                            </>
                        )}
                    </LinearGradient>
                </Pressable>
            ) : null}
        </View>
    );
});

const HistoryOrderCard = React.memo(function HistoryOrderCard({ order, onOpen }: { order: any; onOpen: (o: any) => void }) {
    const statusColor = getHistoryStatusColor(order);
    const completedAt = getCompletedAt(order);
    const pickupShort = getPickup(order).split(',')[0].trim();
    const dropoffShort = getDropoff(order).split(',')[0].trim();

    return (
        <Pressable style={s.histCard} onPress={() => onOpen(order)} android_ripple={cardRipple}>
            <View style={s.histLeft}>
                <View style={s.histTitleRow}>
                    <Text style={s.histTracking}>#{getTracking(order)}</Text>
                    <View style={[s.histStatusDot, { backgroundColor: statusColor }]} />
                    <Text style={[s.histStatus, { color: statusColor }]}>{getHistoryStatusLabel(order)}</Text>
                </View>
                <Text style={s.histRoute} numberOfLines={1}>{pickupShort} → {dropoffShort}</Text>
                {completedAt ? <Text style={s.histDate}>{format(completedAt, 'd MMM, HH:mm')}</Text> : null}
            </View>
            <Text style={s.histPrice}>{getPriceLabel(order)}</Text>
        </Pressable>
    );
});

function EmptyState({ type }: { type: 'active' | 'history' }) {
    return (
        <View style={s.empty}>
            <View style={[s.emptyIcon, type === 'active' ? s.emptyIconActive : s.emptyIconHistory]}>
                <Svg width={28} height={28} viewBox="0 0 24 24">
                    <Path fill={type === 'active' ? COLORS.primary : COLORS.muted} d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z" />
                </Svg>
            </View>
            <Text style={s.emptyTitle}>{type === 'active' ? 'Нет заказов' : 'История пуста'}</Text>
            <Text style={s.emptySubtitle}>{type === 'active' ? 'Новые заказы появятся здесь автоматически' : 'Завершённые заказы будут здесь'}</Text>
        </View>
    );
}

// --- Screen ---

const DriverOrderManagementScreen = () => {
    const navigation = useNavigation<any>();
    const { driver } = useAuth();
    const { location } = useLocation();
    const {
        allRecentOrders, allActiveOrders, nearbyOrders,
        reloadNearbyOrders, reloadRecentOrders, reloadActiveOrders, reloadCurrentOrders,
    } = useOrderManager();

    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
    const [advancingOrderId, setAdvancingOrderId] = useState<string | null>(null);
    const advancingRef = useRef(false);
    const [now, setNow] = useState(Date.now());
    const pagerRef = useRef<ScrollView>(null);
    const screenWidth = Dimensions.get('window').width - 24; // minus paddingHorizontal

    const onTabPress = useCallback((tab: 'active' | 'history') => {
        setActiveTab(tab);
        pagerRef.current?.scrollTo({ x: tab === 'active' ? 0 : screenWidth, animated: true });
    }, [screenWidth]);

    const onPagerScroll = useCallback((e: any) => {
        const offsetX = e.nativeEvent.contentOffset.x;
        const page = Math.round(offsetX / screenWidth);
        setActiveTab(page === 0 ? 'active' : 'history');
    }, [screenWidth]);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const refreshOrders = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                reloadNearbyOrders({}, { setLoadingFlag: false }),
                reloadRecentOrders({}, { setLoadingFlag: false }),
                reloadActiveOrders({}, { setLoadingFlag: false }),
                reloadCurrentOrders({}, { setLoadingFlag: false }),
            ]);
        } finally {
            setIsRefreshing(false);
        }
    }, [reloadActiveOrders, reloadCurrentOrders, reloadNearbyOrders, reloadRecentOrders]);

    useFocusEffect(useCallback(() => { refreshOrders(); }, [refreshOrders]));

    const driverCoords = { latitude: location?.coords?.latitude, longitude: location?.coords?.longitude };

    const activeOrders = useMemo(() => {
        return nearbyOrders
            .filter((order: any) => {
                const status = getStatus(order);
                const isAdhoc = isSdkOrder(order) ? order.getAttribute('adhoc') === true : order?.adhoc === true;
                return isAdhoc && !getDriverAssigned(order) && !TERMINAL_ORDER_STATUSES.has(status) && getRemainingSeconds(order, now) > 0;
            })
            .map((order: any) => {
                const coords = getCoords(order);
                const distanceMeters = coords && Number.isFinite(driverCoords.latitude) && Number.isFinite(driverCoords.longitude)
                    ? getGeoDistance([driverCoords.latitude, driverCoords.longitude], [coords.latitude, coords.longitude]) : null;
                return { order, distanceMeters };
            })
            .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    }, [driverCoords.latitude, driverCoords.longitude, nearbyOrders, now]);

    const historyOrders = useMemo(() => {
        const activeIds = new Set(activeOrders.map(({ order }) => getOrderId(order)));
        return allRecentOrders
            .filter((order: any) => !activeIds.has(getOrderId(order)) && HISTORY_ORDER_STATUSES.has(getStatus(order)))
            .sort((a: any, b: any) => new Date(getCreatedAt(b) ?? 0).getTime() - new Date(getCreatedAt(a) ?? 0).getTime())
            .map((order: any) => ({ order }));
    }, [activeOrders, allRecentOrders]);

    const myActiveOrders = useMemo(() => {
        return allActiveOrders
            .filter((order: any) => ACTIVE_COURIER_ORDER_STATUSES.has(getStatus(order)))
            .sort((a: any, b: any) => new Date(getCreatedAt(b) ?? 0).getTime() - new Date(getCreatedAt(a) ?? 0).getTime());
    }, [allActiveOrders]);

    const handleOpenOrder = useCallback((order: any, mode: 'active' | 'history') => {
        const payload = isSdkOrder(order) ? order.serialize() : order;
        navigation.navigate(mode === 'active' ? 'OrderModal' : 'Order', { order: payload });
    }, [navigation]);

    const handleAcceptOrder = useCallback(async (order: any) => {
        if (!driver?.id || acceptingOrderId) return;
        Alert.alert('Принять заказ', 'Заказ будет закреплён за вами.', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Принять',
                onPress: async () => {
                    setAcceptingOrderId(getOrderId(order));
                    try {
                        await order.update({ driver: driver.id });
                        try { await order.start(); } catch (e: any) {
                            if ((e?.message ?? '').toLowerCase().includes('not been dispatched')) await order.start({ skipDispatch: true });
                            else throw e;
                        }
                        await refreshOrders();
                        navigation.navigate('Order', { order: isSdkOrder(order) ? order.serialize() : order });
                    } catch (error) {
                        Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось принять заказ');
                    } finally {
                        setAcceptingOrderId(null);
                    }
                },
            },
        ]);
    }, [acceptingOrderId, driver?.id, navigation, refreshOrders]);

    const handleAdvanceOrder = useCallback(async (order: any) => {
        if (!order || advancingRef.current) return;
        advancingRef.current = true;
        setAdvancingOrderId(getOrderId(order));
        const status = getStatus(order);
        const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
        try {
            if (stage === 'accepted') {
                try { await order.start(); } catch (e: any) {
                    if (e?.message?.startsWith('Order has not been dispatched')) await order.start({ skipDispatch: true });
                    else throw e;
                }
            } else if (stage === 'enroute' || stage === 'active') {
                const activities = await order.getNextActivity();
                const list = (Array.isArray(activities) ? activities : [activities]).filter(Boolean);
                const first = list[0];
                if (!first) return;
                if (first.require_pod || list.length > 1) {
                    navigation.navigate('Order', { order: isSdkOrder(order) ? order.serialize() : order });
                    return;
                }
                await order.updateActivity({ activity: first });
            }
            reloadActiveOrders({}, { setLoadingFlag: false });
            reloadCurrentOrders({}, { setLoadingFlag: false });
        } catch {
            Alert.alert('Ошибка', 'Не удалось обновить статус.');
        } finally {
            advancingRef.current = false;
            setAdvancingOrderId(null);
        }
    }, [navigation, reloadActiveOrders, reloadCurrentOrders]);

    const insets = useSafeAreaInsets();
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={s.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Заказы" />
            <View style={[s.container, { paddingTop: topInset + 48 + 6 }]}>
                <View style={s.segWrap}>
                    <Pressable style={[s.segBtn, activeTab === 'active' && s.segBtnActive]} onPress={() => onTabPress('active')}>
                        <Text style={[s.segText, activeTab === 'active' && s.segTextActive]}>Активные</Text>
                    </Pressable>
                    <Pressable style={[s.segBtn, activeTab === 'history' && s.segBtnActive]} onPress={() => onTabPress('history')}>
                        <Text style={[s.segText, activeTab === 'history' && s.segTextActive]}>История</Text>
                    </Pressable>
                </View>

                <ScrollView
                    ref={pagerRef}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={onPagerScroll}
                    scrollEventThrottle={16}
                    style={s.pager}
                    nestedScrollEnabled
                >
                    <View style={{ width: screenWidth }}>
                        <FlatList
                            data={activeOrders}
                            keyExtractor={(item) => `a_${getOrderId(item.order)}`}
                            renderItem={({ item }) => (
                                <ActiveOrderCard
                                    order={item.order} distanceMeters={item.distanceMeters} now={now}
                                    isAccepting={acceptingOrderId === getOrderId(item.order)}
                                    onOpen={(o) => handleOpenOrder(o, 'active')} onAccept={handleAcceptOrder}
                                />
                            )}
                            ListHeaderComponent={myActiveOrders.length > 0 ? (
                                <View>
                                    <Text style={s.sectionTitle}>Мои заказы</Text>
                                    {myActiveOrders.map((order: any) => (
                                        <MyOrderCard
                                            key={`m_${getOrderId(order)}`} order={order}
                                            isAdvancing={advancingOrderId === getOrderId(order)}
                                            onOpen={(o) => handleOpenOrder(o, 'history')} onAdvance={handleAdvanceOrder}
                                        />
                                    ))}
                                    {activeOrders.length > 0 ? <Text style={s.sectionTitle}>Доступные</Text> : null}
                                </View>
                            ) : null}
                            contentContainerStyle={activeOrders.length || myActiveOrders.length ? s.listContent : s.listEmpty}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshOrders} tintColor={COLORS.primary} />}
                            ListEmptyComponent={myActiveOrders.length === 0 ? <EmptyState type="active" /> : null}
                        />
                    </View>
                    <View style={{ width: screenWidth }}>
                        <FlatList
                            data={historyOrders}
                            keyExtractor={(item) => `h_${getOrderId(item.order)}`}
                            renderItem={({ item }) => <HistoryOrderCard order={item.order} onOpen={(o) => handleOpenOrder(o, 'history')} />}
                            contentContainerStyle={historyOrders.length ? s.listContent : s.listEmpty}
                            showsVerticalScrollIndicator={false}
                            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshOrders} tintColor={COLORS.primary} />}
                            ListEmptyComponent={<EmptyState type="history" />}
                        />
                    </View>
                </ScrollView>
            </View>
        </View>
    );
};

const s = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    container: { flex: 1, paddingHorizontal: 12 },
    // Segment
    segWrap: { flexDirection: 'row', backgroundColor: '#E5E5EA', borderRadius: 14, padding: 3, marginBottom: 10 },
    segBtn: { flex: 1, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    segBtnActive: { backgroundColor: COLORS.primary },
    segText: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.muted },
    segTextActive: { color: '#fff' },
    // Pager
    pager: { flex: 1 },
    // List
    listContent: { paddingBottom: 100, gap: 8 },
    listEmpty: { flexGrow: 1, paddingBottom: 100 },
    sectionTitle: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 8, marginTop: 4 },
    // Card (active + my)
    card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 0 },
    cardInner: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    cardTracking: { fontSize: 16, fontFamily: FONTS.black, color: COLORS.text },
    timerChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#FEF3E5' },
    timerText: { fontSize: 12, fontFamily: FONTS.bold, color: '#E8850A' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    statusBadgeText: { fontSize: 11, fontFamily: FONTS.bold, color: '#fff' },
    // Route
    route: { marginBottom: 8 },
    routeStop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    routeDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
    routeDotText: { fontSize: 9, fontFamily: FONTS.black, color: '#fff' },
    routeConnector: { width: 2, height: 10, backgroundColor: '#E5E5EA', marginLeft: 8, marginVertical: 1 },
    routeAddr: { flex: 1, fontSize: 13, fontFamily: FONTS.medium, color: '#434349' },
    // Card footer
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
    chipRow: { flexDirection: 'row', gap: 6 },
    chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: COLORS.chipBg },
    chipText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.text },
    acceptBtn: { borderRadius: 12, overflow: 'hidden' },
    acceptGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 12 },
    acceptText: { fontSize: 13, fontFamily: FONTS.bold, color: '#fff' },
    // Action button (my orders)
    actionBtnWrap: { marginHorizontal: 12, marginBottom: 10, borderRadius: 12, overflow: 'hidden' },
    actionBtn: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12 },
    actionBtnText: { fontSize: 14, fontFamily: FONTS.bold, color: '#fff' },
    // History card
    histCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
    histLeft: { flex: 1, marginRight: 8 },
    histTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    histTracking: { fontSize: 14, fontFamily: FONTS.black, color: COLORS.text },
    histStatusDot: { width: 6, height: 6, borderRadius: 3 },
    histStatus: { fontSize: 12, fontFamily: FONTS.bold },
    histRoute: { fontSize: 12, fontFamily: FONTS.medium, color: '#6D6D72', marginBottom: 2 },
    histDate: { fontSize: 11, fontFamily: FONTS.regular, color: COLORS.muted },
    histPrice: { fontSize: 15, fontFamily: FONTS.black, color: COLORS.text },
    // Empty
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    emptyIconActive: { backgroundColor: 'rgba(153,26,78,0.08)' },
    emptyIconHistory: { backgroundColor: '#ECECF1' },
    emptyTitle: { fontSize: 18, fontFamily: FONTS.bold, color: COLORS.text, textAlign: 'center', marginBottom: 6 },
    emptySubtitle: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: COLORS.muted, textAlign: 'center' },
});

export default DriverOrderManagementScreen;
