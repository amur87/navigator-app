import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
    ScrollView,
    RefreshControl,
    Alert,
    Platform,
    View,
    Text,
    Pressable,
    StyleSheet,
    StatusBar,
    Animated,
    Easing,
} from 'react-native';
import { Spinner, useTheme } from 'tamagui';
import Svg, { Path, Circle } from 'react-native-svg';
import { PortalHost } from '@gorhom/portal';
import { Order, Place } from '@fleetbase/sdk';
import { format as formatDate } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { formatMeters, formatDuration } from '../utils/format';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { useTempStore } from '../contexts/TempStoreContext';
import useSocketClusterClient from '../hooks/use-socket-cluster-client';
import useAppTheme from '../hooks/use-app-theme';
import useOrderResource from '../hooks/use-order-resource';
import usePromiseWithLoading from '../hooks/use-promise-with-loading';
import useFleetbase from '../hooks/use-fleetbase';
import LiveOrderRoute from '../components/LiveOrderRoute';
import OrderWaypointList from '../components/OrderWaypointList';
import OrderPayloadEntities from '../components/OrderPayloadEntities';
import OrderDocumentFiles from '../components/OrderDocumentFiles';
import OrderCustomerCard from '../components/OrderCustomerCard';
import OrderProofOfDelivery from '../components/OrderProofOfDelivery';
import OrderActivitySelect from '../components/OrderActivitySelect';
import OrderCommentThread from '../components/OrderCommentThread';
import LoadingOverlay from '../components/LoadingOverlay';
import DestinationChangedAlert from '../components/DestinationChangedAlert';
import GlassHeader from '../components/GlassHeader';
import { getMaterialRipple } from '../utils/material-ripple';
import {
    TERMINAL_ORDER_STATUSES,
    getCourierPrimaryAction,
    getCourierWorkflowStage,
    getOrderStatusLabel,
} from '../utils/order-workflow';

const COLORS = {
    background: '#F2F2F7',
    surface: '#FFFFFF',
    border: '#E6E6EC',
    text: '#111111',
    textMuted: '#7C7C86',
    textSoft: '#9B9BA6',
    primary: '#991A4E',
    primaryLight: '#C0245E',
    navy: '#142A65',
    navyMid: '#1E3C8A',
    green: '#34C759',
    blue: '#2AABEE',
    orange: '#FF9500',
    red: '#FF3B30',
    chipBg: '#F2F2F6',
};

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
    black: 'Rubik-Black',
};

const screenRipple = getMaterialRipple({ color: 'rgba(17,43,102,0.10)', foreground: true });
const primaryRipple = getMaterialRipple({ color: 'rgba(255,255,255,0.20)', foreground: true });

const getOrderDestination = (order, adapter) => {
    const pickup = order.getAttribute('payload.pickup');
    const waypoints = order.getAttribute('payload.waypoints', []) ?? [];
    const dropoff = order.getAttribute('payload.dropoff');
    const currentWaypoint = order.getAttribute('payload.current_waypoint');
    const locations = [pickup, ...waypoints, dropoff].filter(Boolean);
    const destination = locations.find((place) => place?.id === currentWaypoint) ?? locations[0];
    return new Place(destination, adapter);
};

function QrScanIcon({ color = '#fff', size = 22 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path fill={color} d="M3 11V3h8v8H3zm2-2h4V5H5v4zm8-6v8h8V3h-8zm6 6h-4V5h4v4zM3 21v-8h8v8H3zm2-2h4v-4H5v4zm13-6h3v3h-3v-3zm-5 0h3v3h-3v-3zm2 5h3v3h-3v-3zm3-2h3v3h-3v-3zm-5 2h3v3h-3v-3z" />
        </Svg>
    );
}

function CameraIcon({ color = '#fff', size = 22 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path fill={color} d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
        </Svg>
    );
}

function SignatureIcon({ color = '#fff', size = 22 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path fill={color} d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
        </Svg>
    );
}

function CheckCircleIcon({ color = COLORS.green, size = 20 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path fill={color} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </Svg>
    );
}

