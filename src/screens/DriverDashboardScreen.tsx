import { BlurView } from '@react-native-community/blur';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Image, PanResponder, Platform, Pressable, StatusBar, StyleSheet, Text, Vibration, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MapView, { Circle as MapCircle, Marker, PROVIDER_GOOGLE, type MapStyleElement } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';
import { useLocation } from '../contexts/LocationContext';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { config } from '../utils';
import { getDistance as getGeoDistance } from '../utils/location';
import { getMaterialRipple } from '../utils/material-ripple';
import { playNotificationSound } from '../utils/notification-sound';
import { getCourierWorkflowStage, getCourierPrimaryAction, getOrderStatusLabel, TERMINAL_ORDER_STATUSES } from '../utils/order-workflow';
import useStorage from '../hooks/use-storage';
import { SEARCH_RADIUS_STORAGE_KEY } from './DriverAccountScreen';

const HANDLE_SIZE = 32;
const DEFAULT_LAT = 42.8746;
const DEFAULT_LNG = 74.5698;
const DEFAULT_LAT_DELTA = 0.008;
const DEFAULT_LNG_DELTA = 0.006;
const DEFAULT_SEARCH_RADIUS_KM = 3;
const ORDER_OFFER_SECONDS = 20;
const SEARCH_PHASE_DELAY_MS = 5000;
const SEARCH_REVEAL_DELAY_MS = 1500;
const NEARBY_POLL_MS = 30000;
const SEARCH_RESTART_MS = 30000;

const COLORS = {
    background: '#F2F2F7',
    primary: '#991A4E',
    primaryLight: '#C0245E',
    navy: '#142A65',
    navyMid: '#1E3C8A',
    green: '#34C759',
    blue: '#2AABEE',
    text: '#111111',
    muted: '#8E8E93',
    lightMuted: '#AEAEB2',
};

const FONTS = {
    regular: 'Rubik-Regular',
    medium: 'Rubik-Medium',
    bold: 'Rubik-Bold',
    black: 'Rubik-Black',
};

