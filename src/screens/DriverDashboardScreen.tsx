import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faMapMarkerAlt, faGaugeHigh, faListCheck, faPlay, faComments } from '@fortawesome/free-solid-svg-icons';
import { Button, Text, YStack, XStack, useTheme, Card, Separator } from 'tamagui';
import { View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLocation } from '../contexts/LocationContext';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';

const DEFAULT_LAT = 42.8746;
const DEFAULT_LNG = 74.5698;

const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin:0; padding:0; width:100%; height:100%; }
    @keyframes ripple {
      0%   { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(3); opacity: 0; }
    }
    .order-pin { position: relative; width: 14px; height: 14px; }
    .order-pin-dot {
      position: absolute; inset: 0;
      background: #EF4444;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 0 4px rgba(0,0,0,0.3);
    }
    .order-pin-ring {
      position: absolute; inset: -4px;
      background: rgba(239,68,68,0.35);
      border-radius: 50%;
      animation: ripple 1.6s ease-out infinite;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${DEFAULT_LAT}, ${DEFAULT_LNG}], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var driverMarker = L.marker([${DEFAULT_LAT}, ${DEFAULT_LNG}], { title: 'Driver' }).addTo(map);
    var orderMarkers = [];

    function createPulseIcon() {
      return L.divIcon({
        className: '',
        html: '<div class="order-pin"><div class="order-pin-ring"></div><div class="order-pin-dot"></div></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        popupAnchor: [0, -10]
      });
    }

    function handleMessage(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'update' && data.lat != null && data.lng != null) {
          var pos = [data.lat, data.lng];
          driverMarker.setLatLng(pos);
          map.setView(pos);
        }
        if (data.type === 'orders') {
          orderMarkers.forEach(function(m) { map.removeLayer(m); });
          orderMarkers = [];
          (data.orders || []).forEach(function(order) {
            var m = L.marker([order.lat, order.lng], { icon: createPulseIcon() })
              .addTo(map);
            orderMarkers.push(m);
          });
        }
      } catch (e) {}
    }

    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>
`;

const DriverDashboardScreen = () => {
    const theme = useTheme();
    const { t } = useLanguage();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { location, startTracking, stopTracking } = useLocation();
    const { isOnline, toggleOnline } = useAuth();
    const { allActiveOrders } = useOrderManager();
    const mapRef = useRef<WebView>(null);
    const [isTogglingOnline, setIsTogglingOnline] = useState(false);

    const speed = Number(location?.coords?.speed ?? 0);
    const driverCoords = {
        latitude: location?.coords?.latitude ?? DEFAULT_LAT,
        longitude: location?.coords?.longitude ?? DEFAULT_LNG,
    };

    // Extract dropoff (or pickup) coordinates from active orders
    const orderMarkers = useMemo(() => {
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
                return { id: order.id, lat: coords[1], lng: coords[0] };
            })
            .filter(Boolean);
    }, [allActiveOrders]);

    // Send driver position to map
    useEffect(() => {
        if (location?.coords && mapRef.current) {
            mapRef.current.postMessage(
                JSON.stringify({
                    type: 'update',
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                })
            );
        }
    }, [location]);

    // Send order markers to map whenever they change
    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.postMessage(
                JSON.stringify({ type: 'orders', orders: orderMarkers })
            );
        }
    }, [orderMarkers]);

    // After WebView reloads, re-send current state
    const handleMapLoad = useCallback(() => {
        if (!mapRef.current) return;
        if (location?.coords) {
            mapRef.current.postMessage(
                JSON.stringify({
                    type: 'update',
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                })
            );
        }
        mapRef.current.postMessage(
            JSON.stringify({ type: 'orders', orders: orderMarkers })
        );
    }, [location, orderMarkers]);

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
            <WebView
                ref={mapRef}
                style={{ flex: 1 }}
                originWhitelist={['*']}
                source={{ html: leafletHtml }}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                onLoadEnd={handleMapLoad}
            />

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


