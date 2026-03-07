import React, { createContext, useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import BackgroundGeolocation from 'react-native-background-geolocation';
import BackgroundFetch from 'react-native-background-fetch';
import { Place, Point } from '@fleetbase/sdk';
import { isEmpty, config } from '../utils';
import { useAuth } from './AuthContext';
import useStorage from '../hooks/use-storage';
import useFleetbase from '../hooks/use-fleetbase';

const LocationContext = createContext({
    location: null,
    isTracking: false,
    isResolvingLocation: false,
    locationError: null,
    hasRealLocation: false,
    isLocationStale: false,
    locationAccuracy: null,
    locationAgeMs: null,
    startTracking: () => {},
    stopTracking: () => {},
    trackLocation: async () => null,
});

const LOCATION_STALE_MS = 2 * 60 * 1000;
const FALLBACK_TRACK_INTERVAL_MS = 15 * 1000;

export const LocationProvider = ({ children }) => {
    const { isOnline, driver, trackDriver } = useAuth();
    const { adapter } = useFleetbase();
    const [authToken] = useStorage('_driver_token');
    const [location, setLocation] = useStorage(`${driver?.id ?? 'anon'}_location`, {});
    const [isTracking, setIsTracking] = useState(false);
    const [isResolvingLocation, setIsResolvingLocation] = useState(false);
    const [locationError, setLocationError] = useState(null);
    const isOnlineRef = useRef(isOnline);
    const appStateRef = useRef(AppState.currentState);
    const lastManualTrackAtRef = useRef(0);
    const geolocationUnavailableRef = useRef(false);
    // BackgroundGeolocation works in trial/debug mode without a license key.
    // Only disable if the package itself is unavailable.
    const hasTransistorsoftLicense = true;
    const locationRef = useRef(location);
    locationRef.current = location;
    // Stable ref for trackDriver so trackLocation doesn't depend on its
    // identity — this breaks the cycle: trackDriver → setDriver → new
    // trackDriver → new trackLocation → effect re-fires → infinite loop.
    const trackDriverRef = useRef(trackDriver);
    useEffect(() => { trackDriverRef.current = trackDriver; }, [trackDriver]);
    const lastTrackSentRef = useRef(0);

    const hasRealLocation =
        typeof location?.coords?.latitude === 'number' &&
        typeof location?.coords?.longitude === 'number';
    const locationTimestamp = location?.timestamp ? new Date(location.timestamp).getTime() : null;
    const isLocationStale = !locationTimestamp || Number.isNaN(locationTimestamp) ? true : (Date.now() - locationTimestamp) > LOCATION_STALE_MS;
    const locationAccuracy = typeof location?.coords?.accuracy === 'number' ? location.coords.accuracy : null;
    const locationAgeMs = locationTimestamp && !Number.isNaN(locationTimestamp) ? Math.max(Date.now() - locationTimestamp, 0) : null;

    const getFallbackCurrentPosition = useCallback(() => {
        return new Promise((resolve, reject) => {
            const geolocation = globalThis?.navigator?.geolocation;
            if (!geolocation?.getCurrentPosition) {
                const error = new Error('Geolocation API is unavailable');
                error.code = 'GEO_UNAVAILABLE';
                reject(error);
                return;
            }

            geolocation.getCurrentPosition(
                (position) => {
                    const nextLocation = {
                        coords: position.coords,
                        timestamp: new Date(position.timestamp ?? Date.now()).toISOString(),
                    };

                    resolve(nextLocation);
                },
                reject,
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 30000,
                }
            );
        });
    }, []);

    // Manually track location
    const trackLocation = useCallback(async (options = {}) => {
        const force = options?.force === true;
        const now = Date.now();

        if (!force && now - lastManualTrackAtRef.current < FALLBACK_TRACK_INTERVAL_MS) {
            return locationRef.current ?? null;
        }

        lastManualTrackAtRef.current = now;
        setIsResolvingLocation(true);
        setLocationError(null);
        try {
            const nextLocation = hasTransistorsoftLicense
                ? await BackgroundGeolocation.getCurrentPosition({
                    samples: 1,
                    desiredAccuracy: 10,
                    maximumAge: 30000,
                    timeout: 15,
                    extras: {
                        event: 'getCurrentPosition',
                    },
                })
                : await getFallbackCurrentPosition();

            setLocation(nextLocation);
            trackDriverRef.current((nextLocation as any).coords).catch((trackErr) => {
                console.warn('[LocationContext] trackDriver failed (API unreachable?):', trackErr);
            });
            lastTrackSentRef.current = Date.now();
            return nextLocation;
        } catch (error) {
            if (error?.message === 'Geolocation API is unavailable' || error?.code === 'GEO_UNAVAILABLE') {
                geolocationUnavailableRef.current = true;
            }
            setLocationError(error);
            if (!geolocationUnavailableRef.current || error?.message !== 'Geolocation API is unavailable') {
                console.warn('Error attempting to track and update location:', error);
            }
            return null;
        } finally {
            setIsResolvingLocation(false);
        }
    }, [getFallbackCurrentPosition, hasTransistorsoftLicense]);

    // Get the drivers location as a Place
    const getDriverLocationAsPlace = useCallback(
        (attributes = {}) => {
            const { coords } = location;

            return new Place(
                {
                    id: 'driver',
                    name: 'Driver Location',
                    street1: 'Driver Location',
                    location: new Point(coords.latitude, coords.longitude),
                    ...attributes,
                },
                adapter
            );
        },
        [location, adapter]
    );

    // Get the HTTP configuration for background geolocation tracking
    const getHttpConfig = useCallback(() => {
        if (!adapter || !driver || !authToken) return {};

        return {
            url: `${adapter.host}/${adapter.namespace}/drivers/${driver.id}/track`,
            headers: {
                Authorization: `Bearer ${authToken}`,
                'Content-Type': 'application/json',
                'User-Agent': config('APP_NAME', 'Delivery Max'),
            },
            httpRootProperty: '.',
            locationTemplate:
                '{"latitude":<%= latitude %>,"longitude":<%= longitude %>,"heading":<%= heading %>,"speed":<%= speed %>,"altitude":<%= altitude %>,"timestamp":"<%= timestamp %>","activity":"<%= activity.type %>","is_moving":<%= is_moving %>,"battery":{"level":<%= battery.level %>,"is_charging":<%= battery.is_charging %>}}',
        };
    }, [adapter, driver, authToken]);

    // Callback to handle location updates.
    // Also sends GPS to backend (throttled to once per 15 s) as a complement
    // to BGeo's native HTTP layer — guarantees backend gets updates even if
    // the native HTTP config URL is unreachable.
    const onLocation = useCallback((location) => {
        console.log('[BackgroundGeolocation] onLocation:', location);
        setLocationError(null);
        setIsResolvingLocation(false);
        setLocation(location);
        if (location?.coords) {
            const now = Date.now();
            if (now - lastTrackSentRef.current >= FALLBACK_TRACK_INTERVAL_MS) {
                lastTrackSentRef.current = now;
                trackDriverRef.current(location.coords).catch(() => {});
            }
        }
    }, []);

    // Callback to handle activity updates.
    const onMotionChange = useCallback(
        (event) => {
            console.log('[BackgroundGeolocation] onMotionChange:', event);
            if (event.location) {
                onLocation(event.location);
            }
        },
        [onLocation]
    );

    // Callback to handle location errors.
    const onLocationError = useCallback((error) => {
        setLocationError(error);
        setIsResolvingLocation(false);
        console.warn('[BackgroundGeolocation] onLocationError:', error);
    }, []);

    // Function to start tracking.
    const startTracking = useCallback(() => {
        if (!hasTransistorsoftLicense) {
            setIsTracking(false);
            return;
        }

        BackgroundGeolocation.start(() => {
            setIsTracking(true);
            console.log('[BackgroundGeolocation] Tracking started');
        });
    }, [hasTransistorsoftLicense]);

    // Function to stop tracking.
    const stopTracking = useCallback(() => {
        if (!hasTransistorsoftLicense) {
            setIsTracking(false);
            return;
        }

        BackgroundGeolocation.stop(() => {
            setIsTracking(false);
            console.log('[BackgroundGeolocation] Tracking stopped');
        });
    }, [hasTransistorsoftLicense]);

    // Keep ref in sync so the ready() callback reads the latest value without being a dependency.
    useEffect(() => {
        isOnlineRef.current = isOnline;
    }, [isOnline]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            appStateRef.current = nextAppState;

            if (nextAppState === 'active' && isOnlineRef.current) {
                startTracking();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [startTracking]);

    useEffect(() => {
        if (!driver || !hasTransistorsoftLicense) return;

        BackgroundGeolocation.ready(
            {
                backgroundPermissionRationale: {
                    title: `Allow ${config('APP_NAME')} to access your location`,
                    message: `${config('APP_NAME')} collects location data to update your position in real-time, even when the app is closed or running in the background. This allows dispatchers and ops teams to track your progress and provide better support while you drive.`,
                    positiveAction: 'Allow',
                    negativeAction: 'Deny',
                },
                desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_MEDIUM,
                distanceFilter: 10,
                locationUpdateInterval: 15000,
                fastestLocationUpdateInterval: 15000,
                stopOnTerminate: false,
                startOnBoot: true,
                stopTimeout: 5,
                debug: false,
                authorization: {},
                ...getHttpConfig(),
            },
            (state) => {
                console.log('[BackgroundGeolocation] is ready:', state);
                if (isOnlineRef.current && (Platform.OS !== 'android' || appStateRef.current === 'active')) {
                    startTracking();
                }
            }
        );

        // Subscribe to location events.
        BackgroundGeolocation.onLocation(onLocation, onLocationError);

        // Subscribe to motion and activity events.
        BackgroundGeolocation.onMotionChange(onMotionChange);

        // Clean up the listener when unmounting.
        return () => {
            BackgroundGeolocation.removeListeners();
        };
    }, [driver, getHttpConfig, hasTransistorsoftLicense, onLocation, onLocationError, onMotionChange, startTracking]);

    // Configure BackgroundFetch for periodic tasks.
    useEffect(() => {
        if (Platform.OS === 'android' && !hasTransistorsoftLicense) {
            return;
        }

        BackgroundFetch.configure(
            {
                minimumFetchInterval: 15,
                stopOnTerminate: false,
                startOnBoot: false,
                enableHeadless: true,
            },
            async (taskId) => {
                if (Platform.OS === 'android' && (!hasTransistorsoftLicense || appStateRef.current !== 'active' || geolocationUnavailableRef.current)) {
                    BackgroundFetch.finish(taskId);
                    return;
                }

                await trackLocation();
                BackgroundFetch.finish(taskId);
            },
            (error) => {
                console.warn('[BackgroundFetch] failed to configure:', error);
            }
        );
    }, [hasTransistorsoftLicense, trackLocation]);

    // Toggle tracking based on the driver's online status.
    useEffect(() => {
        if (!driver) return;
        if (isOnline) {
            if (Platform.OS !== 'android' || appStateRef.current === 'active') {
                startTracking();
            }
        } else {
            stopTracking();
        }

        if (isEmpty(location) && driver && !geolocationUnavailableRef.current) {
            trackLocation({ force: true });
        }
    }, [driver, isOnline, startTracking, stopTracking, trackLocation]);

    // BackgroundGeolocation already delivers location via onLocation every
    // locationUpdateInterval (15 s).  A manual setInterval here would duplicate
    // GPS polls and API calls, so we only do a single initial fetch when
    // the driver comes online / the app becomes active.
    useEffect(() => {
        if (!driver || !isOnline || appStateRef.current !== 'active' || geolocationUnavailableRef.current) {
            return;
        }

        trackLocation({ force: true });
    }, [driver, isOnline, trackLocation]);

    // Memoize the context value to prevent unnecessary re-renders.
    const value = useMemo(
        () => ({
            location,
            isTracking,
            isResolvingLocation,
            locationError,
            hasRealLocation,
            isLocationStale,
            locationAccuracy,
            locationAgeMs,
            startTracking,
            stopTracking,
            getDriverLocationAsPlace,
            trackLocation,
        }),
        [location, isTracking, isResolvingLocation, locationError, hasRealLocation, isLocationStale, locationAccuracy, locationAgeMs, startTracking, stopTracking, getDriverLocationAsPlace, trackLocation]
    );

    return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

// Custom hook to use the LocationContext.
export const useLocation = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