const MAP_STYLE: MapStyleElement[] = [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#505868' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
    // Roads - high contrast for courier navigation
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e4ea' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#4a5568' }] },
    { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#6b7280' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fde9d0' }] },
    { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#e8cda8' }] },
    { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#4a4a4a' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e6d0d8' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c9a0b2' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
    // Buildings - visible for address finding
    { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#ebeef3' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e8ede4' }] },
    // POIs - all off for clean map
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    // Transit - off
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    // Admin & water
    { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#d8dfeb' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d4e4f5' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6888a8' }] },
];

const buildSearchSteps = (maxKm: number): number[] => {
    const steps: number[] = [];
    if (maxKm >= 1) steps.push(500);
    if (maxKm >= 2) steps.push(1000);
    if (maxKm >= 3) steps.push(2000);
    if (maxKm >= 5) steps.push(3000);
    if (maxKm >= 7) steps.push(5000);
    steps.push(maxKm * 1000);
    return [...new Set(steps)].sort((a, b) => a - b);
};
const buildSearchPhases = (steps: number[]) =>
    steps.map((meters, i) => {
        const label = meters >= 1000 ? `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} \u043a\u043c` : `${meters} \u043c`;
        const pct = `${Math.round(((i + 1) / steps.length) * 100)}%`;
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;
        return {
            title: isFirst ? '\u0418\u0449\u0435\u043c \u0437\u0430\u043a\u0430\u0437\u044b...' : isLast ? '\u041c\u0430\u043a\u0441\u0438\u043c\u0430\u043b\u044c\u043d\u044b\u0439 \u043e\u0445\u0432\u0430\u0442' : '\u0420\u0430\u0441\u0448\u0438\u0440\u044f\u0435\u043c \u043f\u043e\u0438\u0441\u043a',
            subtitle: isFirst ? `\u041f\u0440\u043e\u0432\u0435\u0440\u044f\u0435\u043c \u0440\u0430\u0434\u0438\u0443\u0441 ${label} \u0440\u044f\u0434\u043e\u043c \u0441 \u0432\u0430\u043c\u0438` : `\u0421\u043c\u043e\u0442\u0440\u0438\u043c \u0437\u0430\u043a\u0430\u0437\u044b \u0432 \u0440\u0430\u0434\u0438\u0443\u0441\u0435 ${label}`,
            percent: pct,
            radius: label,
        };
    });

const isSdkOrder = (order: any) => typeof order?.getAttribute === 'function';
const getPayload = (order: any) => (isSdkOrder(order) ? order.getAttribute('payload') ?? {} : order?.payload ?? {});
const getOrderId = (order: any) => String(isSdkOrder(order) ? order.id ?? order.getAttribute('id') : order?.id ?? order?.uuid ?? '');
const getTracking = (order: any) => String(isSdkOrder(order) ? order.getAttribute('tracking_number.tracking_number') ?? order.id : order?.tracking_number ?? order?.id).replace(/^MAX-0*/i, '');
const getPickup = (order: any) => getPayload(order)?.pickup?.street1 ?? '-';
const getDropoff = (order: any) => getPayload(order)?.dropoff?.street1 ?? '-';
const getCurrentWaypointId = (order: any) => {
    const payload = getPayload(order);
    return isSdkOrder(order) ? order.getAttribute('payload.current_waypoint') : payload?.current_waypoint;
};
const getPriceLabel = (order: any) => (isSdkOrder(order) ? order.getAttribute('meta.price') ?? order.getAttribute('cod_amount') : order?.meta?.price ?? order?.cod_amount) ? `${isSdkOrder(order) ? order.getAttribute('meta.price') ?? order.getAttribute('cod_amount') : order?.meta?.price ?? order?.cod_amount}`.replace(/\s*c?$/, '') + ' \u0441' : '0 \u0441';
const getDistanceLabel = (order: any) => (isSdkOrder(order) ? order.getAttribute('meta.distance') : order?.meta?.distance) ?? '4.2 \u043a\u043c';
const getEta = (order: any) => (isSdkOrder(order) ? order.getAttribute('meta.eta') : order?.meta?.eta) ?? '18 \u043c\u0438\u043d';
const formatRadiusLabel = (meters: number) => (meters >= 1000 ? `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} \u043a\u043c` : `${meters} \u043c`);
const createSearchRegion = (coords: { latitude: number; longitude: number }, radiusMeters: number) => {
    // Adaptive padding: circle fits with room for streets at 500m, wider at 5km
    const padding = 0.93 + Math.min(radiusMeters / 5000, 1) * 0.13;
    const latitudeDelta = Math.max((radiusMeters / 111320) * padding, DEFAULT_LAT_DELTA);
    const longitudeDelta = Math.max(latitudeDelta * 0.78, DEFAULT_LNG_DELTA);

    return {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta,
        longitudeDelta,
    };
};
const parseRadiusMeters = (value: any) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 100 ? value : value * 1000;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase().replace(',', '.');
        const match = normalized.match(/(\d+(?:\.\d+)?)/);
        if (!match) {
            return null;
        }

        const amount = Number(match[1]);
        if (!Number.isFinite(amount)) {
            return null;
        }

        if (normalized.includes('km') || normalized.includes('\u043a\u043c')) {
            return amount * 1000;
        }

        return amount > 100 ? amount : amount * 1000;
    }

    return null;
};
const getOrderRadiusMeters = (order: any) => {
    const meta = isSdkOrder(order) ? order.getAttribute('meta') ?? {} : order?.meta ?? {};
    const candidates = [
        meta?.radius,
        meta?.search_radius,
        meta?.nearby_radius,
        isSdkOrder(order) ? order.getAttribute('radius') : order?.radius,
        isSdkOrder(order) ? order.getAttribute('search_radius') : order?.search_radius,
        isSdkOrder(order) ? order.getAttribute('nearby_radius') : order?.nearby_radius,
    ];

    for (const candidate of candidates) {
        const radiusMeters = parseRadiusMeters(candidate);
        if (radiusMeters) {
            return radiusMeters;
        }
    }

    return null;
};
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
const getDropoffCoords = (order: any) => {
    const location = getPayload(order)?.dropoff?.location;
    if (Array.isArray(location?.coordinates) && location.coordinates.length >= 2) {
        return { latitude: Number(location.coordinates[1]), longitude: Number(location.coordinates[0]) };
    }
    if (typeof location?.latitude === 'number' && typeof location?.longitude === 'number') {
        return { latitude: location.latitude, longitude: location.longitude };
    }
    return null;
};

const lightRipple = getMaterialRipple({ color: 'rgba(17,43,102,0.10)', foreground: true });
const darkRipple = getMaterialRipple({ color: 'rgba(255,255,255,0.18)', foreground: true });
const welcomeCtaRipple = getMaterialRipple({ color: 'rgba(255,255,255,0.24)', foreground: true, radius: 220 });
const NON_NEW_ORDER_STATUSES = new Set(['completed', 'canceled', 'order_canceled']);

const getOrderStatus = (order: any) => String(isSdkOrder(order) ? order.getAttribute('status') : order?.status ?? '').toLowerCase();
const getCurrentStopType = (order: any) => {
    const payload = getPayload(order);
    const pickupId = payload?.pickup?.id;
    const dropoffId = payload?.dropoff?.id;
    const currentWaypointId = isSdkOrder(order) ? order.getAttribute('payload.current_waypoint') : payload?.current_waypoint;
    if (currentWaypointId && dropoffId && currentWaypointId === dropoffId) return 'dropoff';
    if (pickupId && currentWaypointId === pickupId) return 'pickup';
    return 'dropoff';
};
const getOrderPodRequired = (order: any) => (isSdkOrder(order) ? order.getAttribute('pod_required') === true : order?.pod_required === true);
const getOrderPodMethod = (order: any) => String(isSdkOrder(order) ? order.getAttribute('pod_method') ?? '' : order?.pod_method ?? '').toLowerCase();

const getStatusActionLabel = (order: any) => {
    const status = getOrderStatus(order);
    const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
    const stopType = getCurrentStopType(order);
    const podRequired = getOrderPodRequired(order);
    const podMethod = getOrderPodMethod(order);

    if (stage === 'accepted') return '\u041d\u0430\u0447\u0430\u0442\u044c \u043c\u0430\u0440\u0448\u0440\u0443\u0442';

    if (stage === 'enroute') {
        if (stopType === 'pickup') return '\u041f\u0440\u0438\u0431\u044b\u043b \u043d\u0430 \u0442\u043e\u0447\u043a\u0443 \u0410';
        return '\u041f\u0440\u0438\u0431\u044b\u043b \u043d\u0430 \u0442\u043e\u0447\u043a\u0443 \u0411';
    }

    if (stage === 'active') {
        if (stopType === 'pickup') return '\u0417\u0430\u0431\u0440\u0430\u043b \u0437\u0430\u043a\u0430\u0437';
        if (podRequired) {
            if (podMethod === 'scan') return '\u0421\u043a\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u0442\u044c QR';
            if (podMethod === 'photo') return '\u0424\u043e\u0442\u043e \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0438';
            if (podMethod === 'signature') return '\u041f\u043e\u0434\u043f\u0438\u0441\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430';
            return '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c';
        }
        return '\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0434\u043e\u0441\u0442\u0430\u0432\u043a\u0443';
    }

    return null;
};

const getStatusBtnColors = (order: any): [string, string] => {
    const status = getOrderStatus(order);
    const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
    const stopType = getCurrentStopType(order);
    const podRequired = getOrderPodRequired(order);

    if (stage === 'active' && stopType === 'dropoff' && podRequired) {
        return [COLORS.navy, COLORS.navyMid];
    }
    return [COLORS.primary, COLORS.primaryLight];
};

const isStatusPod = (order: any): boolean => {
    const status = getOrderStatus(order);
    const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
    const stopType = getCurrentStopType(order);
    return stage === 'active' && stopType === 'dropoff' && getOrderPodRequired(order);
};

const DriverDashboardScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const {
        location,
        startTracking,
        stopTracking,
        trackLocation,
        isResolvingLocation,
        hasRealLocation,
    } = useLocation();
    const { isOnline, toggleOnline, driver } = useAuth();
    const { unreadCount } = useChat();
    const { allActiveOrders, nearbyOrders, reloadActiveOrders, reloadNearbyOrders, reloadCurrentOrders } = useOrderManager();
    const [searchRadiusKm] = useStorage<number>(SEARCH_RADIUS_STORAGE_KEY, DEFAULT_SEARCH_RADIUS_KM);
    const maxDistanceKm = searchRadiusKm || DEFAULT_SEARCH_RADIUS_KM;
    const searchRadiusSteps = useMemo(() => buildSearchSteps(maxDistanceKm), [maxDistanceKm]);
    const searchPhases = useMemo(() => buildSearchPhases(searchRadiusSteps), [searchRadiusSteps]);

    const [trackWidth, setTrackWidth] = useState(0);
    const [isSwitching, setIsSwitching] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [acceptedOrder, setAcceptedOrder] = useState<any>(null);
    const [searchVisible, setSearchVisible] = useState(false);
    const [foundOrder, setFoundOrder] = useState<any>(null);
    const [searchPhase, setSearchPhase] = useState(0);
    const [countdown, setCountdown] = useState(ORDER_OFFER_SECONDS);
    const [dismissedOrderIds, setDismissedOrderIds] = useState<string[]>([]);
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [isAcceptingOffer, setIsAcceptingOffer] = useState(false);

    const [weather, setWeather] = useState<{ temp: number; icon: string; desc: string } | null>(null);

    const weatherFetchedRef = useRef(false);
    useEffect(() => {
        if (!hasRealLocation || weatherFetchedRef.current) return;
        weatherFetchedRef.current = true;
        const lat = location.coords.latitude;
        const lon = location.coords.longitude;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
        fetch(url)
            .then((res) => res.json())
            .then((data) => {
                const temp = Math.round(data?.current?.temperature_2m ?? 0);
                const code = data?.current?.weather_code ?? 0;
                let icon = '\u2600\uFE0F'; // sunny
                let desc = '\u042F\u0441\u043D\u043E';
                if (code >= 71) { icon = '\u2744\uFE0F'; desc = '\u0421\u043D\u0435\u0433'; }
                else if (code >= 61) { icon = '\uD83C\uDF27\uFE0F'; desc = '\u0414\u043E\u0436\u0434\u044C'; }
                else if (code >= 51) { icon = '\uD83C\uDF26\uFE0F'; desc = '\u041C\u043E\u0440\u043E\u0441\u044C'; }
                else if (code >= 45) { icon = '\uD83C\uDF2B\uFE0F'; desc = '\u0422\u0443\u043C\u0430\u043D'; }
                else if (code >= 3) { icon = '\u2601\uFE0F'; desc = '\u041E\u0431\u043B\u0430\u0447\u043D\u043E'; }
                else if (code >= 1) { icon = '\u26C5'; desc = '\u041F\u0435\u0440\u0435\u043C\u0435\u043D\u043D\u043E'; }
                setWeather({ temp, icon, desc });
            })
            .catch(() => { weatherFetchedRef.current = false; });
    }, [hasRealLocation]);

    const [mapRegion, setMapRegion] = useState(() => ({
        latitude: hasRealLocation ? location.coords.latitude : DEFAULT_LAT,
        longitude: hasRealLocation ? location.coords.longitude : DEFAULT_LNG,
        latitudeDelta: DEFAULT_LAT_DELTA,
        longitudeDelta: DEFAULT_LNG_DELTA,
    }));
    const mapRegionRef = useRef(mapRegion);
    mapRegionRef.current = mapRegion;
    const currentSearchRadius = searchRadiusSteps[Math.min(searchPhase, searchRadiusSteps.length - 1)];

    const sliderX = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current;
    const searchSpin = useRef(new Animated.Value(0)).current;
    const mapRef = useRef<MapView | null>(null);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const activeOrders = useMemo(
        () =>
            allActiveOrders.filter((order: any) => {
                const status = String(isSdkOrder(order) ? order.getAttribute('status') : order?.status ?? '').toLowerCase();
                return !NON_NEW_ORDER_STATUSES.has(status);
            }),
        [allActiveOrders]
    );
    const newNearbyOrders = useMemo(
        () =>
            nearbyOrders.filter((order: any) => {
                const status = String(isSdkOrder(order) ? order.getAttribute('status') : order?.status ?? '').toLowerCase();
                const driverAssigned = isSdkOrder(order) ? order.getAttribute('driver_assigned') : order?.driver_assigned;

                return !driverAssigned && !NON_NEW_ORDER_STATUSES.has(status);
            }),
        [nearbyOrders]
    );
    const currentOrder = activeOrders[0] ?? acceptedOrder ?? null;
    const currentOrderPickup = useMemo(() => currentOrder ? getCoords(currentOrder) : null, [currentOrder]);
    const currentOrderDropoff = useMemo(() => currentOrder ? getDropoffCoords(currentOrder) : null, [currentOrder]);
    const currentOrderStage = useMemo(() => {
        if (!currentOrder) return null;
        const status = getOrderStatus(currentOrder);
        return getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
    }, [currentOrder]);
    const driverName = driver?.getAttribute?.('name') ?? driver?.name ?? '\u0410';
    const driverInitial = String(driverName).slice(0, 1).toUpperCase();
    const driverPhotoUrl = driver?.getAttribute?.('photo_url') ?? driver?.photo_url ?? null;
    const driverCoords = {
        latitude: location?.coords?.latitude ?? DEFAULT_LAT,
        longitude: location?.coords?.longitude ?? DEFAULT_LNG,
    };
    const dismissedIdsSet = useMemo(() => new Set(dismissedOrderIds), [dismissedOrderIds]);
    const mapNearbyOrders = useMemo(
        () =>
            newNearbyOrders
                .map((order: any) => {
                    const coords = getCoords(order);
                    if (!coords) {
                        return null;
                    }

                    const distanceMeters = getGeoDistance(
                        [driverCoords.latitude, driverCoords.longitude],
                        [coords.latitude, coords.longitude]
                    );
                    const radiusMeters = getOrderRadiusMeters(order);

                    if (distanceMeters > maxDistanceKm * 1000) {
                        return null;
                    }

                    if (radiusMeters && distanceMeters > radiusMeters) {
                        return null;
                    }

                    const distanceKm = Number.isFinite(distanceMeters) ? `${Math.max(distanceMeters / 1000, 0.1).toFixed(1)} \u043a\u043c` : getDistanceLabel(order);

                    const dropoff = getDropoffCoords(order);
                    let routeDistanceKm = distanceKm;
                    if (dropoff) {
                        const routeMeters = getGeoDistance(
                            [coords.latitude, coords.longitude],
                            [dropoff.latitude, dropoff.longitude]
                        );
                        if (Number.isFinite(routeMeters)) {
                            routeDistanceKm = `${Math.max(routeMeters / 1000, 0.1).toFixed(1)} \u043a\u043c`;
                        }
                    }

                    return { order, coords, distanceKm, routeDistanceKm, distanceMeters, radiusMeters };
                })
                .filter(Boolean)
                .sort((left: any, right: any) => left.distanceMeters - right.distanceMeters),
        [driverCoords.latitude, driverCoords.longitude, newNearbyOrders]
    );
    const visibleNearbyOrders = useMemo(
        () => mapNearbyOrders.filter((mapOrder: any) => mapOrder.distanceMeters <= currentSearchRadius),
        [currentSearchRadius, mapNearbyOrders]
    );
    const offerQueue = useMemo(
        () => visibleNearbyOrders.filter((mapOrder: any) => !dismissedIdsSet.has(getOrderId(mapOrder.order))),
        [dismissedIdsSet, visibleNearbyOrders]
    );
    const nearestMapOrder = offerQueue[0] ?? null;
    const foundMapOrder = useMemo(
        () => (foundOrder ? mapNearbyOrders.find((mapOrder: any) => getOrderId(mapOrder.order) === getOrderId(foundOrder)) ?? null : null),
        [foundOrder, mapNearbyOrders]
    );
    const isSearchExhausted = isOnline && !currentOrder && offerQueue.length === 0 && searchPhase >= searchRadiusSteps.length - 1;
    const showSearchVisuals = hasRealLocation && isOnline && !currentOrder;
    const maxX = Math.max(trackWidth - HANDLE_SIZE - 8, 0);
    useEffect(() => {
        reloadActiveOrders({}, { setLoadingFlag: false });
        reloadNearbyOrders({}, { setLoadingFlag: false });
        reloadCurrentOrders({}, { setLoadingFlag: false });
    }, [reloadActiveOrders, reloadNearbyOrders, reloadCurrentOrders]);

    // Fetch nearby orders once when going online, then poll every 30s
    useEffect(() => {
        if (!isOnline || currentOrder || !hasRealLocation) return;
        reloadNearbyOrders({ radius: searchRadiusSteps[searchRadiusSteps.length - 1] }, { setLoadingFlag: false });
        const interval = setInterval(() => {
            reloadNearbyOrders({ radius: searchRadiusSteps[searchRadiusSteps.length - 1] }, { setLoadingFlag: false });
        }, NEARBY_POLL_MS);
        return () => clearInterval(interval);
    }, [currentOrder, hasRealLocation, isOnline, reloadNearbyOrders]);

    const refreshDriverLocation = useCallback(async (options: { force?: boolean } = {}) => {
        return trackLocation(options);
    }, [trackLocation]);
    const dismissOffer = useCallback((order: any) => {
        const orderId = getOrderId(order);
        if (!orderId) {
            return;
        }

        setDismissedOrderIds((current) => (current.includes(orderId) ? current : [...current, orderId]));
    }, []);

    const clearSearchTimers = useCallback(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        searchTimeoutRef.current = null;
        countdownIntervalRef.current = null;
    }, []);

    const showOrderOffer = useCallback((mapOrder: any) => {
        clearSearchTimers();
        setFoundOrder(mapOrder.order);
        setCountdown(ORDER_OFFER_SECONDS);
    }, [clearSearchTimers]);

    const acceptOffer = useCallback(async (order: any) => {
        if (!driver?.id || isAcceptingOffer) return;
        setIsAcceptingOffer(true);
        try {
            const sdkOrder = isSdkOrder(order) ? order : null;
            if (!sdkOrder) {
                Alert.alert('\u041e\u0448\u0438\u0431\u043a\u0430', '\u041d\u0435\u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e \u043f\u0440\u0438\u043d\u044f\u0442\u044c \u0437\u0430\u043a\u0430\u0437.');
                return;
            }
            await sdkOrder.update({ driver: driver.id });
            try {
                await sdkOrder.start();
            } catch (startErr: any) {
                const msg = (startErr?.message ?? '').toLowerCase();
                if (msg.includes('not been dispatched')) {
                    await sdkOrder.start({ skipDispatch: true });
                } else {
                    throw startErr;
                }
            }
            clearSearchTimers();
            setFoundOrder(null);
            setSelectedOrder(null);
            setAcceptedOrder(sdkOrder);
            dismissOffer(order);
            reloadActiveOrders({}, { setLoadingFlag: false });
            reloadNearbyOrders({}, { setLoadingFlag: false });
            reloadCurrentOrders({}, { setLoadingFlag: false });
        } catch (error) {
            const message = error instanceof Error ? error.message : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u0440\u0438\u043d\u044f\u0442\u044c \u0437\u0430\u043a\u0430\u0437';
            Alert.alert('\u041e\u0448\u0438\u0431\u043a\u0430', message);
        } finally {
            setIsAcceptingOffer(false);
        }
    }, [clearSearchTimers, dismissOffer, driver?.id, isAcceptingOffer, reloadActiveOrders, reloadCurrentOrders, reloadNearbyOrders]);

    // Fetch location once when the screen gains focus (covers both initial
    // mount and returning from another tab).  No separate mount effect needed.
    useFocusEffect(
        useCallback(() => {
            refreshDriverLocation({ force: true });
        }, [refreshDriverLocation])
    );

    useEffect(() => {
        Animated.loop(Animated.sequence([
            Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])).start();
        Animated.loop(Animated.timing(searchSpin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })).start();
    }, [pulse, searchSpin]);

    useEffect(() => {
        Animated.spring(sliderX, { toValue: isOnline ? maxX : 0, speed: 18, bounciness: 4, useNativeDriver: false }).start();
    }, [isOnline, maxX, sliderX]);

    // Center the map on the driver once when GPS first locks on.
    // Subsequent location updates move the marker but don't fight the user's
    // manual panning or cause a setMapRegion ↔ onRegionChangeComplete loop.
    const hasCenteredOnceRef = useRef(false);
    useEffect(() => {
        if (!hasRealLocation || hasCenteredOnceRef.current) {
            return;
        }

        hasCenteredOnceRef.current = true;
        const nextRegion = {
            ...mapRegionRef.current,
            latitude: driverCoords.latitude,
            longitude: driverCoords.longitude,
        };

        setMapRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 500);
    }, [driverCoords.latitude, driverCoords.longitude, hasRealLocation]);

    useEffect(() => {
        if (!currentOrder || !currentOrderPickup || !mapRef.current) return;
        const coords = [currentOrderPickup];
        if (currentOrderDropoff) coords.push(currentOrderDropoff);
        if (hasRealLocation) coords.push(driverCoords);
        mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 140, right: 60, bottom: 200, left: 60 },
            animated: true,
        });
    }, [currentOrder, currentOrderPickup, currentOrderDropoff, driverCoords.latitude, driverCoords.longitude, hasRealLocation]);

    useEffect(() => {
        if (!isOnline || !hasRealLocation || !nearestMapOrder || !mapRef.current || currentOrder) {
            return;
        }

        mapRef.current.fitToCoordinates([driverCoords, nearestMapOrder.coords], {
            edgePadding: { top: 120, right: 72, bottom: 180, left: 72 },
            animated: true,
        });
    }, [
        currentOrder,
        driverCoords.latitude,
        driverCoords.longitude,
        hasRealLocation,
        isOnline,
        nearestMapOrder?.coords?.latitude,
        nearestMapOrder?.coords?.longitude,
        nearestMapOrder?.order?.id,
    ]);

    useEffect(() => {
        if (!isOnline || !hasRealLocation || currentOrder || nearestMapOrder || !searchVisible || !mapRef.current) {
            return;
        }

        const region = createSearchRegion(driverCoords, currentSearchRadius);
        setMapRegion(region);
        mapRef.current.animateToRegion(region, 650);
    }, [currentOrder, currentSearchRadius, driverCoords.latitude, driverCoords.longitude, hasRealLocation, isOnline, nearestMapOrder, searchVisible]);

    useEffect(() => clearSearchTimers, [clearSearchTimers]);

    useEffect(() => {
        if (!isOnline || currentOrder || !hasRealLocation) {
            clearSearchTimers();
            setSearchVisible(false);
            setSelectedOrder(null);
            if (!currentOrder) setFoundOrder(null);
            return;
        }

        if (foundOrder) {
            setSearchVisible(false);
            return;
        }

        clearSearchTimers();

        if (offerQueue.length > 0) {
            setSearchVisible(true);
            searchTimeoutRef.current = setTimeout(() => {
                const nextOffer = offerQueue[0] ?? null;
                if (!nextOffer) {
                    return;
                }
                setSearchVisible(false);
                setSelectedOrder(nextOffer);
                setFoundOrder(nextOffer.order);
                setCountdown(ORDER_OFFER_SECONDS);
            }, SEARCH_REVEAL_DELAY_MS);
            return;
        }

        setSelectedOrder(null);
        setFoundOrder(null);
        setSearchVisible(true);

        if (searchPhase < searchRadiusSteps.length - 1) {
            searchTimeoutRef.current = setTimeout(() => {
                setSearchPhase((current) => Math.min(current + 1, searchRadiusSteps.length - 1));
            }, SEARCH_PHASE_DELAY_MS);
        } else {
            // All phases exhausted — restart search cycle after 30s
            searchTimeoutRef.current = setTimeout(() => {
                setDismissedOrderIds([]);
                setSearchPhase(0);
            }, SEARCH_RESTART_MS);
        }
    }, [clearSearchTimers, currentOrder, foundOrder, hasRealLocation, isOnline, offerQueue, searchPhase]);

    useEffect(() => {
        if (!foundOrder) return;
        Vibration.vibrate([0, 400, 150, 400, 150, 400]);
        playNotificationSound();
        const foundCoords = getCoords(foundOrder);
        if (foundCoords && hasRealLocation && mapRef.current) {
            mapRef.current.fitToCoordinates([driverCoords, foundCoords], {
                edgePadding: { top: 120, right: 72, bottom: 320, left: 72 },
                animated: true,
            });
        }
    }, [driverCoords.latitude, driverCoords.longitude, foundOrder, hasRealLocation]);

    useEffect(() => {
        if (!foundOrder) return;
        countdownIntervalRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearSearchTimers();
                    dismissOffer(foundOrder);
                    setSelectedOrder((current: any) => (getOrderId(current?.order) === getOrderId(foundOrder) ? null : current));
                    setFoundOrder(null);
                    return ORDER_OFFER_SECONDS;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, [clearSearchTimers, dismissOffer, foundOrder]);

    const goOnline = useCallback(async () => {
        if (isOnline || isSwitching) return;
        setIsSwitching(true);
        try {
            await startTracking();
            await toggleOnline(true);
            setAcceptedOrder(null);
            setSelectedOrder(null);
            setFoundOrder(null);
            setDismissedOrderIds([]);
            setSearchPhase(0);
            setCountdown(ORDER_OFFER_SECONDS);
        } catch (error) {
            console.error('Error going online:', error);
            Alert.alert('Ошибка', 'Не удалось выйти на линию. Проверьте интернет-соединение.');
        } finally {
            setIsSwitching(false);
        }
    }, [isOnline, isSwitching, startTracking, toggleOnline]);

    const goOffline = useCallback(async () => {
        if (!isOnline || isSwitching) return;
        if (currentOrder) {
            Alert.alert(
                '\u041d\u0435\u0432\u043e\u0437\u043c\u043e\u0436\u043d\u043e \u0443\u0439\u0442\u0438 \u0441 \u043b\u0438\u043d\u0438\u0438',
                '\u0423 \u0432\u0430\u0441 \u0435\u0441\u0442\u044c \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u0437\u0430\u043a\u0430\u0437. \u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u0438\u043b\u0438 \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u0435 \u0437\u0430\u043a\u0430\u0437 \u043f\u0435\u0440\u0435\u0434 \u0443\u0445\u043e\u0434\u043e\u043c \u0441 \u043b\u0438\u043d\u0438\u0438.',
            );
            Animated.spring(sliderX, { toValue: maxX, speed: 18, bounciness: 4, useNativeDriver: false }).start();
            return;
        }
        setIsSwitching(true);
        try {
            await stopTracking();
            await toggleOnline(false);
            clearSearchTimers();
            setSelectedOrder(null);
            setAcceptedOrder(null);
            setFoundOrder(null);
            setSearchVisible(false);
            setDismissedOrderIds([]);
            setCountdown(ORDER_OFFER_SECONDS);
        } catch (error) {
            console.error('Error going offline:', error);
            Alert.alert('Ошибка', 'Не удалось уйти с линии. Попробуйте еще раз.');
        } finally {
            setIsSwitching(false);
        }
    }, [clearSearchTimers, currentOrder, isOnline, isSwitching, maxX, sliderX, stopTracking, toggleOnline]);

    const onReleaseSlider = useCallback(async () => {
        const value = Number((sliderX as any).__getValue?.() ?? 0);
        if (value > maxX * 0.8) return goOnline();
        if (value < maxX * 0.2) return goOffline();
        Animated.spring(sliderX, { toValue: isOnline ? maxX : 0, speed: 18, bounciness: 4, useNativeDriver: false }).start();
    }, [goOffline, goOnline, isOnline, maxX, sliderX]);

    const sliderPanResponder = useMemo(() => {
        let startX = 0;
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => { startX = Number((sliderX as any).__getValue?.() ?? 0); },
            onPanResponderMove: (_event, gesture) => sliderX.setValue(Math.max(0, Math.min(maxX, startX + gesture.dx))),
            onPanResponderRelease: onReleaseSlider,
            onPanResponderTerminate: onReleaseSlider,
        });
    }, [maxX, onReleaseSlider, sliderX]);

    const openOrderScreen = useCallback((order: any, screen: 'OrderModal' | 'Order' = 'OrderModal') => {
        const payload = isSdkOrder(order) ? order.serialize() : order;
        navigation.navigate('DriverTaskTab' as never, { screen, params: { order: payload } } as never);
    }, [navigation]);

    const advanceOrderStatus = useCallback(async () => {
        if (!currentOrder || isAdvancing) return;
        const status = getOrderStatus(currentOrder);
        const stage = getCourierWorkflowStage({ status, isAdhoc: false, isAssigned: true });
        const stopType = getCurrentStopType(currentOrder);
        const podRequired = getOrderPodRequired(currentOrder);
        const atDropoff = stopType === 'dropoff';

        // POD required at dropoff → open Order screen (camera/QR/signature)
        if (stage === 'active' && atDropoff && podRequired) {
            openOrderScreen(currentOrder, 'Order');
            return;
        }

        setIsAdvancing(true);
        try {
            if (stage === 'accepted') {
                try {
                    await currentOrder.start();
                } catch (err: any) {
                    const msg = (err?.message ?? '').toLowerCase();
                    if (msg.includes('not been dispatched')) {
                        await currentOrder.start({ skipDispatch: true });
                    } else {
                        throw err;
                    }
                }
            } else if (stage === 'enroute' || stage === 'active') {
                const waypointId = getCurrentWaypointId(currentOrder);
                const activities = await currentOrder.getNextActivity(waypointId ? { waypoint: waypointId } : {});
                const nextActivities = (Array.isArray(activities) ? activities : [activities]).filter(Boolean);
                const first = nextActivities[0];
                if (!first) return;

                // Don't auto-apply terminal statuses — open Order screen instead
                const activityStatus = String(first.status ?? first.code ?? '').toLowerCase();
                if (TERMINAL_ORDER_STATUSES.has(activityStatus)) {
                    openOrderScreen(currentOrder, 'Order');
                    return;
                }

                // At dropoff: if activity requires POD or multiple choices — open Order screen
                if (atDropoff && (first.require_pod || nextActivities.length > 1)) {
                    openOrderScreen(currentOrder, 'Order');
                    return;
                }

                // Multiple choices — open Order screen to let user pick
                if (nextActivities.length > 1) {
                    openOrderScreen(currentOrder, 'Order');
                    return;
                }

                await currentOrder.updateActivity({ activity: first });
            }
            reloadActiveOrders({}, { setLoadingFlag: false });
            reloadCurrentOrders({}, { setLoadingFlag: false });
        } catch (err) {
            console.warn('Error advancing order status:', err);
            Alert.alert('\u041e\u0448\u0438\u0431\u043a\u0430', '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441.');
        } finally {
            setIsAdvancing(false);
        }
    }, [currentOrder, isAdvancing, openOrderScreen, reloadActiveOrders, reloadCurrentOrders]);

    const centerOnMe = useCallback(async () => {
        if (!mapRef.current) return;
        if (hasRealLocation) {
            mapRef.current.animateToRegion({
                latitude: driverCoords.latitude,
                longitude: driverCoords.longitude,
                latitudeDelta: DEFAULT_LAT_DELTA,
                longitudeDelta: DEFAULT_LNG_DELTA,
            }, 400);
            return;
        }
        const result = await refreshDriverLocation({ force: true });
        if (result?.coords && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: result.coords.latitude,
                longitude: result.coords.longitude,
                latitudeDelta: DEFAULT_LAT_DELTA,
                longitudeDelta: DEFAULT_LNG_DELTA,
            }, 400);
        }
    }, [driverCoords.latitude, driverCoords.longitude, hasRealLocation, refreshDriverLocation]);

    const activeSearchPhase = isSearchExhausted
        ? searchPhases[searchPhases.length - 1]
        : searchPhases[Math.min(searchPhase, searchPhases.length - 1)];
    const fillWidth = sliderX.interpolate({ inputRange: [0, Math.max(maxX, 1)], outputRange: [0, Math.max(maxX + 36, 36)], extrapolate: 'clamp' });
    const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
    const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
    const searchRotation = searchSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const ringProgress = (countdown / ORDER_OFFER_SECONDS) * 113;
    const topInset = Math.max(insets.top, 0);
    const currentRadiusLabel = formatRadiusLabel(currentSearchRadius);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <View style={[styles.glassHeader, { paddingTop: topInset, height: topInset + 48 }]}>
                {Platform.OS === 'ios' ? (
                    <BlurView
                        style={StyleSheet.absoluteFill}
                        blurType="light"
                        blurAmount={24}
                        reducedTransparencyFallbackColor="rgba(242,242,247,0.88)"
                    />
                ) : null}
                <View style={styles.glassHeaderBg} />
                <View style={styles.glassHeaderContent}>
                    <Pressable
                        style={styles.supportButton}
                        onPress={() => navigation.navigate('DriverChatTab' as never)}
                        android_ripple={lightRipple}
                    >
                        <Svg width={18} height={18} viewBox="0 0 24 24">
                            <Path
                                fill={COLORS.navy}
                                d="M20 4H4c-1.1 0-2 .9-2 2v15l4-3h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"
                            />
                        </Svg>
                        {unreadCount ? (
                            <View style={styles.supportBadge}>
                                <Text style={styles.supportBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                            </View>
                        ) : null}
                    </Pressable>
                    <Text style={styles.navTitle}>{'\u0413\u043b\u0430\u0432\u043d\u0430\u044f'}</Text>
                </View>
                <View style={styles.glassHeaderBorder} />
            </View>
            <View style={styles.panel}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.mapBackground}
                    initialRegion={mapRegion}
                    customMapStyle={MAP_STYLE}
                    showsCompass={false}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    onRegionChangeComplete={(region) => setMapRegion(region)}
                >
                    {hasRealLocation && showSearchVisuals ? (
                        <MapCircle
                            center={driverCoords}
                            radius={currentSearchRadius * 0.2}
                            strokeColor="rgba(153,26,78,0.25)"
                            fillColor="rgba(153,26,78,0.03)"
                            strokeWidth={1.5}
                        />
                    ) : null}
                    {hasRealLocation ? (
                        <Marker coordinate={driverCoords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={showSearchVisuals}>
                            <View style={styles.driverMarkerWrap}>
                                <View style={styles.locationPulseStatic} />
                                {showSearchVisuals ? (
                                    <View style={styles.searchRadiusBadge}>
                                        <Text style={styles.searchRadiusBadgeValue}>{currentRadiusLabel}</Text>
                                        <Text style={styles.searchRadiusBadgeLabel}>{'\u043f\u043e\u0438\u0441\u043a'}</Text>
                                    </View>
                                ) : null}
                                <View style={styles.locationAvatarWrap}>
                                    {driverPhotoUrl ? (
                                        <Image source={{ uri: driverPhotoUrl }} style={styles.locationAvatarImage} />
                                    ) : (
                                        <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={styles.locationAvatar}><Text style={styles.locationAvatarText}>{driverInitial}</Text></LinearGradient>
                                    )}
                                </View>
                            </View>
                        </Marker>
                    ) : null}
                    {currentOrder && currentOrderPickup ? (
                        <Marker coordinate={currentOrderPickup} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                            <View style={styles.routePin}><View style={[styles.routePinDot, { backgroundColor: COLORS.navy }]}><Text style={styles.routePinText}>A</Text></View></View>
                        </Marker>
                    ) : null}
                    {currentOrder && currentOrderDropoff ? (
                        <Marker coordinate={currentOrderDropoff} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}>
                            <View style={styles.routePin}><View style={[styles.routePinDot, { backgroundColor: COLORS.primary }]}><Text style={styles.routePinText}>B</Text></View></View>
                        </Marker>
                    ) : null}
                    {currentOrder && currentOrderPickup && currentOrderDropoff ? (
                        <MapViewDirections
                            origin={currentOrderPickup}
                            destination={currentOrderDropoff}
                            apikey={config('GOOGLE_MAPS_API_KEY')}
                            strokeWidth={4}
                            strokeColor={COLORS.navy}
                            optimizeWaypoints
                        />
                    ) : null}
                    {currentOrder && hasRealLocation && currentOrderPickup && currentOrderStage !== 'active' ? (
                        <MapViewDirections
                            origin={driverCoords}
                            destination={currentOrderPickup}
                            apikey={config('GOOGLE_MAPS_API_KEY')}
                            strokeWidth={4}
                            strokeColor={COLORS.blue}
                            lineDashPattern={[6, 4]}
                            optimizeWaypoints
                        />
                    ) : null}
                    {currentOrder && hasRealLocation && currentOrderDropoff && currentOrderStage === 'active' ? (
                        <MapViewDirections
                            origin={driverCoords}
                            destination={currentOrderDropoff}
                            apikey={config('GOOGLE_MAPS_API_KEY')}
                            strokeWidth={4}
                            strokeColor={COLORS.primary}
                            lineDashPattern={[6, 4]}
                            optimizeWaypoints
                        />
                    ) : null}
                    {isOnline && !currentOrder ? offerQueue.map((mapOrder: any, index: number) => {
                        const isNearest = index === 0;
                        return (
                            <Marker key={String(getOrderId(mapOrder.order))} coordinate={mapOrder.coords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false} onPress={() => showOrderOffer(mapOrder)}>
                                <View style={[styles.pinCard, isNearest && styles.pinCardNearest]}><View style={[styles.pinIconWrap, isNearest && styles.pinIconWrapNearest]}><Svg width={14} height={14} viewBox="0 0 24 24"><Path fill={isNearest ? '#fff' : COLORS.primary} d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z" /></Svg></View><View><Text style={[styles.pinId, isNearest && styles.pinIdNearest]}>#{getTracking(mapOrder.order)}</Text><Text style={[styles.pinPrice, isNearest && styles.pinPriceNearest]}>{getPriceLabel(mapOrder.order)}</Text><Text style={[styles.pinDistance, isNearest && styles.pinDistanceNearest]}>{mapOrder.distanceKm}</Text></View></View>
                            </Marker>
                        );
                    }) : null}
                    {isOnline ? activeOrders.slice(1).map((order: any) => {
                        const coords = getCoords(order);
                        if (!coords) return null;
                        return (
                            <Marker key={`active-${getOrderId(order)}`} coordinate={coords} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false} onPress={() => openOrderScreen(order, 'Order')}>
                                <View style={styles.routePin}><View style={[styles.routePinDot, { backgroundColor: COLORS.navy }]}><Text style={styles.routePinText}>A</Text></View></View>
                            </Marker>
                        );
                    }) : null}
                </MapView>
                {weather ? (
                    <View style={[styles.weatherChip, { top: topInset + 58 }]}>
                        <Text style={styles.weatherIcon}>{weather.icon}</Text>
                        <View>
                            <Text style={styles.weatherTemp}>{weather.temp > 0 ? '+' : ''}{weather.temp}{'\u00B0'}</Text>
                            <Text style={styles.weatherDesc}>{weather.desc}</Text>
                        </View>
                    </View>
                ) : null}
                <Pressable style={[styles.locateMeBtn, { top: topInset + (weather ? 108 : 58) }]} onPress={centerOnMe} android_ripple={lightRipple}>
                    {!hasRealLocation && isResolvingLocation ? (
                        <ActivityIndicator size="small" color={COLORS.navy} />
                    ) : (
                        <Svg width={22} height={22} viewBox="0 0 24 24">
                            <Path fill={hasRealLocation ? COLORS.navy : COLORS.muted} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                        </Svg>
                    )}
                </Pressable>
                {!isOnline ? (
                    <View style={styles.homeWelcome}><View style={styles.welcomeCard}><LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={styles.welcomeAvatar}><Text style={styles.welcomeAvatarText}>{driverInitial}</Text></LinearGradient><Text style={styles.welcomeGreeting}>{'\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c!'}</Text><Text style={styles.welcomeSub}>{'\u0412\u044b \u043d\u0435 \u043d\u0430 \u043b\u0438\u043d\u0438\u0438. \u0412\u044b\u0439\u0434\u0438\u0442\u0435 \u043d\u0430 \u043b\u0438\u043d\u0438\u044e, \u0447\u0442\u043e\u0431\u044b \u043d\u0430\u0447\u0430\u0442\u044c \u043f\u043e\u043b\u0443\u0447\u0430\u0442\u044c \u0437\u0430\u043a\u0430\u0437\u044b.'}</Text><View style={styles.welcomeStats}><View style={styles.welcomeStat}><Text style={styles.welcomeStatValue}>{248 + allActiveOrders.length}</Text><Text style={styles.welcomeStatLabel}>{'\u0414\u043e\u0441\u0442\u0430\u0432\u043e\u043a'}</Text></View><View style={styles.welcomeStat}><Text style={styles.welcomeStatValue}>4.9</Text><Text style={styles.welcomeStatLabel}>{'\u0420\u0435\u0439\u0442\u0438\u043d\u0433'}</Text></View><View style={styles.welcomeStat}><Text style={styles.welcomeStatValue}>3 200 \u0441</Text><Text style={styles.welcomeStatLabel}>{'\u0421\u0435\u0433\u043e\u0434\u043d\u044f'}</Text></View></View><Pressable style={({ pressed }) => [styles.welcomeCta, pressed && styles.welcomeCtaPressed]} onPress={goOnline} android_ripple={welcomeCtaRipple}><Svg width={18} height={18} viewBox="0 0 24 24"><Path fill="#fff" d="M8 5v14l11-7z" /></Svg><Text style={styles.welcomeCtaText}>{'\u041d\u0430\u0447\u0430\u0442\u044c \u0440\u0430\u0431\u043e\u0442\u0443'}</Text></Pressable><Text style={styles.welcomeHint}>{'\u0421\u0432\u0430\u0439\u043f\u043d\u0438\u0442\u0435 \u0441\u043b\u0430\u0439\u0434\u0435\u0440 \u0432\u043f\u0440\u0430\u0432\u043e'}</Text></View></View>
                ) : null}

                {/* search bar is rendered inside homeBottom below */}

                {foundOrder && foundMapOrder ? (
                    <View style={styles.offerCard}>
                        <View style={styles.offerHeader}>
                            <View style={styles.offerTitleRow}>
                                <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={styles.offerIcon}>
                                    <Svg width={18} height={18} viewBox="0 0 24 24">
                                        <Path fill="#fff" d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z" />
                                    </Svg>
                                </LinearGradient>
                                <View>
                                    <Text style={styles.offerLabel}>{'\u041d\u043e\u0432\u044b\u0439 \u0437\u0430\u043a\u0430\u0437'}</Text>
                                    <Text style={styles.offerTracking}>#{getTracking(foundOrder)}</Text>
                                </View>
                            </View>
                            <View style={styles.offerTimerWrap}>
                                <Svg width={46} height={46} viewBox="0 0 46 46">
                                    <Circle cx={23} cy={23} r={19} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth={3.5} />
                                    <Circle cx={23} cy={23} r={19} fill="none" stroke={countdown > 5 ? COLORS.navy : COLORS.primary} strokeWidth={3.5} strokeDasharray={119.4} strokeDashoffset={119.4 - (countdown / ORDER_OFFER_SECONDS) * 119.4} strokeLinecap="round" rotation={-90} origin="23, 23" />
                                </Svg>
                                <Text style={[styles.offerTimerText, countdown <= 5 && { color: COLORS.primary }]}>{countdown}</Text>
                            </View>
                        </View>
                        <View style={styles.offerRoute}>
                            <View style={styles.offerStop}>
                                <View style={[styles.offerDot, { backgroundColor: COLORS.navy }]}>
                                    <Text style={styles.offerDotLetter}>A</Text>
                                </View>
                                <Text style={styles.offerAddr} numberOfLines={1}>{getPickup(foundOrder)}</Text>
                            </View>
                            <View style={styles.offerConnector} />
                            <View style={styles.offerStop}>
                                <View style={[styles.offerDot, { backgroundColor: COLORS.primary }]}>
                                    <Text style={styles.offerDotLetter}>B</Text>
                                </View>
                                <Text style={styles.offerAddr} numberOfLines={1}>{getDropoff(foundOrder)}</Text>
                            </View>
                        </View>
                        <View style={styles.offerMeta}>
                            <View style={styles.offerMetaChip}>
                                <Text style={styles.offerMetaValue}>{foundMapOrder.routeDistanceKm}</Text>
                                <Text style={styles.offerMetaLabel}>{'\u0420\u0430\u0441\u0441\u0442\u043e\u044f\u043d\u0438\u0435'}</Text>
                            </View>
                            <View style={styles.offerMetaChip}>
                                <Text style={styles.offerMetaValue}>{getEta(foundOrder)}</Text>
                                <Text style={styles.offerMetaLabel}>{'~\u0412\u0440\u0435\u043c\u044f'}</Text>
                            </View>
                            <View style={styles.offerMetaChip}>
                                <Text style={styles.offerMetaValue}>{getPriceLabel(foundOrder)}</Text>
                                <Text style={styles.offerMetaLabel}>{'\u0421\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c'}</Text>
                            </View>
                        </View>
                        <View style={styles.offerActions}>
                            <Pressable style={styles.offerSkipBtn} onPress={() => { clearSearchTimers(); dismissOffer(foundOrder); setSelectedOrder((current: any) => (getOrderId(current?.order) === getOrderId(foundOrder) ? null : current)); setFoundOrder(null); }} android_ripple={lightRipple}>
                                <Text style={styles.offerSkipText}>{'\u041f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c'}</Text>
                            </Pressable>
                            <Pressable style={styles.offerAcceptWrap} onPress={() => acceptOffer(foundOrder)} disabled={isAcceptingOffer} android_ripple={darkRipple}>
                                <LinearGradient colors={[COLORS.primary, COLORS.primaryLight]} style={[styles.offerAcceptBtn, isAcceptingOffer && { opacity: 0.7 }]}>
                                    {isAcceptingOffer ? <ActivityIndicator color="#fff" size="small" /> : (
                                        <>
                                            <Svg width={20} height={20} viewBox="0 0 24 24">
                                                <Path fill="#fff" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                            </Svg>
                                            <Text style={styles.offerAcceptText}>{'\u041f\u0440\u0438\u043d\u044f\u0442\u044c'}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </Pressable>
                        </View>
                    </View>
                ) : null}

                <View style={styles.homeBottom}>{isOnline && currentOrder ? (
                    <View style={styles.activeCard}>
                        <Pressable style={styles.activeCardInfo} onPress={() => openOrderScreen(currentOrder, 'Order')} android_ripple={lightRipple}>
                            <View style={styles.activeCardHeader}>
                                <View style={styles.activeCardTitleRow}>
                                    <LinearGradient colors={[COLORS.navy, COLORS.navyMid]} style={styles.activeCardIcon}>
                                        <Svg width={14} height={14} viewBox="0 0 24 24"><Path fill="#fff" d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27z" /></Svg>
                                    </LinearGradient>
                                    <Text style={styles.activeCardTracking}>#{getTracking(currentOrder)}</Text>
                                </View>
                                <View style={styles.activeCardBadge}>
                                    <Text style={styles.activeCardBadgeText}>{getOrderStatusLabel(getOrderStatus(currentOrder))}</Text>
                                </View>
                            </View>
                            <View style={styles.activeCardRoute}>
                                <View style={styles.activeCardStop}><View style={[styles.activeCardDot, { backgroundColor: COLORS.navy }]}><Text style={styles.activeCardDotText}>A</Text></View><Text style={styles.activeCardAddr} numberOfLines={1}>{getPickup(currentOrder)}</Text></View>
                                <View style={styles.activeCardConnector} />
                                <View style={styles.activeCardStop}><View style={[styles.activeCardDot, { backgroundColor: COLORS.primary }]}><Text style={styles.activeCardDotText}>B</Text></View><Text style={styles.activeCardAddr} numberOfLines={1}>{getDropoff(currentOrder)}</Text></View>
                            </View>
                        </Pressable>
                        {getStatusActionLabel(currentOrder) ? (
                            <Pressable style={styles.statusBtnWrap} onPress={advanceOrderStatus} disabled={isAdvancing} android_ripple={darkRipple}>
                                <LinearGradient colors={getStatusBtnColors(currentOrder)} style={styles.statusBtn}>
                                    {isAdvancing ? <ActivityIndicator color="#fff" size="small" /> : (
                                        <>
                                            {isStatusPod(currentOrder) ? (
                                                <Svg width={18} height={18} viewBox="0 0 24 24"><Path fill="#fff" d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" /></Svg>
                                            ) : (
                                                <Svg width={18} height={18} viewBox="0 0 24 24"><Path fill="#fff" d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" /></Svg>
                                            )}
                                            <Text style={styles.statusBtnText}>{getStatusActionLabel(currentOrder)}</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </Pressable>
                        ) : null}
                    </View>
                ) : null}{searchVisible ? (
                    <View style={styles.searchBar}>
                        <Animated.View style={[styles.searchBarSpinner, { transform: [{ rotate: searchRotation }] }]} />
                        <View style={styles.searchBarInfo}>
                            <Text style={styles.searchBarTitle}>{activeSearchPhase.title}</Text>
                            <View style={styles.searchBarProgress}><View style={[styles.searchBarFill, { width: activeSearchPhase.percent }]} /></View>
                        </View>
                        <Text style={styles.searchBarRadius}>{activeSearchPhase.radius}</Text>
                    </View>
                ) : null}<View style={styles.sliderWrap}><View style={styles.sliderTrack} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}><Animated.View style={[styles.sliderFill, { width: fillWidth }]} /><Animated.View style={[styles.sliderHandle, { transform: [{ translateX: sliderX }] }]} {...sliderPanResponder.panHandlers}><View style={[styles.sliderHandleInner, isOnline && styles.sliderHandleInnerOn]}><Text style={styles.sliderHandleIcon}>{isOnline ? '\u25B6' : '\u25A0'}</Text></View></Animated.View><View style={styles.sliderTextRow}><View style={[styles.sliderDot, isOnline ? styles.sliderDotOn : styles.sliderDotOff]} /><Text style={[styles.sliderText, isOnline ? styles.sliderTextOn : styles.sliderTextOff]}>{isOnline ? '\u041d\u0430 \u043b\u0438\u043d\u0438\u0438' : '\u0412\u044b\u0439\u0442\u0438 \u043d\u0430 \u043b\u0438\u043d\u0438\u044e'}</Text></View>{!isOnline ? <Text style={styles.sliderArrows}>{'\u203A \u203A \u203A'}</Text> : null}</View></View></View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    glassHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, overflow: 'hidden' },
    glassHeaderBg: { ...StyleSheet.absoluteFillObject, backgroundColor: Platform.select({ ios: 'rgba(242,242,247,0.72)', android: 'rgba(242,242,247,0.82)' }) },
    glassHeaderContent: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
    glassHeaderBorder: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(0,0,0,0.08)' },
    navTitle: { fontSize: 17, fontFamily: FONTS.bold, color: COLORS.text },
    supportButton: { position: 'absolute', right: 14, bottom: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.68)', overflow: 'hidden' },
    supportBadge: { position: 'absolute', top: 3, right: 2, minWidth: 14, height: 14, borderRadius: 7, paddingHorizontal: 3, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    supportBadgeText: { fontSize: 8, fontFamily: FONTS.bold, color: '#fff' },
    panel: { flex: 1 },
    mapBackground: { ...StyleSheet.absoluteFillObject },
    driverMarkerWrap: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' },
    locationPulseStatic: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(42,171,238,0.12)' },
    searchRadiusBadge: { position: 'absolute', top: 0, minWidth: 58, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
    searchRadiusBadgeValue: { fontSize: 13, fontFamily: FONTS.black, color: COLORS.primary },
    searchRadiusBadgeLabel: { marginTop: 1, fontSize: 9, fontFamily: FONTS.medium, color: COLORS.muted, textTransform: 'uppercase' },
    locationAvatarWrap: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, borderColor: COLORS.blue, overflow: 'hidden' },
    locationAvatar: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    locationAvatarImage: { width: '100%', height: '100%', borderRadius: 18 },
    locationAvatarText: { color: '#fff', fontSize: 14, fontFamily: FONTS.black },
    pinCard: { minWidth: 96, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 11, borderWidth: 1, borderColor: 'rgba(153,26,78,0.28)' },
    pinCardNearest: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 5 },
    pinIconWrap: { width: 24, height: 24, borderRadius: 7, backgroundColor: 'rgba(153,26,78,0.09)', alignItems: 'center', justifyContent: 'center' },
    pinIconWrapNearest: { backgroundColor: 'rgba(255,255,255,0.18)' },
    pinId: { fontSize: 9, fontWeight: '600', color: COLORS.muted },
    pinIdNearest: { color: 'rgba(255,255,255,0.72)' },
    pinPrice: { fontSize: 12, fontWeight: '800', color: COLORS.text },
    pinPriceNearest: { color: '#fff' },
    pinDistance: { marginTop: 1, fontSize: 10, fontFamily: FONTS.medium, color: COLORS.primary },
    pinDistanceNearest: { color: 'rgba(255,255,255,0.88)' },
    homeWelcome: { ...StyleSheet.absoluteFillObject, zIndex: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 120 },
    welcomeCard: { width: '100%', maxWidth: 310, borderRadius: 24, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 22, backgroundColor: 'rgba(255,255,255,0.93)' },
    welcomeAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
    welcomeAvatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
    welcomeGreeting: { fontSize: 20, fontFamily: FONTS.bold, color: '#000', textAlign: 'center', marginBottom: 6 },
    welcomeSub: { fontSize: 13, lineHeight: 19, fontFamily: FONTS.regular, color: '#6D6D72', textAlign: 'center', marginBottom: 18 },
    welcomeStats: { flexDirection: 'row', gap: 8, marginBottom: 18 },
    welcomeStat: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
    welcomeStatValue: { fontSize: 17, fontFamily: FONTS.bold, color: '#000' },
    welcomeStatLabel: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.muted, marginTop: 2 },
    welcomeCta: { height: 48, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, overflow: 'hidden', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 3 },
    welcomeCtaPressed: { opacity: 0.96, transform: [{ scale: 0.985 }] },
    welcomeCtaText: { fontSize: 15, fontFamily: FONTS.bold, color: '#fff' },
    welcomeHint: { marginTop: 10, textAlign: 'center', fontSize: 11, fontFamily: FONTS.medium, color: COLORS.lightMuted },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.93)' },
    searchBarSpinner: { width: 24, height: 24, borderRadius: 12, borderWidth: 2.5, borderColor: 'rgba(153,26,78,0.15)', borderTopColor: COLORS.primary },
    searchBarInfo: { flex: 1 },
    searchBarTitle: { fontSize: 13, fontFamily: FONTS.bold, color: COLORS.text, marginBottom: 4 },
    searchBarProgress: { height: 3, borderRadius: 1.5, backgroundColor: '#E5E5EA', overflow: 'hidden' },
    searchBarFill: { height: '100%', borderRadius: 1.5, backgroundColor: COLORS.primary },
    searchBarRadius: { fontSize: 12, fontFamily: FONTS.black, color: COLORS.primary },
    offerCard: { position: 'absolute', left: 12, right: 12, bottom: 158, zIndex: 30, borderRadius: 22, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18, shadowColor: '#18213D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 24, elevation: 10 },
    offerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    offerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    offerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    offerLabel: { fontSize: 12, fontFamily: FONTS.medium, color: COLORS.muted, marginBottom: 1 },
    offerTracking: { fontSize: 22, fontFamily: FONTS.black, color: COLORS.text },
    offerTimerWrap: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
    offerTimerText: { position: 'absolute', fontSize: 16, fontFamily: FONTS.black, color: COLORS.navy },
    offerRoute: { marginBottom: 14 },
    offerStop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    offerDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    offerDotLetter: { fontSize: 14, fontFamily: FONTS.black, color: '#fff' },
    offerConnector: { width: 3, height: 14, borderRadius: 1.5, backgroundColor: '#E5E5EA', marginLeft: 13.5, marginVertical: 2 },
    offerAddr: { flex: 1, fontSize: 15, fontFamily: FONTS.regular, color: COLORS.text },
    offerMeta: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    offerMetaChip: { flex: 1, borderRadius: 12, backgroundColor: COLORS.background, paddingVertical: 10, alignItems: 'center' },
    offerMetaValue: { fontSize: 15, fontFamily: FONTS.bold, color: COLORS.text },
    offerMetaLabel: { marginTop: 2, fontSize: 10, fontFamily: FONTS.medium, color: COLORS.muted },
    offerActions: { flexDirection: 'row', gap: 10 },
    offerSkipBtn: { flex: 1, height: 56, borderRadius: 16, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    offerSkipText: { fontSize: 16, fontFamily: FONTS.bold, color: COLORS.muted },
    offerAcceptWrap: { flex: 2, borderRadius: 16, overflow: 'hidden' },
    offerAcceptBtn: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    offerAcceptText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },
    homeBottom: { position: 'absolute', left: 12, right: 12, bottom: 85, zIndex: 20 },
    activeCard: { marginBottom: 8, borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden', shadowColor: '#18213D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6 },
    activeCardInfo: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, overflow: 'hidden' },
    activeCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    activeCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    activeCardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    activeCardTracking: { fontSize: 18, fontFamily: FONTS.black, color: COLORS.text },
    activeCardBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(20,42,101,0.08)' },
    activeCardBadgeText: { fontSize: 12, fontFamily: FONTS.bold, color: COLORS.navy },
    activeCardRoute: { gap: 2 },
    activeCardStop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    activeCardDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    activeCardDotText: { fontSize: 11, fontFamily: FONTS.black, color: '#fff' },
    activeCardConnector: { width: 2, height: 10, backgroundColor: '#E5E5EA', marginLeft: 10 },
    activeCardAddr: { flex: 1, fontSize: 13, fontFamily: FONTS.regular, color: COLORS.text },
    statusBtnWrap: { marginHorizontal: 12, marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
    statusBtn: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14 },
    statusBtnText: { fontSize: 16, fontFamily: FONTS.bold, color: '#fff' },
    sliderWrap: { height: 52, padding: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.93)' },
    sliderTrack: { height: 40, borderRadius: 14, backgroundColor: '#E9E9EF', overflow: 'hidden', justifyContent: 'center' },
    sliderFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 14, backgroundColor: 'rgba(153,26,78,0.11)' },
    sliderHandle: { position: 'absolute', top: 4, left: 4, width: HANDLE_SIZE, height: HANDLE_SIZE, borderRadius: 10, overflow: 'hidden' },
    sliderHandleInner: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#AEAEB2' },
    sliderHandleInnerOn: { backgroundColor: COLORS.primary },
    sliderHandleIcon: { color: '#fff', fontSize: 14 },
    sliderTextRow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
    sliderDot: { width: 7, height: 7, borderRadius: 4 },
    sliderDotOff: { backgroundColor: '#C7C7CC' },
    sliderDotOn: { backgroundColor: COLORS.primary },
    sliderText: { fontSize: 13, fontFamily: FONTS.bold, letterSpacing: 0.4 },
    sliderTextOff: { color: COLORS.muted },
    sliderTextOn: { color: COLORS.primary },
    sliderArrows: { position: 'absolute', right: 18, top: 12, fontSize: 13, fontFamily: FONTS.medium, color: '#C7C7CC' },
    routePin: { alignItems: 'center' },
    routePinDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4 },
    routePinText: { fontSize: 12, fontFamily: FONTS.black, color: '#fff' },
    weatherChip: { position: 'absolute', right: 12, zIndex: 15, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.94)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
    weatherIcon: { fontSize: 20 },
    weatherTemp: { fontSize: 14, fontFamily: FONTS.bold, color: COLORS.text },
    weatherDesc: { fontSize: 10, fontFamily: FONTS.medium, color: COLORS.muted },
    locateMeBtn: { position: 'absolute', right: 12, zIndex: 15, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4, overflow: 'hidden' },
});

export default DriverDashboardScreen;