function PackageIcon({ color = '#fff', size = 18 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path fill={color} d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z" />
        </Svg>
    );
}

function NavigationIcon({ color = '#fff', size = 18 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path fill={color} d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
        </Svg>
    );
}

function InfoIcon({ color = COLORS.textMuted, size = 16 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Path fill={color} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </Svg>
    );
}

const WORKFLOW_STEPS = [
    { key: 'accepted', label: 'Назначен' },
    { key: 'enroute_pickup', label: 'В пути к А' },
    { key: 'at_pickup', label: 'На точке А' },
    { key: 'enroute_dropoff', label: 'В пути к Б' },
    { key: 'at_dropoff', label: 'На точке Б' },
    { key: 'completed', label: 'Выполнен' },
];

function getActiveStepIndex(orderStatus, currentStopType) {
    const status = String(orderStatus).toLowerCase();
    if (TERMINAL_ORDER_STATUSES.has(status)) return 5;
    if (status === 'completed' || status === 'order_completed') return 5;
    if (currentStopType === 'dropoff') {
        if (status === 'driver_enroute' || status === 'enroute' || status === 'started') return 3;
        return 4;
    }
    if (status === 'driver_enroute' || status === 'enroute' || status === 'started') return 1;
    if (status === 'pickup_ready' || status === 'in_progress') return 2;
    if (status === 'assigned' || status === 'dispatched' || status === 'created' || status === 'pending') return 0;
    return 0;
}

function StepperBar({ activeIndex }) {
    return (
        <View style={styles.stepperWrap}>
            {WORKFLOW_STEPS.map((step, index) => {
                const isDone = index < activeIndex;
                const isCurrent = index === activeIndex;
                return (
                    <View key={step.key} style={styles.stepItem}>
                        <View style={styles.stepDotRow}>
                            {index > 0 ? (
                                <View style={[styles.stepLine, isDone && styles.stepLineDone, isCurrent && styles.stepLineCurrent]} />
                            ) : null}
                            <View style={[styles.stepDot, isDone && styles.stepDotDone, isCurrent && styles.stepDotCurrent]}>
                                {isDone ? (
                                    <Svg width={10} height={10} viewBox="0 0 24 24">
                                        <Path fill="#fff" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                    </Svg>
                                ) : (
                                    <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextCurrent]}>{index + 1}</Text>
                                )}
                            </View>
                        </View>
                        <Text style={[styles.stepLabel, isDone && styles.stepLabelDone, isCurrent && styles.stepLabelCurrent]}>{step.label}</Text>
                    </View>
                );
            })}
        </View>
    );
}

