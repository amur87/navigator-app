import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import Svg, { Circle, Path } from 'react-native-svg';
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
    background: '#F3F3F7',
    surface: '#FFFFFF',
    border: '#E6E6EC',
    text: '#111111',
    textMuted: '#7C7C86',
    textSoft: '#9B9BA6',
    primary: '#991A4E',
    navy: '#142A65',
    success: '#34C759',
    warningBg: '#F8EBDD',
    warningText: '#F08A00',
    chipBg: '#F2F2F6',
    line: '#D6D6DE',
    historyBadge: '#ECECF1',
};

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
    black: 'Rubik-Black',
};

const TYPE = {
    title: 24,
    segment: 17,
    orderNumber: 16,
    body: 14,
    meta: 12,
    chip: 13,
    price: 20,
};

const ACTIVE_OFFER_SECONDS = 15 * 60;
const screenRipple = getMaterialRipple({ color: 'rgba(17,43,102,0.10)', foreground: true });
const successRipple = getMaterialRipple({ color: 'rgba(255,255,255,0.20)', foreground: true });

const isSdkOrder = (order: any) => typeof order?.getAttribute === 'function';
const getPayload = (order: any) => (isSdkOrder(order) ? order.getAttribute('payload') ?? {} : order?.payload ?? {});
const getOrderId = (order: any) => String(isSdkOrder(order) ? order.id ?? order.getAttribute('id') : order?.id ?? order?.uuid ?? '');
const getTracking = (order: any) =>
    String(isSdkOrder(order) ? order.getAttribute('tracking_number.tracking_number') ?? order.id : order?.tracking_number ?? order?.id)
        .replace(/^MAX-0*/i, '')
        .trim();
