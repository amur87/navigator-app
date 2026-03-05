import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMapMarkerAlt, faGaugeHigh, faListCheck, faPlay, faComments } from '@fortawesome/free-solid-svg-icons';
import { Button, Text, YStack, XStack, useTheme, Card, Separator } from 'tamagui';
import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE, type MapStyleElement } from 'react-native-maps';
import { useLocation } from '../contexts/LocationContext';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import useAppTheme from '../hooks/use-app-theme';

const DEFAULT_LAT = 42.8746;
const DEFAULT_LNG = 74.5698;

const DEFAULT_LAT_DELTA = 0.025;
const DEFAULT_LNG_DELTA = 0.025;

// Dark map style for Google Maps. (Light mode uses the default Google style.)
const GOOGLE_MAPS_DARK_STYLE: MapStyleElement[] = [
    { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
    { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
    { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
    { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
    { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
    { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
    { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
    { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#023e58' }] },
    { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
    { featureType: 'transit', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
    { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
    { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#3a4762' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

const DriverDashboardScreen = () => {
    const theme = useTheme();
    const { t } = useLanguage();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { location, startTracking, stopTracking } = useLocation();
    const { isOnline, toggleOnline } = useAuth();
    const { allActiveOrders } = useOrderManager();
    const { isDarkMode } = useAppTheme();
    const mapRef = useRef<MapView | null>(null);
    const [isTogglingOnline, setIsTogglingOnline] = useState(false);

    const speed = Number(location?.coords?.speed ?? 0);
    const driverCoords = {
        latitude: location?.coords?.latitude ?? DEFAULT_LAT,
        longitude: location?.coords?.longitude ?? DEFAULT_LNG,
    };
    const mapStyle = isDarkMode ? GOOGLE_MAPS_DARK_STYLE : undefined;

    // Extract dropoff (or pickup) coordinates from active orders
    const orderMarkers = useMemo<Array<{ id: string; lat: number; lng: number }>>(() => {
        return allActiveOrders
            .map((order) => {
                const dropoff = order.getAttribute('payload.dropoff');
                const pickup = order.getAttribute('payload.pickup');
                const place = dropoff ?? pickup;
                if (!place) return null;
                const placeLocation = typeof place.getAttribute === 'function'
                    ? place.getAttribute('location')
                    : place.location;
                const coords = placeLocation?.coordinates;
                if (!coords || coords.length < 2) return null;
                // GeoJSON order is [longitude, latitude]
                return { id: String(order.id), lat: Number(coords[1]), lng: Number(coords[0]) };
            })
            .filter((m): m is { id: string; lat: number; lng: number } => Boolean(m));
    }, [allActiveOrders]);

    // Keep the camera centered on the driver while location updates.
    useEffect(() => {
        if (!location?.coords || !mapRef.current) return;

        mapRef.current.animateToRegion(
            {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: DEFAULT_LAT_DELTA,
                longitudeDelta: DEFAULT_LNG_DELTA,
            },
            650
        );
    }, [location]);

    const handleToggleOnline = useCallback(async () => {
        if (isTogglingOnline) {
            return;
        }

        setIsTogglingOnline(true);
        try {
            if (isOnline) {
                stopTracking();
                await toggleOnline(false);
            } else {
                startTracking();
                await toggleOnline(true);
            }
        } catch (error) {
            console.warn('Failed to toggle online status:', error);
        } finally {
            setIsTogglingOnline(false);
        }
    }, [isOnline, isTogglingOnline, toggleOnline, startTracking, stopTracking]);

    return (
        <YStack flex={1} bg='#F5F5F5'>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={{
                    latitude: driverCoords.latitude,
                    longitude: driverCoords.longitude,
                    latitudeDelta: DEFAULT_LAT_DELTA,
                    longitudeDelta: DEFAULT_LNG_DELTA,
                }}
                customMapStyle={mapStyle}
                showsCompass={false}
                showsMyLocationButton={false}
                toolbarEnabled={false}
                rotateEnabled={false}
            >
                <Marker identifier="driver" coordinate={driverCoords} pinColor="#112b66" />
                {orderMarkers.map((m) => (
                    <Marker
                        key={m.id}
                        identifier={`order-${m.id}`}
                        coordinate={{ latitude: m.lat, longitude: m.lng }}
                        pinColor="#EF4444"
                    />
                ))}
            </MapView>

            <YStack position='absolute' top={insets.top + 12} left={12} right={12} gap='$3' pointerEvents='box-none' zIndex={40}>
                <XStack justifyContent='space-between' alignItems='center'>
                    {/* Spacer matching hamburger button size; real button is in DriverLayout */}
                    <View style={{ width: 44, height: 44 }} />

                    <YStack flex={1} mx='$3' alignItems='center'>
                        <TouchableOpacity
                            onPress={handleToggleOnline}
                            activeOpacity={0.85}
                            disabled={isTogglingOnline}
                            style={{
                                backgroundColor: isOnline ? '#112b66' : '#6B7280',
                                borderColor: isOnline ? '#112b66' : '#6B7280',
                                borderWidth: 1.5,
                                borderRadius: 30,
                                paddingHorizontal: 20,
                                paddingVertical: 12,
                                elevation: 6,
                                opacity: 1,
                            }}
                        >
                            <XStack alignItems='center' gap='$3'>
                                <YStack width={10} height={10} borderRadius={999} bg={isOnline ? '#FFFFFF' : 'rgba(255,255,255,0.75)'} />
                                <Text fontWeight='800' color='#FFFFFF' fontSize={16}>
                                    {isOnline ? t('DriverDashboard.onlineStatusOn') : t('DriverDashboard.onlineStatusOff')}
                                </Text>
                            </XStack>
                        </TouchableOpacity>
                    </YStack>

                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('DriverChatTab')}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                            alignItems: 'center',
                            justifyContent: 'center',
                            elevation: 4,
                        }}
                    >
                        <FontAwesomeIcon icon={faComments} color={theme.textPrimary.val} size={18} />
                    </TouchableOpacity>
                </XStack>

                <Card bg='#FFFFFF' borderWidth={1} borderColor='#E5E7EB' borderRadius='$8' p='$4' elevation={3} opacity={0.98}>
                    <XStack justifyContent='space-between' alignItems='center'>
                        <XStack space='$3' alignItems='center'>
                            <FontAwesomeIcon icon={faMapMarkerAlt} color='#1F1F1F' size={18} />
                            <YStack>
                                <Text fontWeight='800' color='$textPrimary' fontSize={16}>
                                    {t('DriverDashboard.location')}
                                </Text>
                                <Text color='$textSecondary' fontSize={12}>
                                    {driverCoords.latitude.toFixed(4)}, {driverCoords.longitude.toFixed(4)}
                                </Text>
                            </YStack>
                        </XStack>
                        <Button size='$3' bg='#112b66' borderRadius='$10' onPress={() => navigation.navigate('DriverTaskTab')}>
                            <Button.Icon>
                                <FontAwesomeIcon icon={faPlay} color='#FFFFFF' size={14} />
                            </Button.Icon>
                            <Button.Text color='#FFFFFF' fontWeight='700'>
                                {t('DriverDashboard.go')}
                            </Button.Text>
                        </Button>
                    </XStack>

                    <Separator my='$3' />
                    <XStack mb='$2' alignItems='center' justifyContent='space-between'>
                        <Text color='$textSecondary' fontSize={12}>
                            {t('DriverDashboard.activeOrdersOnMap')}
                        </Text>
                        <Text color='#1F1F1F' fontSize={12} fontWeight='700'>
                            {allActiveOrders.length}
                        </Text>
                    </XStack>

                    <XStack space='$3'>
                        <YStack flex={1} bg='$secondary' borderRadius='$6' p='$3' borderWidth={1} borderColor='$borderColor'>
                            <XStack alignItems='center' space='$2'>
                                <FontAwesomeIcon icon={faListCheck} color={theme.textSecondary.val} size={14} />
                                <Text color='$textSecondary' fontSize={12}>
                                    {t('DriverDashboard.activeOrders')}
                                </Text>
                            </XStack>
                            <Text color='$textPrimary' fontSize={24} fontWeight='800'>
                                {allActiveOrders.length}
                            </Text>
                        </YStack>
                        <YStack flex={1} bg='$secondary' borderRadius='$6' p='$3' borderWidth={1} borderColor='$borderColor'>
                            <XStack alignItems='center' space='$2'>
                                <FontAwesomeIcon icon={faGaugeHigh} color={theme.textSecondary.val} size={14} />
                                <Text color='$textSecondary' fontSize={12}>
                                    {t('DriverDashboard.speed')}
                                </Text>
                            </XStack>
                            <XStack alignItems='flex-end' space='$2'>
                                <Text color='$textPrimary' fontSize={24} fontWeight='800'>
                                    {Math.max(0, Math.round(speed * 3.6))}
                                </Text>
                                <Text color='$textSecondary' fontSize={12} marginBottom={2}>
                                    km/h
                                </Text>
                            </XStack>
                        </YStack>
                    </XStack>
                </Card>
            </YStack>
        </YStack>
    );
};

export default DriverDashboardScreen;