const OrderScreen = ({ route }) => {
    const params = route.params || {};
    const theme = useTheme();
    const navigation = useNavigation();
    const { adapter } = useFleetbase();
    const { isDarkMode } = useAppTheme();
    const { driver } = useAuth();
    const { location } = useLocation();
    const { listen } = useSocketClusterClient();
    const { runWithLoading, isLoading } = usePromiseWithLoading();
    const { updateStorageOrder, setDimissedOrders } = useOrderManager();
    const { store, removeValue } = useTempStore();
    const insets = useSafeAreaInsets();
    const topInset = Math.max(insets.top, 0);

    const [order, setOrder] = useState(new Order(params.order, adapter));
    const [activityLoading, setActivityLoading] = useState();
    const [nextActivity, setNextActivity] = useState([]);
    const [loadingOverlayMessage, setLoadingOverlayMessage] = useState();
    const [isAccepting, setIsAccepting] = useState(false);
    const memoizedOrder = useMemo(() => order, [order?.id]);
    const { trackerData } = useOrderResource(memoizedOrder, { loadEta: false });
    const distanceLoadedRef = useRef(false);
    const isUpdatingActivity = useRef(false);
    const listenerRef = useRef();
    const activitySheetRef = useRef();

    const orderStatus = String(order.getAttribute('status') ?? '').toLowerCase();
    const isAdhoc = order.getAttribute('adhoc') === true;
    const isIncomingAdhoc = isAdhoc && order.getAttribute('driver_assigned') === null && !TERMINAL_ORDER_STATUSES.has(orderStatus);
    const isAssigned = order.getAttribute('driver_assigned') !== null;
    const workflowStage = getCourierWorkflowStage({ status: orderStatus, isAdhoc, isAssigned });
    const primaryAction = getCourierPrimaryAction({ stage: workflowStage });
    const isTerminal = TERMINAL_ORDER_STATUSES.has(orderStatus);
    const canStartOrder = primaryAction?.key === 'start' && order.isNotStarted && !isTerminal && !isIncomingAdhoc;
    const canUpdateActivity = primaryAction?.key === 'update' && !isTerminal && !isIncomingAdhoc;
    const isMultipleWaypointOrder = (order.getAttribute('payload.waypoints', []) ?? []).length > 0;
    const showLoadingOverlay = isLoading('activityUpdate');

    const [showDestAlert, setShowDestAlert] = useState(false);
    const [prevDest, setPrevDest] = useState(null);
    const [currDest, setCurrDest] = useState(null);

    const destination = useMemo(() => {
        const pickup = order.getAttribute('payload.pickup');
        const waypoints = order.getAttribute('payload.waypoints', []) ?? [];
        const dropoff = order.getAttribute('payload.dropoff');
        const currentWaypoint = order.getAttribute('payload.current_waypoint');
        const locations = [pickup, ...waypoints, dropoff].filter(Boolean);
        const dest = locations.find((place) => place?.id === currentWaypoint) ?? locations[0];
        return new Place(dest, adapter);
    }, [order, adapter]);

    const showProofSection = order.getAttribute('pod_required') === true || Boolean(order.getAttribute('proof'));
    const pickupId = order.getAttribute('payload.pickup.id');
    const dropoffId = order.getAttribute('payload.dropoff.id');
    const currentWaypointId = order.getAttribute('payload.current_waypoint');
    const currentStopType = currentWaypointId && dropoffId && currentWaypointId === dropoffId ? 'dropoff' : pickupId && currentWaypointId === pickupId ? 'pickup' : 'dropoff';
    const podMethod = String(order.getAttribute('pod_method') ?? '').toLowerCase();
    const podRequired = order.getAttribute('pod_required') === true;
    const activeStepIndex = getActiveStepIndex(orderStatus, currentStopType);

    const pickupAddress = order.getAttribute('payload.pickup.street1') ?? order.getAttribute('payload.pickup.name') ?? '-';
    const dropoffAddress = order.getAttribute('payload.dropoff.street1') ?? order.getAttribute('payload.dropoff.name') ?? '-';
    const trackingNumber = order.getAttribute('tracking_number.tracking_number') ?? order.id;

    const primaryActionLabel = useMemo(() => {
        if (primaryAction?.key === 'start') {
            return currentStopType === 'pickup' ? 'Начать маршрут' : 'Начать маршрут';
        }
        if (primaryAction?.key === 'update') {
            if (currentStopType === 'pickup') {
                if (orderStatus === 'driver_enroute' || orderStatus === 'enroute' || orderStatus === 'started') {
                    return 'Прибыл на точку А';
                }
                return 'Забрал заказ';
            }
            if (podRequired) {
                if (podMethod === 'scan') return 'Сканировать QR-код';
                if (podMethod === 'photo') return 'Сделать фото доставки';
                if (podMethod === 'signature') return 'Подпись клиента';
                return 'Подтвердить вручение';
            }
            if (orderStatus === 'driver_enroute' || orderStatus === 'enroute' || orderStatus === 'started') {
                return 'Прибыл на точку Б';
            }
            return 'Завершить доставку';
        }
        return primaryAction?.label ?? '';
    }, [currentStopType, orderStatus, podMethod, podRequired, primaryAction]);

    const getPodIcon = () => {
        if (podMethod === 'scan') return <QrScanIcon />;
        if (podMethod === 'photo') return <CameraIcon />;
        if (podMethod === 'signature') return <SignatureIcon />;
        return <CheckCircleIcon color="#fff" />;
    };

    const getActionIcon = () => {
        if (canStartOrder) return <NavigationIcon />;
        if (canUpdateActivity && podRequired && currentStopType === 'dropoff') return getPodIcon();
        return <NavigationIcon />;
    };

    const updateOrder = useCallback((order) => {
        setOrder(order);
        updateStorageOrder(order.serialize(), ['current', 'active', 'recent']);
    }, [setOrder, updateStorageOrder]);

    const getDistanceMatrix = useCallback(async () => {
        if (distanceLoadedRef.current) return;
        try {
            await order.getDistanceAndTime();
            distanceLoadedRef.current = true;
        } catch (err) {
            console.warn('Error loading order distance matrix:', err);
        }
    }, [order]);

    const reloadOrder = useCallback(async () => {
        try {
            const reloadedOrder = await runWithLoading(order.reload(), 'isReloading');
            updateOrder(reloadedOrder);
            distanceLoadedRef.current = false;
        } catch (err) {
            console.warn('Error reloading order:', err);
        }
    }, [order]);

    const startOrder = useCallback(async (params = {}) => {
        isUpdatingActivity.current = true;
        try {
            const updatedOrder = await runWithLoading(order.start(params), 'startOrder');
            updateOrder(updatedOrder);
        } catch (err) {
            console.warn('Error starting order:', err, err.message);
            const errorMessage = err.message ?? '';
            if (errorMessage.startsWith('Order has not been dispatched')) {
                return Alert.alert('Заказ не отправлен', 'Заказ ещё не был отправлен. Начать без диспетчеризации?', [
                    { text: 'Да', onPress: () => startOrder({ skipDispatch: true }) },
                    { text: 'Отмена', onPress: () => reloadOrder() },
                ]);
            }
        } finally {
            isUpdatingActivity.current = false;
        }
    }, [order, adapter]);

    const updateOrderActivity = useCallback(async () => {
        try {
            const activity = await runWithLoading(order.getNextActivity({ waypoint: destination?.id }), 'nextOrderActivity');
            const nextActivities = Array.isArray(activity) ? activity.filter(Boolean) : [activity].filter(Boolean);
            const firstActivity = nextActivities[0];
            if (!firstActivity) return;

            if (firstActivity.code === 'dispatched') {
                return Alert.alert('Внимание', 'Заказ ещё не был отправлен. Продолжить без диспетчеризации?', [
                    {
                        text: 'Да',
                        onPress: async () => {
                            try {
                                const updatedOrder = await order.updateActivity({ skipDispatch: true });
                                updateOrder(updatedOrder);
                            } catch (err) {
                                console.warn('Error updating order activity:', err);
                            }
                        },
                    },
                    { text: 'Отмена', onPress: () => reloadOrder() },
                ]);
            }

            if (nextActivities.length === 1) {
                return sendOrderActivityUpdate(firstActivity);
            }

            setNextActivity(nextActivities);
            activitySheetRef.current?.openBottomSheet();
        } catch (err) {
            console.warn('Error fetching next activity for order:', err);
        }
    }, [destination?.id, order, reloadOrder, runWithLoading, sendOrderActivityUpdate, updateOrder]);

    const sendOrderActivityUpdate = useCallback(async (activity, proof) => {
        setActivityLoading(activity.code);

        if (activity.require_pod && !proof) {
            activitySheetRef.current?.closeBottomSheet();
            return navigation.navigate('ProofOfDelivery', { activity, order: order.serialize(), waypoint: destination.serialize() });
        }

        const previousDestination = getOrderDestination(order, adapter);
        isUpdatingActivity.current = true;
        setLoadingOverlayMessage(`Обновление: ${activity._resolved_status ?? activity.status}`);

        try {
            const updatedOrder = await runWithLoading(order.updateActivity({ activity, proof: proof?.id }), 'activityUpdate');
            updateOrder(updatedOrder);
            setNextActivity([]);
            setLoadingOverlayMessage(null);

            const currentDestination = getOrderDestination(updatedOrder, adapter);
            const shouldNotifyUserDestinationChanged = activity.complete && updatedOrder.status !== 'completed' && previousDestination?.id !== currentDestination?.id;
            if (shouldNotifyUserDestinationChanged) {
                setPrevDest(previousDestination);
                setCurrDest(currentDestination);
                setShowDestAlert(true);
            }
        } catch (err) {
            console.warn('Error updating order activity:', err);
        } finally {
            isUpdatingActivity.current = false;
            setActivityLoading(null);
            setLoadingOverlayMessage(null);
            activitySheetRef.current?.closeBottomSheet();
        }
    }, [order]);

    const handleAdhocAccept = useCallback(async () => {
        Alert.alert('Принять заказ', 'Заказ будет закреплён за вами.', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Принять',
                onPress: async () => {
                    setIsAccepting(true);
                    try {
                        const startedOrder = await order.start({ assign: driver.id });
                        setOrder(startedOrder);
                    } catch (err) {
                        console.warn('Error assigning driver to ad-hoc order:', err);
                    } finally {
                        setIsAccepting(false);
                    }
                },
            },
        ]);
    }, [order, driver]);

    const handleAdhocDismissal = useCallback(() => {
        Alert.alert('Отклонить заказ', 'Заказ исчезнет из вашего списка.', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'OK',
                onPress: () => {
                    setDimissedOrders((prev) => [...prev, order.id]);
                    navigation.goBack();
                },
            },
        ]);
    }, [order, setDimissedOrders]);

    useEffect(() => {
        if (!order) return;
        if (!order.adapter) setOrder(order.setAdapter(adapter));
    }, [adapter]);

    useEffect(() => {
        if (order && !distanceLoadedRef.current) getDistanceMatrix();
    }, [order, getDistanceMatrix]);

    useEffect(() => {
        if (listenerRef.current) return;
        const listenForUpdates = async () => {
            const listener = await listen(`order.${order.id}`, (event) => {
                if (isUpdatingActivity && isUpdatingActivity.current === true) return;
                if (order.getAttribute('status') !== event.data.status) reloadOrder();
            });
            if (listener) listenerRef.current = listener;
        };
        listenForUpdates();
        return () => { if (listenerRef.current) listenerRef.current.stop(); };
    }, [listen, order.id]);

    useEffect(() => {
        const updateActivityWithProof = async (activity, proof) => {
            try {
                await sendOrderActivityUpdate(activity, proof);
            } catch (err) {
                console.warn('Error attempting to update activity with proof:', err);
            } finally {
                removeValue('proof');
            }
        };
        if (store.proof) {
            const { activity, proof } = store.proof;
            updateActivityWithProof(activity, proof);
        }
    }, [store.proof]);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title={`Заказ ${trackingNumber}`} onBackPress={() => navigation.goBack()} />
            <DestinationChangedAlert
                visible={showDestAlert}
                previousDestination={prevDest}
                currentDestination={currDest}
                onClose={() => setShowDestAlert(false)}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 48 }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isLoading('isReloading')} onRefresh={reloadOrder} tintColor={COLORS.primary} />}
            >
                {/* Map section */}
                <View style={styles.mapSection}>
                    <LiveOrderRoute
                        order={order}
                        zoom={4}
                        edgePaddingTop={20}
                        edgePaddingBottom={20}
                        edgePaddingLeft={20}
                        edgePaddingRight={20}
                        focusCurrentDestination={isMultipleWaypointOrder}
                        currentDestination={destination}
                    />
                </View>

                {/* Status stepper */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Статус заказа</Text>
                        <View style={[styles.statusBadge, isTerminal ? styles.statusBadgeCompleted : styles.statusBadgeActive]}>
                            <Text style={[styles.statusBadgeText, isTerminal ? styles.statusBadgeTextCompleted : styles.statusBadgeTextActive]}>
                                {getOrderStatusLabel(orderStatus)}
                            </Text>
                        </View>
                    </View>
                    <StepperBar activeIndex={activeStepIndex} />
                </View>

                {/* Route card */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Маршрут</Text>
                    <View style={styles.routeCard}>
                        <View style={styles.routePointRow}>
                            <View style={[styles.routeDot, styles.routeDotA]}>
                                <Text style={styles.routeDotText}>A</Text>
                            </View>
                            <View style={styles.routeTextWrap}>
                                <Text style={styles.routePointLabel}>Откуда</Text>
                                <Text style={styles.routeAddress}>{pickupAddress}</Text>
                            </View>
                        </View>
                        <View style={styles.routeDivider} />
                        <View style={styles.routePointRow}>
                            <View style={[styles.routeDot, styles.routeDotB]}>
                                <Text style={styles.routeDotText}>Б</Text>
                            </View>
                            <View style={styles.routeTextWrap}>
                                <Text style={styles.routePointLabel}>Куда</Text>
                                <Text style={styles.routeAddress}>{dropoffAddress}</Text>
                            </View>
                        </View>
                    </View>
                    <View style={styles.routeMetaRow}>
                        <View style={styles.routeMetaChip}>
                            <Text style={styles.routeMetaValue}>{formatMeters(trackerData.total_distance)}</Text>
                            <Text style={styles.routeMetaLabel}>Дистанция</Text>
                        </View>
                        <View style={styles.routeMetaChip}>
                            <Text style={styles.routeMetaValue}>{trackerData.current_destination_eta === -1 ? '-' : formatDuration(trackerData.current_destination_eta)}</Text>
                            <Text style={styles.routeMetaLabel}>~Время</Text>
                        </View>
                    </View>
                </View>

                {/* POD confirmation section */}
                {podRequired && !isTerminal ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Подтверждение доставки</Text>
                        <View style={styles.podCard}>
                            <View style={styles.podHeader}>
                                <View style={[styles.podIconWrap, podMethod === 'scan' && styles.podIconScan, podMethod === 'photo' && styles.podIconPhoto, podMethod === 'signature' && styles.podIconSign]}>
                                    {podMethod === 'scan' ? <QrScanIcon size={28} /> : podMethod === 'photo' ? <CameraIcon size={28} /> : podMethod === 'signature' ? <SignatureIcon size={28} /> : <CheckCircleIcon color="#fff" size={28} />}
                                </View>
                                <View style={styles.podTextWrap}>
                                    <Text style={styles.podTitle}>
                                        {podMethod === 'scan' ? 'Сканирование QR-кода' : podMethod === 'photo' ? 'Фотофиксация' : podMethod === 'signature' ? 'Подпись получателя' : 'Подтверждение'}
                                    </Text>
                                    <Text style={styles.podSubtitle}>
                                        {podMethod === 'scan'
                                            ? 'Наведите камеру на QR-код на упаковке для подтверждения вручения'
                                            : podMethod === 'photo'
                                            ? 'Сделайте фото доставленной посылки у двери получателя'
                                            : podMethod === 'signature'
                                            ? 'Получатель должен расписаться на экране'
                                            : 'Подтвердите доставку заказа'}
                                    </Text>
                                </View>
                            </View>
                            {order.getAttribute('proof') ? (
                                <View style={styles.podDone}>
                                    <CheckCircleIcon size={18} />
                                    <Text style={styles.podDoneText}>Подтверждение получено</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                ) : null}

                {/* Action buttons */}
                <View style={styles.section}>
                    {isIncomingAdhoc ? (
                        <View style={styles.adhocActions}>
                            <Pressable
                                style={({ pressed }) => [styles.acceptButton, pressed && styles.buttonPressed]}
                                onPress={handleAdhocAccept}
                                disabled={isAccepting}
                                android_ripple={primaryRipple}
                            >
                                {isAccepting ? (
                                    <Spinner color="white" />
                                ) : (
                                    <>
                                        <CheckCircleIcon color="#fff" size={20} />
                                        <Text style={styles.acceptButtonText}>Принять заказ</Text>
                                    </>
                                )}
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [styles.dismissButton, pressed && styles.buttonPressed]}
                                onPress={handleAdhocDismissal}
                                disabled={isAccepting}
                                android_ripple={screenRipple}
                            >
                                <Text style={styles.dismissButtonText}>Отклонить</Text>
                            </Pressable>
                        </View>
                    ) : null}

                    {canStartOrder ? (
                        <Pressable
                            style={({ pressed }) => [styles.primaryActionWrap, pressed && styles.buttonPressed]}
                            onPress={() => startOrder()}
                            android_ripple={primaryRipple}
                        >
                            <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={styles.primaryAction}>
                                {isLoading('startOrder') ? <Spinner color="white" /> : <NavigationIcon />}
                                <Text style={styles.primaryActionText}>{primaryActionLabel}</Text>
                            </LinearGradient>
                        </Pressable>
                    ) : null}

                    {canUpdateActivity ? (
                        <Pressable
                            style={({ pressed }) => [styles.primaryActionWrap, pressed && styles.buttonPressed]}
                            onPress={() => updateOrderActivity()}
                            android_ripple={primaryRipple}
                        >
                            <LinearGradient
                                colors={podRequired && currentStopType === 'dropoff' ? [COLORS.primary, COLORS.primaryLight] : [COLORS.navy, COLORS.navyMid]}
                                style={styles.primaryAction}
                            >
                                {isLoading('nextOrderActivity') ? <Spinner color="white" /> : getActionIcon()}
                                <Text style={styles.primaryActionText}>{primaryActionLabel}</Text>
                            </LinearGradient>
                        </Pressable>
                    ) : null}
                </View>

                {/* Order info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Информация</Text>
                    <View style={styles.infoCard}>
                        <InfoRow label="ID" value={order.id} />
                        <InfoRow label="Номер" value={trackingNumber} />
                        <InfoRow label="Тип" value={order.getAttribute('type')} />
                        <InfoRow label="Создан" value={formatDate(new Date(order.getAttribute('created_at')), 'dd.MM.yyyy HH:mm')} />
                        <InfoRow label="Запланирован" value={order.getAttribute('scheduled_at') ? formatDate(new Date(order.getAttribute('scheduled_at')), 'dd.MM.yyyy HH:mm') : '-'} />
                        <InfoRow
                            label="Подтверждение"
                            value={podRequired ? (podMethod === 'scan' ? 'QR-код' : podMethod === 'photo' ? 'Фото' : podMethod === 'signature' ? 'Подпись' : 'Требуется') : 'Не требуется'}
                            isLast
                        />
                    </View>
                </View>

                {/* Waypoints */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Маршрутные точки</Text>
                    <View style={styles.waypointCard}>
                        <OrderWaypointList order={order} />
                    </View>
                </View>

                {/* Customer */}
                {order.isAttributeFilled('customer') ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Клиент</Text>
                        <View style={styles.infoCard}>
                            <OrderCustomerCard customer={order.getAttribute('customer')} />
                        </View>
                    </View>
                ) : null}

                {/* Payload entities */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Содержимое</Text>
                    <OrderPayloadEntities order={order} onPress={({ entity, waypoint }) => navigation.navigate('Entity', { entity, waypoint })} />
                </View>

                {/* Proof of delivery */}
                {showProofSection ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Подтверждение</Text>
                        <OrderProofOfDelivery order={order} />
                    </View>
                ) : null}

                {/* Notes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Примечания</Text>
                    <View style={styles.notesCard}>
                        <Text style={styles.notesText}>{order.getAttribute('notes') || 'Нет примечаний'}</Text>
                    </View>
                </View>

                {/* Documents */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Документы</Text>
                    <OrderDocumentFiles order={order} />
                </View>

                {/* Comments */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Комментарии</Text>
                    <OrderCommentThread order={order} />
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            <LoadingOverlay
                text={loadingOverlayMessage}
                visible={showLoadingOverlay}
                spinnerColor={isDarkMode ? '$textPrimary' : '$white'}
                textColor={isDarkMode ? '$textPrimary' : '$white'}
            />
            <OrderActivitySelect
                ref={activitySheetRef}
                onChange={sendOrderActivityUpdate}
                waypoint={destination}
                activities={nextActivity}
                activityLoading={activityLoading}
                isLoading={isLoading('nextOrderActivity')}
                snapTo="80%"
                portalHost="OrderScreenPortal"
            />
            <PortalHost name="OrderScreenPortal" />
        </View>
    );
};

function InfoRow({ label, value, isLast = false }) {
    return (
        <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{value ?? '-'}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 14 },

    mapSection: {
        height: 240,
        borderRadius: 20,
        overflow: 'hidden',
        marginTop: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    section: { marginBottom: 14 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 10 },

    statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
    statusBadgeActive: { backgroundColor: 'rgba(153,26,78,0.10)' },
    statusBadgeCompleted: { backgroundColor: 'rgba(52,199,89,0.12)' },
    statusBadgeText: { fontSize: 12, fontFamily: FONTS.bold },
    statusBadgeTextActive: { color: COLORS.primary },
    statusBadgeTextCompleted: { color: COLORS.green },

    // Stepper
    stepperWrap: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 2 },
    stepItem: { alignItems: 'center', flex: 1 },
    stepDotRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', marginBottom: 6 },
    stepLine: { flex: 1, height: 2, backgroundColor: '#E0E0E5', marginRight: -1 },
    stepLineDone: { backgroundColor: COLORS.green },
    stepLineCurrent: { backgroundColor: COLORS.primary },
    stepDot: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: '#E0E0E5',
        alignItems: 'center', justifyContent: 'center',
    },
    stepDotDone: { backgroundColor: COLORS.green },
    stepDotCurrent: { backgroundColor: COLORS.primary },
    stepDotText: { fontSize: 10, fontFamily: FONTS.bold, color: '#fff' },
    stepDotTextCurrent: { color: '#fff' },
    stepLabel: { fontSize: 9, fontFamily: FONTS.medium, color: COLORS.textSoft, textAlign: 'center' },
    stepLabelDone: { color: COLORS.green },
    stepLabelCurrent: { color: COLORS.primary, fontFamily: FONTS.bold },

    // Route
    routeCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    routePointRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    routeDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    routeDotA: { backgroundColor: COLORS.green },
    routeDotB: { backgroundColor: COLORS.primary },
    routeDotText: { fontSize: 12, fontFamily: FONTS.black, color: '#fff' },
    routeTextWrap: { flex: 1 },
    routePointLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSoft, marginBottom: 2 },
    routeAddress: { fontSize: 14, lineHeight: 19, fontFamily: FONTS.medium, color: COLORS.text },
    routeDivider: { width: 3, height: 20, backgroundColor: '#D5D5DB', marginLeft: 12.5, marginVertical: 6, borderRadius: 2 },
    routeMetaRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    routeMetaChip: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    routeMetaValue: { fontSize: 16, fontFamily: FONTS.black, color: COLORS.text },
    routeMetaLabel: { fontSize: 11, fontFamily: FONTS.medium, color: COLORS.textSoft, marginTop: 2 },

    // POD card
    podCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    podHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    podIconWrap: {
        width: 56, height: 56, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.navy,
    },
    podIconScan: { backgroundColor: '#5856D6' },
    podIconPhoto: { backgroundColor: COLORS.blue },
    podIconSign: { backgroundColor: COLORS.orange },
    podTextWrap: { flex: 1 },
    podTitle: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
    podSubtitle: { fontSize: 12, lineHeight: 17, fontFamily: FONTS.regular, color: COLORS.textMuted },
    podDone: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
    podDoneText: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.green },

    // Action buttons
    primaryActionWrap: { borderRadius: 18, overflow: 'hidden', marginBottom: 8 },
    primaryAction: {
        height: 56,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    primaryActionText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },
    buttonPressed: { opacity: 0.96, transform: [{ scale: 0.985 }] },

    adhocActions: { gap: 10, marginBottom: 8 },
    acceptButton: {
        height: 56, borderRadius: 18,
        backgroundColor: COLORS.green,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        overflow: 'hidden',
    },
    acceptButtonText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },
    dismissButton: {
        height: 48, borderRadius: 16,
        backgroundColor: '#ECECF1',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
    },
    dismissButtonText: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.textMuted },

    // Info card
    infoCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
    infoRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
    infoLabel: { fontSize: 13, fontFamily: FONTS.medium, color: COLORS.textMuted },
    infoValue: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.text, maxWidth: '60%', textAlign: 'right' },

    waypointCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
    },

    notesCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    notesText: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.regular, color: COLORS.text },
});

export default OrderScreen;
