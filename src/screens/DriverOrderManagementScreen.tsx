import { useRef, useEffect, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { FlatList, RefreshControl, Platform } from 'react-native';
import { Text, YStack, XStack, Separator, useTheme } from 'tamagui';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { endOfYear, format, startOfYear, subDays } from 'date-fns';
import { formatDuration, formatMeters } from '../utils/format';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import useSocketClusterClient from '../hooks/use-socket-cluster-client';
import CalendarStrip from 'react-native-calendar-strip';
import OrderCard from '../components/OrderCard';
import PastOrderCard from '../components/PastOrderCard';
import AdhocOrderCard from '../components/AdhocOrderCard';
import Spacer from '../components/Spacer';

const isAndroid = Platform.OS === 'android';
const BULLET = '\u2022';
const REFRESH_NEARBY_ORDERS_MS = 6000 * 5;
const REFRESH_ORDERS_MS = 6000 * 15;

const countStops = (orders = []) =>
    orders.reduce((total, order) => {
        const { pickup, dropoff, waypoints = [] } = order.getAttribute('payload') || {};
        const stops = [pickup, dropoff, ...waypoints].filter(Boolean);
        return total + stops.length;
    }, 0);

const sumDuration = (orders = []) => orders.reduce((total, order) => total + order.getAttribute('time'), 0);
const sumDistance = (orders = []) => orders.reduce((total, order) => total + order.getAttribute('distance'), 0);

const DriverOrderManagementScreen = () => {
    const theme = useTheme();
    const { t } = useLanguage();
    const navigation = useNavigation();
    const calendar = useRef();
    const listenerRef = useRef();
    const { driver } = useAuth();
    const {
        allActiveOrders,
        currentOrders,
        setCurrentDate,
        currentDate,
        reloadCurrentOrders,
        reloadActiveOrders,
        isFetchingCurrentOrders,
        activeOrderMarkedDates,
        nearbyOrders,
        reloadNearbyOrders,
        dismissedOrders,
        setDimissedOrders,
    } = useOrderManager();
    const { listen } = useSocketClusterClient();
    const { addNotificationListener, removeNotificationListener } = useNotification();
    const startingDate = subDays(new Date(currentDate), 2);
    const datesWhitelist = [new Date(), { start: startOfYear(new Date()), end: endOfYear(new Date()) }];
    const todayString = format(new Date(currentDate), 'EEEE');
    const activeCurrentOrders = currentOrders.filter((order) => !['completed', 'created', 'canceled'].includes(order.getAttribute('status')));
    const stops = countStops(activeCurrentOrders);
    const distance = sumDistance(activeCurrentOrders);
    const duration = sumDuration(activeCurrentOrders);

    useEffect(() => {
        const handlePushNotification = async (notification) => {
            const { payload } = notification;
            const id = payload.id;

            if (typeof id === 'string' && id.startsWith('order_')) {
                reloadCurrentOrders();
            }
        };

        addNotificationListener(handlePushNotification);
        return () => removeNotificationListener(handlePushNotification);
    }, [addNotificationListener, removeNotificationListener, reloadCurrentOrders]);

    useFocusEffect(
        useCallback(() => {
            const handleReloadNearbyOrders = () => {
                reloadNearbyOrders({}, { setLoadingFlag: false });
            };

            const interval = setInterval(handleReloadNearbyOrders, REFRESH_NEARBY_ORDERS_MS);
            return () => clearInterval(interval);
        }, [reloadNearbyOrders])
    );

    useFocusEffect(
        useCallback(() => {
            const handleReloadCurrentOrders = () => {
                reloadCurrentOrders({}, { setLoadingFlag: false });
            };

            reloadActiveOrders();
            handleReloadCurrentOrders();

            const interval = setInterval(handleReloadCurrentOrders, REFRESH_ORDERS_MS);
            return () => clearInterval(interval);
        }, [currentDate, reloadCurrentOrders, reloadActiveOrders])
    );

    useFocusEffect(
        useCallback(() => {
            const listenForOrderUpdates = async () => {
                const listener = await listen(`driver.${driver.id}`, ({ event }) => {
                    if (typeof event === 'string' && event === 'order.ready') {
                        reloadCurrentOrders();
                    }
                    if (typeof event === 'string' && event === 'order.ping') {
                        reloadNearbyOrders();
                    }
                });
                if (listener) {
                    listenerRef.current = listener;
                }
            };

            listenForOrderUpdates();

            return () => {
                if (listenerRef.current) {
                    listenerRef.current.stop();
                }
            };
        }, [listen, driver.id, reloadCurrentOrders, reloadNearbyOrders])
    );

    const handleAdhocDismissal = useCallback(
        (order) => {
            setDimissedOrders((prevDismissedOrders) => [...prevDismissedOrders, order.id]);
        },
        [setDimissedOrders]
    );

    const handleAdhocAccept = useCallback(() => {
        reloadNearbyOrders();
        reloadCurrentOrders();
    }, [reloadNearbyOrders, reloadCurrentOrders]);

    const renderOrder = ({ item: order }) => {
        const isAdhocOrder = order.getAttribute('adhoc') === true && order.getAttribute('driver_assigned') === null;
        if (isAdhocOrder) {
            if (dismissedOrders.includes(order.id)) return null;
            return (
                <YStack px='$2' py='$4'>
                    <AdhocOrderCard
                        order={order}
                        onPress={() => navigation.navigate('OrderModal', { order: order.serialize() })}
                        onDismiss={handleAdhocDismissal}
                        onAccept={handleAdhocAccept}
                    />
                </YStack>
            );
        }

        return (
            <YStack px='$2' py='$4'>
                <OrderCard order={order} onPress={() => navigation.navigate('Order', { order: order.serialize() })} />
            </YStack>
        );
    };

    const ActiveOrders = () => {
        if (!allActiveOrders.length) return null;

        return (
            <YStack>
                <YStack px='$1'>
                    <Text color='$textPrimary' fontSize={18} fontWeight='bold'>
                        {t('DriverOrderManagement.activeOrdersCount', { count: allActiveOrders.length })}
                    </Text>
                </YStack>
                <YStack>
                    <FlatList
                        data={allActiveOrders}
                        keyExtractor={(order) => order.id.toString()}
                        renderItem={({ item: order }) => (
                            <YStack py='$3'>
                                <PastOrderCard order={order} onPress={() => navigation.navigate('Order', { order: order.serialize() })} />
                            </YStack>
                        )}
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                        ItemSeparatorComponent={() => <Separator borderBottomWidth={1} borderColor='$borderColorWithShadow' />}
                    />
                </YStack>
            </YStack>
        );
    };

    const NoOrders = () => {
        return (
            <YStack py='$5' px='$3' space='$6' flex={1} height='100%'>
                <YStack alignItems='center'>
                    <XStack alignItems='center' bg='$surface' borderWidth={1} borderColor='$borderColor' space='$2' px='$3' py='$2' borderRadius='$5' width='100%' flexWrap='wrap'>
                        <FontAwesomeIcon icon={faInfoCircle} color={theme.primary.val} />
                        <Text color='$textPrimary' fontSize={16}>
                            {t('DriverOrderManagement.noCurrentOrdersForDate', { date: format(new Date(currentDate), 'yyyy-MM-dd') })}
                        </Text>
                    </XStack>
                </YStack>
                <ActiveOrders />
            </YStack>
        );
    };

    return (
        <YStack flex={1} bg='$background'>
            <YStack
                bg='$background'
                pb='$2'
                borderBottomWidth={1}
                borderColor='$borderColor'
            >
                <CalendarStrip
                    scrollable
                    ref={calendar}
                    datesWhitelist={datesWhitelist}
                    style={{ height: 100, paddingTop: 10, paddingBottom: 15 }}
                    calendarColor='transparent'
                    calendarHeaderStyle={{ color: theme.textPrimary.val, fontSize: 14 }}
                    calendarHeaderContainerStyle={{ marginBottom: 20 }}
                    dateNumberStyle={{ color: theme.textSecondary.val, fontSize: 12 }}
                    dateNameStyle={{ color: theme.textSecondary.val, fontSize: 12 }}
                    dayContainerStyle={{ padding: 0, height: isAndroid ? 55 : 60 }}
                    highlightDateNameStyle={{ color: theme.primaryText.val, fontSize: 12 }}
                    highlightDateNumberStyle={{ color: theme.primaryText.val, fontSize: 12 }}
                    highlightDateContainerStyle={{ backgroundColor: theme.primary.val, borderRadius: 6, borderWidth: 1, borderColor: theme.primaryBorder.val }}
                    iconContainer={{ flex: 0.1 }}
                    numDaysInWeek={5}
                    markedDates={activeOrderMarkedDates}
                    startingDate={startingDate}
                    selectedDate={new Date(currentDate)}
                    onDateSelected={(selectedDate) => setCurrentDate(format(new Date(selectedDate), 'yyyy-MM-dd HH:mm:ssXXX'))}
                    iconLeft={require('../../assets/nv-arrow-left.png')}
                    iconRight={require('../../assets/nv-arrow-right.png')}
                />
            </YStack>

            <YStack bg='$surface' px='$3' py='$4' borderWidth={1} borderColor='$borderColor' borderRadius='$6' mx='$3' mt='$2'>
                <Text color='$textPrimary' fontSize='$8' fontWeight='bold' mb='$1'>
                    {t('DriverOrderManagement.ordersForDay', { day: todayString })}
                </Text>
                <XStack space='$2' alignItems='center'>
                    <Text color='$textSecondary' fontSize='$5'>
                        {t('DriverOrderManagement.ordersCount', { count: currentOrders.length })}
                    </Text>
                    <Text color='$textSecondary' fontSize='$5'>{BULLET}</Text>
                    <Text color='$textSecondary' fontSize='$5'>
                        {t('DriverOrderManagement.stopsLeft', { count: stops })}
                    </Text>
                    <Text color='$textSecondary' fontSize='$5'>{BULLET}</Text>
                    <Text color='$textSecondary' fontSize='$5'>
                        {formatDuration(duration)}
                    </Text>
                    <Text color='$textSecondary' fontSize='$5'>{BULLET}</Text>
                    <Text color='$textSecondary' fontSize='$5'>
                        {formatMeters(distance)}
                    </Text>
                </XStack>
            </YStack>

            <FlatList
                data={[...nearbyOrders, ...currentOrders]}
                keyExtractor={(order, index) => `${order.id}_${index}`}
                renderItem={renderOrder}
                refreshControl={<RefreshControl refreshing={isFetchingCurrentOrders} onRefresh={reloadCurrentOrders} tintColor={theme.primary.val} />}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                ItemSeparatorComponent={() => <Separator borderBottomWidth={1} borderColor='$borderColor' />}
                ListFooterComponent={<Spacer height={200} />}
                ListEmptyComponent={<NoOrders />}
            />
        </YStack>
    );
};

export default DriverOrderManagementScreen;