const getStatus = (order: any) => String(isSdkOrder(order) ? order.getAttribute('status') : order?.status ?? '').toLowerCase();
const getCreatedAt = (order: any) => (isSdkOrder(order) ? order.getAttribute('created_at') : order?.created_at);
const getScheduledAt = (order: any) => (isSdkOrder(order) ? order.getAttribute('scheduled_at') : order?.scheduled_at);
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
const getWeightKg = (order: any) => {
    const meta = isSdkOrder(order) ? order.getAttribute('meta') ?? {} : order?.meta ?? {};
    const payload = getPayload(order);
    const candidates = [meta.weight, meta.weight_kg, payload?.weight, payload?.weight_kg];

    for (const candidate of candidates) {
        const numeric = Number(candidate);
        if (Number.isFinite(numeric) && numeric > 0) {
            return `${Number.isInteger(numeric) ? numeric : numeric.toFixed(1)} кг`;
        }
    }

    return null;
};
const getPriceAmount = (order: any) => {
    const meta = isSdkOrder(order) ? order.getAttribute('meta') ?? {} : order?.meta ?? {};
    const value =
        meta?.price ??
        meta?.amount ??
        (isSdkOrder(order) ? order.getAttribute('cod_amount') : order?.cod_amount) ??
        (isSdkOrder(order) ? order.getAttribute('amount') : order?.amount);

    if (value === null || value === undefined || value === '') {
        return '0 сом';
    }

    const numeric = Number(String(value).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(numeric)) {
        return `${value}`;
    }

    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(numeric)} сом`;
};
const getDistanceLabel = (distanceMeters: number | null, order: any) => {
    if (Number.isFinite(distanceMeters as number)) {
        return `${Math.max((distanceMeters as number) / 1000, 0.1).toFixed(1)} км`;
    }

    const metaDistance = isSdkOrder(order) ? order.getAttribute('meta.distance') : order?.meta?.distance;
    return metaDistance ? `${metaDistance}` : '-';
};
const getOfferExpiry = (order: any) => {
    const meta = isSdkOrder(order) ? order.getAttribute('meta') ?? {} : order?.meta ?? {};
    const directExpiry =
        meta?.offer_expires_at ??
        meta?.expires_at ??
        (isSdkOrder(order) ? order.getAttribute('offer_expires_at') : order?.offer_expires_at) ??
        (isSdkOrder(order) ? order.getAttribute('expires_at') : order?.expires_at);

    if (directExpiry) {
        const expiryDate = new Date(directExpiry);
        if (!Number.isNaN(expiryDate.getTime())) {
            return expiryDate;
        }
    }

    const createdAt = getCreatedAt(order);
    const createdDate = createdAt ? new Date(createdAt) : null;
    if (!createdDate || Number.isNaN(createdDate.getTime())) {
        return null;
    }

    return new Date(createdDate.getTime() + ACTIVE_OFFER_SECONDS * 1000);
};
const getRemainingSeconds = (order: any, now: number) => {
    const expiry = getOfferExpiry(order);
    if (!expiry) {
        return ACTIVE_OFFER_SECONDS;
    }

    return Math.max(0, Math.floor((expiry.getTime() - now) / 1000));
};
const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};
const getHistoryTitle = (order: any) => {
    const pickup = getPickup(order);
    const dropoff = getDropoff(order);
    const shortPickup = pickup.split(',')[0].trim();
    const shortDropoff = dropoff.split(',')[0].trim();
    return `${shortPickup} → ${shortDropoff}`;
};
const getHistoryStatusLabel = (order: any) => {
    const status = getStatus(order);
    if (status === 'completed' || status === 'order_completed') {
        return 'Выполнен';
    }
    if (status === 'canceled' || status === 'order_canceled') {
        return 'Отменен';
    }
    return 'Завершен';
};
const getHistoryStatusColor = (order: any) => {
    const status = getStatus(order);
    if (status === 'canceled' || status === 'order_canceled') {
        return COLORS.primary;
    }
    return COLORS.success;
};
const getHistoryCompletedAt = (order: any) => {
    const directValue =
        (isSdkOrder(order) ? order.getAttribute('completed_at') : order?.completed_at) ??
        (isSdkOrder(order) ? order.getAttribute('updated_at') : order?.updated_at) ??
        getCreatedAt(order);

    if (!directValue) {
        return null;
    }

    const date = new Date(directValue);
    return Number.isNaN(date.getTime()) ? null : date;
};

function PackageIcon({ color = '#FFFFFF' }) {
    return (
        <Svg width={16} height={16} viewBox='0 0 24 24'>
            <Path
                fill={color}
                d='M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17l-5-5h3V8h4v4h3l-5 5z'
            />
        </Svg>
    );
}

function CalendarIcon({ color = COLORS.textSoft }) {
    return (
        <Svg width={16} height={16} viewBox='0 0 24 24'>
            <Path fill={color} d='M19 4h-1V2h-2v2H8V2H6v2H5C3.89 4 3 4.9 3 6v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z' />
        </Svg>
    );
}

function ClockIcon({ color = COLORS.warningText }) {
    return (
        <Svg width={16} height={16} viewBox='0 0 24 24'>
            <Path fill={color} d='M12 1a11 11 0 100 22 11 11 0 000-22zm1 11.41l3.29 3.3-1.41 1.41L11 13V6h2v6.41z' />
        </Svg>
    );
}

function WeightIcon({ color = COLORS.textSoft }) {
    return (
        <Svg width={16} height={16} viewBox='0 0 24 24'>
            <Path fill={color} d='M19 7h-1.18C17.4 5.84 16.3 5 15 5h-1.05a3 3 0 10-3.9 0H9c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v9a3 3 0 003 3h12a3 3 0 003-3V9c0-1.1-.9-2-2-2zm-7-2a1 1 0 110-2 1 1 0 010 2zm7 13a1 1 0 01-1 1H6a1 1 0 01-1-1V9h14v9z' />
        </Svg>
    );
}

function DistanceIcon({ color = COLORS.textSoft }) {
    return (
        <Svg width={16} height={16} viewBox='0 0 24 24'>
            <Path fill={color} d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.2A2.2 2.2 0 1112 6.8a2.2 2.2 0 010 4.4z' />
        </Svg>
    );
}

function CheckIcon() {
    return (
        <Svg width={18} height={18} viewBox='0 0 24 24'>
            <Path fill='#FFFFFF' d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
        </Svg>
    );
}

function SuccessMark({ color }: { color: string }) {
    return (
        <Svg width={18} height={18} viewBox='0 0 24 24'>
            <Path fill={color} d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' />
        </Svg>
    );
}

function EmptyOrdersState({ type }: { type: 'active' | 'history' }) {
    const isActive = type === 'active';

    return (
        <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, isActive ? styles.emptyIconActive : styles.emptyIconHistory]}>
                {isActive ? (
                    <Svg width={38} height={38} viewBox='0 0 48 48'>
                        <Circle cx='24' cy='24' r='23' fill='none' stroke='rgba(153,26,78,0.14)' strokeWidth='2' />
                        <Path fill={COLORS.primary} d='M24 9c-6.63 0-12 5.37-12 12 0 9 12 18 12 18s12-9 12-18c0-6.63-5.37-12-12-12zm0 16.5A4.5 4.5 0 1124 16a4.5 4.5 0 010 9.5z' />
                    </Svg>
                ) : (
                    <Svg width={38} height={38} viewBox='0 0 48 48'>
                        <Path fill={COLORS.textSoft} d='M14 10h20a4 4 0 014 4v20a4 4 0 01-4 4H14a4 4 0 01-4-4V14a4 4 0 014-4zm4 6v4h12v-4H18zm0 8v4h12v-4H18z' />
                    </Svg>
                )}
            </View>
            <Text style={styles.emptyTitle}>{isActive ? 'Нет доступных заказов' : 'История пока пустая'}</Text>
            <Text style={styles.emptySubtitle}>
                {isActive
                    ? 'Новые заказы рядом с вами появятся здесь автоматически.'
                    : 'После выполнения или завершения заказов они появятся в истории.'}
            </Text>
        </View>
    );
}

const ActiveOrderCard = React.memo(function ActiveOrderCard({
    order,
    distanceMeters,
    isAccepting,
    now,
    onOpen,
    onAccept,
}: {
    order: any;
    distanceMeters: number | null;
    isAccepting: boolean;
    now: number;
    onOpen: (order: any) => void;
    onAccept: (order: any) => void;
}) {
    const createdAt = getCreatedAt(order);
    const scheduledAt = getScheduledAt(order);
    const remainingSeconds = getRemainingSeconds(order, now);
    const distanceLabel = getDistanceLabel(distanceMeters, order);
    const weightLabel = getWeightKg(order);

    return (
        <Pressable style={styles.card} onPress={() => onOpen(order)} android_ripple={screenRipple}>
            <View style={styles.cardHeaderRow}>
                <View style={styles.orderHeaderLeft}>
                    <View style={styles.packageBadge}>
                        <PackageIcon />
                    </View>
                    <Text style={styles.orderNumber}>#{getTracking(order)}</Text>
                </View>
                <View style={styles.timerChip}>
                    <ClockIcon />
                    <Text style={styles.timerText}>{formatCountdown(remainingSeconds)}</Text>
                </View>
            </View>

            <View style={styles.infoLine}>
                <CalendarIcon />
                <Text style={styles.infoTextMuted}>Оформлено: {createdAt ? format(new Date(createdAt), 'd MMMM, HH:mm') : '-'}</Text>
            </View>

            <View style={styles.infoLine}>
                <CalendarIcon color={COLORS.navy} />
                <Text style={styles.infoTextStrong}>Запланировано: {scheduledAt ? format(new Date(scheduledAt), 'd MMMM, HH:mm') : 'как можно скорее'}</Text>
            </View>

            <View style={styles.routeWrap}>
                <View style={styles.routePointRow}>
                    <View style={[styles.routeDot, styles.routeDotA]}>
                        <Text style={styles.routeDotText}>A</Text>
                    </View>
                    <Text style={styles.routeAddress}>{getPickup(order)}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePointRow}>
                    <View style={[styles.routeDot, styles.routeDotB]}>
                        <Text style={styles.routeDotText}>B</Text>
                    </View>
                    <Text style={styles.routeAddress}>{getDropoff(order)}</Text>
                </View>
            </View>

            <View style={styles.chipsRow}>
                {weightLabel ? (
                    <View style={styles.metaChip}>
                        <WeightIcon />
                        <Text style={styles.metaChipText}>{weightLabel}</Text>
                    </View>
                ) : null}
                <View style={styles.metaChip}>
                    <DistanceIcon />
                    <Text style={styles.metaChipText}>{distanceLabel}</Text>
                </View>
            </View>

            <View style={styles.cardFooterRow}>
                <Text style={styles.priceText}>{getPriceAmount(order)}</Text>
                <Pressable
                    style={({ pressed }) => [styles.acceptButtonWrap, pressed && styles.acceptButtonPressed, isAccepting && styles.acceptButtonDisabled]}
                    onPress={() => onAccept(order)}
                    disabled={isAccepting}
                    android_ripple={successRipple}
                >
                    {isAccepting ? (
                        <ActivityIndicator color='#FFFFFF' />
                    ) : (
                        <>
                            <CheckIcon />
                            <Text style={styles.acceptButtonText}>Принять</Text>
                        </>
                    )}
                </Pressable>
            </View>
        </Pressable>
    );
});

const HistoryOrderCard = React.memo(function HistoryOrderCard({ order, onOpen }: { order: any; onOpen: (order: any) => void }) {
    const statusColor = getHistoryStatusColor(order);
    const completedAt = getHistoryCompletedAt(order);

    return (
        <Pressable style={styles.historyCard} onPress={() => onOpen(order)} android_ripple={screenRipple}>
            <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>#{getTracking(order)}</Text>
            </View>
            <View style={styles.historyContent}>
                <Text style={styles.historyTitle}>{getHistoryTitle(order)}</Text>
                <View style={styles.historyStatusRow}>
                    <SuccessMark color={statusColor} />
                    <Text style={[styles.historyStatusText, { color: statusColor }]}>{getHistoryStatusLabel(order)}</Text>
                </View>
                {completedAt ? <Text style={styles.historyDateText}>Завершен: {format(completedAt, 'd MMMM, HH:mm')}</Text> : null}
            </View>
            <Text style={styles.historyPrice}>{getPriceAmount(order)}</Text>
        </Pressable>
    );
});

const getStatusActionLabel = (order: any) => {
    const status = getStatus(order);
    const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
    if (stage === 'accepted') return 'Начать маршрут';
    if (stage === 'enroute' || stage === 'active') return 'Обновить статус';
    return null;
};

const getStatusBadgeColor = (order: any) => {
    const status = getStatus(order);
    const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
    if (stage === 'enroute') return '#E67E22';
    if (stage === 'active') return COLORS.primary;
    return COLORS.navy;
};

const MyOrderCard = React.memo(function MyOrderCard({
    order,
    isAdvancing,
    onOpen,
    onAdvance,
}: {
    order: any;
    isAdvancing: boolean;
    onOpen: (order: any) => void;
    onAdvance: (order: any) => void;
}) {
    const statusLabel = getOrderStatusLabel(getStatus(order));
    const actionLabel = getStatusActionLabel(order);
    const badgeColor = getStatusBadgeColor(order);

    return (
        <View style={styles.myCard}>
            <Pressable style={styles.myCardInfo} onPress={() => onOpen(order)} android_ripple={screenRipple}>
                <View style={styles.myCardHeader}>
                    <View style={styles.myCardTitleRow}>
                        <View style={styles.myCardIcon}>
                            <PackageIcon />
                        </View>
                        <Text style={styles.myCardTracking}>#{getTracking(order)}</Text>
                    </View>
                    <View style={[styles.myCardBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.myCardBadgeText}>{statusLabel}</Text>
                    </View>
                </View>
                <View style={styles.myCardRoute}>
                    <View style={styles.myCardStop}>
                        <View style={[styles.myCardDot, { backgroundColor: COLORS.navy }]}>
                            <Text style={styles.myCardDotText}>A</Text>
                        </View>
                        <Text style={styles.myCardAddr} numberOfLines={1}>{getPickup(order)}</Text>
                    </View>
                    <View style={styles.myCardConnector} />
                    <View style={styles.myCardStop}>
                        <View style={[styles.myCardDot, { backgroundColor: COLORS.primary }]}>
                            <Text style={styles.myCardDotText}>B</Text>
                        </View>
                        <Text style={styles.myCardAddr} numberOfLines={1}>{getDropoff(order)}</Text>
                    </View>
                </View>
            </Pressable>
            {actionLabel ? (
                <View style={styles.myCardBtnWrap}>
                    <Pressable
                        style={({ pressed }) => [styles.myCardBtn, pressed && { opacity: 0.85 }]}
                        onPress={() => onAdvance(order)}
                        disabled={isAdvancing}
                        android_ripple={successRipple}
                    >
                        {isAdvancing ? (
                            <ActivityIndicator color='#FFFFFF' size='small' />
                        ) : (
                            <Text style={styles.myCardBtnText}>{actionLabel}</Text>
                        )}
                    </Pressable>
                </View>
            ) : null}
        </View>
    );
});

const DriverOrderManagementScreen = () => {
    const navigation = useNavigation<any>();
    const { driver } = useAuth();
    const { location } = useLocation();
    const {
        allRecentOrders,
        allActiveOrders,
        nearbyOrders,
        reloadNearbyOrders,
        reloadRecentOrders,
        reloadActiveOrders,
        reloadCurrentOrders,
    } = useOrderManager();

    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [acceptingOrderId, setAcceptingOrderId] = useState<string | null>(null);
    const [advancingOrderId, setAdvancingOrderId] = useState<string | null>(null);
    const advancingRef = useRef(false);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);

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

    useFocusEffect(
        useCallback(() => {
            refreshOrders();
        }, [refreshOrders])
    );

    const driverCoords = {
        latitude: location?.coords?.latitude,
        longitude: location?.coords?.longitude,
    };

    const activeOrders = useMemo(() => {
        return nearbyOrders
            .filter((order: any) => {
                const status = getStatus(order);
                const isAdhoc = isSdkOrder(order) ? order.getAttribute('adhoc') === true : order?.adhoc === true;
                const isAvailable = !getDriverAssigned(order);
                const remainingSeconds = getRemainingSeconds(order, now);
                return isAdhoc && isAvailable && !TERMINAL_ORDER_STATUSES.has(status) && remainingSeconds > 0;
            })
            .map((order: any) => {
                const coords = getCoords(order);
                const distanceMeters =
                    coords && Number.isFinite(driverCoords.latitude) && Number.isFinite(driverCoords.longitude)
                        ? getGeoDistance([driverCoords.latitude, driverCoords.longitude], [coords.latitude, coords.longitude])
                        : null;

                return { order, distanceMeters };
            })
            .sort((left, right) => {
                const leftDistance = left.distanceMeters ?? Number.MAX_SAFE_INTEGER;
                const rightDistance = right.distanceMeters ?? Number.MAX_SAFE_INTEGER;
                return leftDistance - rightDistance;
            });
    }, [driverCoords.latitude, driverCoords.longitude, nearbyOrders, now]);

    const historyOrders = useMemo(() => {
        const activeIds = new Set(activeOrders.map(({ order }) => getOrderId(order)));

        return allRecentOrders
            .filter((order: any) => {
                const orderId = getOrderId(order);
                const status = getStatus(order);
                return !activeIds.has(orderId) && HISTORY_ORDER_STATUSES.has(status);
            })
            .sort((left: any, right: any) => {
                const leftDate = new Date(getCreatedAt(left) ?? 0).getTime();
                const rightDate = new Date(getCreatedAt(right) ?? 0).getTime();
                return rightDate - leftDate;
            })
            .map((order: any) => ({ order }));
    }, [activeOrders, allRecentOrders]);

    const myActiveOrders = useMemo(() => {
        return allActiveOrders
            .filter((order: any) => {
                const status = getStatus(order);
                return ACTIVE_COURIER_ORDER_STATUSES.has(status);
            })
            .sort((a: any, b: any) => {
                const aDate = new Date(getCreatedAt(a) ?? 0).getTime();
                const bDate = new Date(getCreatedAt(b) ?? 0).getTime();
                return bDate - aDate;
            });
    }, [allActiveOrders]);

    const handleAdvanceOrder = useCallback(
        async (order: any) => {
            if (!order || advancingRef.current) return;
            advancingRef.current = true;
            const orderId = getOrderId(order);
            const status = getStatus(order);
            const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
            setAdvancingOrderId(orderId);
            try {
                if (stage === 'accepted') {
                    try {
                        await order.start();
                    } catch (err: any) {
                        if (err?.message?.startsWith('Order has not been dispatched')) {
                            await order.start({ skipDispatch: true });
                        } else {
                            throw err;
                        }
                    }
                } else if (stage === 'enroute' || stage === 'active') {
                    const activities = await order.getNextActivity();
                    const nextActivities = (Array.isArray(activities) ? activities : [activities]).filter(Boolean);
                    const first = nextActivities[0];
                    if (!first) return;
                    if (first.require_pod || nextActivities.length > 1) {
                        const payload = isSdkOrder(order) ? order.serialize() : order;
                        navigation.navigate('Order', { order: payload });
                        return;
                    }
                    await order.updateActivity({ activity: first });
                }
                reloadActiveOrders({}, { setLoadingFlag: false });
                reloadCurrentOrders({}, { setLoadingFlag: false });
            } catch (err) {
                console.warn('Error advancing order status:', err);
                Alert.alert('Ошибка', 'Не удалось обновить статус.');
            } finally {
                advancingRef.current = false;
                setAdvancingOrderId(null);
            }
        },
        [navigation, reloadActiveOrders, reloadCurrentOrders]
    );

    const handleOpenOrder = useCallback(
        (order: any, mode: 'active' | 'history') => {
            const payload = isSdkOrder(order) ? order.serialize() : order;
            navigation.navigate(mode === 'active' ? 'OrderModal' : 'Order', { order: payload });
        },
        [navigation]
    );

    const handleAcceptOrder = useCallback(
        async (order: any) => {
            if (!driver?.id || acceptingOrderId) {
                return;
            }

            Alert.alert('Принять заказ', 'Заказ будет закреплен за вами.', [
                { text: 'Отмена', style: 'cancel' },
                {
                    text: 'Принять',
                    onPress: async () => {
                        const orderId = getOrderId(order);
                        setAcceptingOrderId(orderId);
                        try {
                            await order.update({ driver: driver.id });
                            try {
                                await order.start();
                            } catch (startErr: any) {
                                const msg = (startErr?.message ?? '').toLowerCase();
                                if (msg.includes('not been dispatched')) {
                                    await order.start({ skipDispatch: true });
                                } else {
                                    throw startErr;
                                }
                            }
                            await refreshOrders();
                            const payload = isSdkOrder(order) ? order.serialize() : order;
                            navigation.navigate('Order', { order: payload });
                        } catch (error) {
                            const message = error instanceof Error ? error.message : 'Не удалось принять заказ';
                            Alert.alert('Ошибка', message);
                        } finally {
                            setAcceptingOrderId(null);
                        }
                    },
                },
            ]);
        },
        [acceptingOrderId, driver?.id, navigation, refreshOrders]
    );

    const insets = useSafeAreaInsets();
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.safeArea}>
            <StatusBar translucent backgroundColor="transparent" barStyle='dark-content' />
            <GlassHeader title="Заказы" />
            <View style={[styles.container, { paddingTop: topInset + 48 + 8 }]}>
                <View style={styles.segmentWrap}>
                    <Pressable
                        style={[styles.segmentButton, activeTab === 'active' && styles.segmentButtonActive]}
                        onPress={() => setActiveTab('active')}
                        android_ripple={activeTab === 'active' ? undefined : screenRipple}
                    >
                        <Text style={[styles.segmentText, activeTab === 'active' && styles.segmentTextActive]}>Активные</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.segmentButton, activeTab === 'history' && styles.segmentButtonActive]}
                        onPress={() => setActiveTab('history')}
                        android_ripple={activeTab === 'history' ? undefined : screenRipple}
                    >
                        <Text style={[styles.segmentText, activeTab === 'history' && styles.segmentTextActive]}>История</Text>
                    </Pressable>
                </View>

                {activeTab === 'active' ? (
                    <FlatList
                        data={activeOrders}
                        keyExtractor={(item) => `active_${getOrderId(item.order)}`}
                        renderItem={({ item }) => (
                            <ActiveOrderCard
                                order={item.order}
                                distanceMeters={item.distanceMeters}
                                now={now}
                                isAccepting={acceptingOrderId === getOrderId(item.order)}
                                onOpen={(order) => handleOpenOrder(order, 'active')}
                                onAccept={handleAcceptOrder}
                            />
                        )}
                        ListHeaderComponent={
                            myActiveOrders.length > 0 ? (
                                <View style={styles.myOrdersSection}>
                                    <Text style={styles.myOrdersSectionTitle}>Мои заказы</Text>
                                    {myActiveOrders.map((order: any) => (
                                        <MyOrderCard
                                            key={`my_${getOrderId(order)}`}
                                            order={order}
                                            isAdvancing={advancingOrderId === getOrderId(order)}
                                            onOpen={(o) => handleOpenOrder(o, 'history')}
                                            onAdvance={handleAdvanceOrder}
                                        />
                                    ))}
                                    {activeOrders.length > 0 ? (
                                        <Text style={styles.myOrdersSectionTitle}>Доступные заказы</Text>
                                    ) : null}
                                </View>
                            ) : null
                        }
                        contentContainerStyle={activeOrders.length || myActiveOrders.length ? styles.listContent : styles.listEmptyContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshOrders} tintColor={COLORS.primary} />}
                        ListEmptyComponent={myActiveOrders.length === 0 ? <EmptyOrdersState type='active' /> : null}
                    />
                ) : (
                    <FlatList
                        data={historyOrders}
                        keyExtractor={(item) => `history_${getOrderId(item.order)}`}
                        renderItem={({ item }) => <HistoryOrderCard order={item.order} onOpen={(order) => handleOpenOrder(order, 'history')} />}
                        contentContainerStyle={historyOrders.length ? styles.listContent : styles.listEmptyContent}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshOrders} tintColor={COLORS.primary} />}
                        ListEmptyComponent={<EmptyOrdersState type='history' />}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.background },
    container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 12 },
    segmentWrap: {
        flexDirection: 'row',
        backgroundColor: '#E6E6EB',
        borderRadius: 20,
        padding: 5,
        marginBottom: 14,
    },
    segmentButton: {
        flex: 1,
        height: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    segmentButtonActive: {
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 4,
    },
    segmentText: {
        fontSize: TYPE.segment,
        fontFamily: FONTS.bold,
        color: COLORS.textSoft,
    },
    segmentTextActive: { color: '#FFFFFF' },
    listContent: { paddingBottom: 116, gap: 12 },
    listEmptyContent: { flexGrow: 1, paddingBottom: 120 },
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#1B2140',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 22,
        elevation: 3,
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    orderHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    packageBadge: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderNumber: { fontSize: TYPE.orderNumber, fontFamily: FONTS.black, color: COLORS.text },
    timerChip: {
        minWidth: 86,
        paddingHorizontal: 10,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.warningBg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    timerText: { fontSize: TYPE.chip, fontFamily: FONTS.bold, color: COLORS.warningText },
    infoLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    infoTextMuted: { fontSize: TYPE.meta, fontFamily: FONTS.regular, color: COLORS.textMuted },
    infoTextStrong: { fontSize: TYPE.meta, fontFamily: FONTS.bold, color: COLORS.navy },
    routeWrap: { marginTop: 4, marginBottom: 12 },
    routePointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
    routeLine: { width: 2, height: 18, backgroundColor: COLORS.line, marginLeft: 8, marginVertical: 4 },
    routeDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    routeDotA: { backgroundColor: COLORS.navy },
    routeDotB: { backgroundColor: COLORS.primary },
    routeDotText: { fontSize: 9, fontFamily: FONTS.black, color: '#FFFFFF' },
    routeAddress: { flex: 1, fontSize: TYPE.body, lineHeight: 18, fontFamily: FONTS.medium, color: '#434349' },
    chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    metaChip: {
        minWidth: 82,
        paddingHorizontal: 10,
        height: 30,
        borderRadius: 12,
        backgroundColor: COLORS.chipBg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaChipText: { fontSize: TYPE.chip, fontFamily: FONTS.medium, color: '#4D4D55' },
    cardFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
    priceText: { flex: 1, fontSize: TYPE.price, lineHeight: 24, fontFamily: FONTS.black, color: COLORS.text },
    acceptButtonWrap: {
        minWidth: 136,
        height: 46,
        borderRadius: 16,
        backgroundColor: COLORS.success,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        overflow: 'hidden',
        shadowColor: COLORS.success,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
        elevation: 5,
    },
    acceptButtonPressed: { transform: [{ scale: 0.985 }] },
    acceptButtonDisabled: { opacity: 0.75 },
    acceptButtonText: { fontSize: TYPE.body, fontFamily: FONTS.bold, color: '#FFFFFF' },
    historyCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 14,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#1B2140',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
        elevation: 2,
    },
    historyBadge: {
        width: 58,
        height: 58,
        borderRadius: 16,
        backgroundColor: COLORS.historyBadge,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    historyBadgeText: { fontSize: TYPE.body, fontFamily: FONTS.bold, color: COLORS.textSoft },
    historyContent: { flex: 1, paddingRight: 8 },
    historyTitle: { fontSize: 16, lineHeight: 20, fontFamily: FONTS.medium, color: '#3E3E44', marginBottom: 4 },
    historyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
    historyStatusText: { fontSize: TYPE.body, fontFamily: FONTS.bold },
    historyDateText: { fontSize: TYPE.meta, lineHeight: 15, fontFamily: FONTS.regular, color: COLORS.textMuted },
    historyPrice: { fontSize: 17, lineHeight: 21, fontFamily: FONTS.black, color: COLORS.text },
    myOrdersSection: { marginBottom: 4 },
    myOrdersSectionTitle: {
        fontSize: 16,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        marginBottom: 10,
        marginTop: 4,
    },
    myCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
        shadowColor: '#1B2140',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 18,
        elevation: 3,
        overflow: 'hidden',
    },
    myCardInfo: {
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 10,
    },
    myCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    myCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    myCardIcon: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: COLORS.navy,
        alignItems: 'center',
        justifyContent: 'center',
    },
    myCardTracking: { fontSize: 16, fontFamily: FONTS.black, color: COLORS.text },
    myCardBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    myCardBadgeText: { fontSize: 12, fontFamily: FONTS.bold, color: '#FFFFFF' },
    myCardRoute: { marginTop: 2 },
    myCardStop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    myCardDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    myCardDotText: { fontSize: 9, fontFamily: FONTS.black, color: '#FFFFFF' },
    myCardConnector: { width: 2, height: 14, backgroundColor: COLORS.line, marginLeft: 7, marginVertical: 3 },
    myCardAddr: { flex: 1, fontSize: 14, fontFamily: FONTS.medium, color: '#434349' },
    myCardBtnWrap: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4 },
    myCardBtn: {
        height: 50,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 4,
    },
    myCardBtnText: { fontSize: 15, fontFamily: FONTS.bold, color: '#FFFFFF' },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    emptyIconWrap: {
        width: 92,
        height: 92,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    emptyIconActive: { backgroundColor: 'rgba(153,26,78,0.08)' },
    emptyIconHistory: { backgroundColor: '#ECECF1' },
    emptyTitle: {
        fontSize: 22,
        lineHeight: 28,
        fontFamily: FONTS.bold,
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 15,
        lineHeight: 22,
        fontFamily: FONTS.regular,
        color: COLORS.textMuted,
        textAlign: 'center',
    },
});

export default DriverOrderManagementScreen;
