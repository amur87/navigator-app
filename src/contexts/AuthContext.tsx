import React, { createContext, useContext, useReducer, useMemo, useEffect, useCallback, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { EventRegister } from 'react-native-event-listeners';
import { Driver } from '@fleetbase/sdk';
import { later, isArray, navigatorConfig } from '../utils';
import { normalizeDriverStatus } from '../utils/driver-status';
import useStorage, { storage } from '../hooks/use-storage';
import useFleetbase from '../hooks/use-fleetbase';
import { useLanguage } from './LanguageContext';
import { useNotification } from './NotificationContext';
import Env from '../utils/env-config';

const AuthContext = createContext();
const VERIFY_TIMEOUT_MS = 15000;
const DEV_BYPASS_AUTH = `${Env.DEV_BYPASS_AUTH ?? ''}`.toLowerCase() === 'true';

const createDevDriverPayload = () => ({
    id: `${Env.DEV_BYPASS_DRIVER_ID || 'debug-driver'}`,
    name: `${Env.DEV_BYPASS_DRIVER_NAME || 'Debug Driver'}`,
    phone: `${Env.DEV_BYPASS_DRIVER_PHONE || '+996550882588'}`,
    token: `${Env.DEV_BYPASS_DRIVER_TOKEN || 'debug-driver-token'}`,
    online: false,
});

const logoutFacebookIfAvailable = () => {
    try {
        const facebookSdk = require('react-native-fbsdk-next');
        const loginManager = facebookSdk?.LoginManager ?? facebookSdk?.default?.LoginManager;
        if (loginManager && typeof loginManager.logOut === 'function') {
            loginManager.logOut();
        }
    } catch (error) {
        // FB SDK is optional for this build; ignore when unavailable.
    }
};

const getErrorText = (error) => {
    const messageParts = [error?.message, error?.error, error?.response?.data?.error];
    const responseErrors = error?.response?.data?.errors;
    if (isArray(responseErrors)) {
        messageParts.push(...responseErrors);
    }

    return messageParts.filter((part) => typeof part === 'string' && part.trim().length > 0).join(' ');
};

const withTimeout = async (promise, timeoutMs, timeoutMessage) => {
    let timer;

    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(timeoutMessage));
                }, timeoutMs);
            }),
        ]);
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }
};

const isRouteMissingError = (error) => {
    const status = error?.response?.status ?? error?.status;
    const text = getErrorText(error).toLowerCase();
    return status === 404 || status === 405 || text.includes('not found') || text.includes('method not allowed') || text.includes('nothing to see');
};

const resolveDriverFromResponse = (response) => {
    if (!response) {return null;}
    if (response instanceof Driver) {return response;}
    return response?.driver ?? response?.data?.driver ?? response;
};

const getDriverOnlineStatus = (driver) => {
    if (!driver) {return false;}
    if (typeof driver.isOnline === 'boolean') {return driver.isOnline;}
    if (typeof driver.getAttribute === 'function') {
        const online = driver.getAttribute('online');
        if (typeof online === 'boolean') {return online;}
    }
    if (typeof driver.online === 'boolean') {return driver.online;}
    return false;
};

const authReducer = (state, action) => {
    switch (action.type) {
        case 'RESTORE_SESSION':
            return { ...state, driver: action.driver };
        case 'LOGIN':
            return { ...state, phone: action.phone, isSendingCode: action.isSendingCode ?? false, loginMethod: action.loginMethod ?? 'sms' };
        case 'CREATING_ACCOUNT':
            return { ...state, phone: action.phone, isSendingCode: action.isSendingCode ?? false };
        case 'VERIFY':
            return { ...state, ...(action.driver !== undefined ? { driver: action.driver } : {}), isVerifyingCode: action.isVerifyingCode ?? false };
        case 'LOGOUT':
            return { ...state, driver: null, phone: null, isSigningOut: action.isSigningOut ?? false };
        case 'START_UPDATE':
            return { ...state, driver: action.driver, isUpdating: action.isUpdating ?? true };
        case 'END_UPDATE':
            return { ...state, driver: action.driver, isUpdating: action.isUpdating ?? false };
        default:
            return state;
    }
};

export const AuthProvider = ({ children }) => {
    const { fleetbase, adapter } = useFleetbase();
    const { setLocale } = useLanguage();
    const { deviceToken } = useNotification();
    const [storedDriver, setStoredDriver] = useStorage('driver');
    const [organizations, setOrganizations] = useStorage('organizations', []);
    const [authToken, setAuthToken] = useStorage('_driver_token');
    const [state, dispatch] = useReducer(authReducer, {
        isSendingCode: false,
        isVerifyingCode: false,
        isSigningOut: false,
        isUpdating: false,
        loginMethod: 'sms',
        driver: storedDriver ? new Driver(storedDriver, adapter) : null,
        phone: null,
    });
    const [driverStatus, setDriverStatusState] = useState<string>(storage.getString('driver_status') || 'active');
    const organizationsLoadedRef = useRef(false);
    const loadOrganizationsPromiseRef = useRef();
    const didInitAuthRef = useRef(false);
    // Stable ref for the driver instance so trackDriver doesn't need
    // state.driver in its deps (which would cascade re-renders on every GPS ping).
    const stateDriverRef = useRef(state.driver);

    // Update driver status in both MMKV and React state
    const updateDriverStatus = useCallback((status: string) => {
        storage.setString('driver_status', status);
        setDriverStatusState(status);
    }, []);

    const getFleetbaseOrThrow = useCallback(() => {
        if (!fleetbase) {
            throw new Error('Fleetbase SDK is not initialized. Check FLEETBASE_HOST and FLEETBASE_KEY.');
        }

        return fleetbase;
    }, [fleetbase]);

    useEffect(() => { stateDriverRef.current = state.driver; }, [state.driver]);

    // Restore persisted session once the SDK adapter is ready.
    // (Previously this was clearing storage on every cold start, which made auth "fall off".)
    useEffect(() => {
        if (didInitAuthRef.current) {
            return;
        }

        if (!adapter) {
            return;
        }

        didInitAuthRef.current = true;

        if (storedDriver) {
            // Always start offline on fresh app launch — use a shallow copy to avoid mutating storage state
            const driverData = typeof storedDriver === 'object' && storedDriver !== null
                ? { ...storedDriver, online: false }
                : storedDriver;
            setDriver(driverData);
            return;
        }

        if (__DEV__ && DEV_BYPASS_AUTH) {
            createDriverSession(createDevDriverPayload()).catch((error) => {
                console.warn('[AuthContext] DEV_BYPASS_AUTH failed:', error);
            });
        }
    }, [adapter, createDriverSession, setDriver, storedDriver]);

    const setDriver = useCallback(
        (newDriver) => {
            if (!newDriver) {
                setStoredDriver(null);
                dispatch({ type: 'RESTORE_SESSION', driver: null });
                EventRegister.emit('driver.updated', null);
                return;
            }

            const driverInstance = newDriver instanceof Driver ? newDriver : new Driver(newDriver, adapter);

            // Restore driver token if needed
            if (!driverInstance.token && storage.getString('_driver_token')) {
                driverInstance.setAttribute('token', storage.getString('_driver_token'));
            }

            setStoredDriver(driverInstance.serialize());
            dispatch({ type: 'RESTORE_SESSION', driver: driverInstance });
            EventRegister.emit('driver.updated', driverInstance);
        },
        [adapter, dispatch, setStoredDriver]
    );

    // Track driver location — uses stateDriverRef for stability
    const trackDriverLocation = useCallback(
        async (location) => {
            if (!stateDriverRef.current) return;
            const driver = await stateDriverRef.current.update({ place: location.id });
            setDriver(driver);
        },
        [setDriver]
    );

    // Reload the driver resource — uses stateDriverRef for stability
    const reloadDriver = useCallback(
        async () => {
            if (!stateDriverRef.current) return;
            const driver = await stateDriverRef.current.reload();
            setDriver(driver);
        },
        [setDriver]
    );

    // Resolve driver moderation status from API and sync to MMKV + React state
    // Status is managed by admin on the backend — app only reads it
    // Returns resolved status: 'pending' | 'active' | 'inactive' | 'blocked'
    const syncDriverStatusFromData = useCallback((driverData) => {
        const currentStatus = storage.getString('driver_status') || 'active';
        if (!driverData) return currentStatus;

        const apiStatus = driverData.getAttribute?.('status') || driverData.status || '';
        console.log('[AuthContext] syncDriverStatusFromData: apiStatus =', apiStatus);

        const resolvedStatus = normalizeDriverStatus(apiStatus || currentStatus);

        // Only write if status actually changed
        if (resolvedStatus !== currentStatus) {
            updateDriverStatus(resolvedStatus);
        }

        return resolvedStatus;
    }, [updateDriverStatus]);

    // Check driver moderation status from API and sync local storage
    // Uses refs to avoid unstable deps in polling effect
    const setDriverRef = useRef(setDriver);
    const syncStatusRef = useRef(syncDriverStatusFromData);
    useEffect(() => { setDriverRef.current = setDriver; }, [setDriver]);
    useEffect(() => { syncStatusRef.current = syncDriverStatusFromData; }, [syncDriverStatusFromData]);

    const checkDriverStatus = useCallback(
        async () => {
            if (!stateDriverRef.current) return null;
            try {
                const freshDriver = await stateDriverRef.current.reload();
                setDriverRef.current(freshDriver);
                return syncStatusRef.current(freshDriver);
            } catch (err) {
                console.warn('[AuthContext] checkDriverStatus failed:', err);
                return storage.getString('driver_status') || 'active';
            }
        },
        [] // stable — uses refs for all dependencies
    );

    // Sync driver status from server on app boot / session restore
    const didSyncStatusRef = useRef(false);
    useEffect(() => {
        if (!state.driver || !adapter || didSyncStatusRef.current) return;
        didSyncStatusRef.current = true;

        checkDriverStatus().then((status) => {
            console.log('[AuthContext] Initial status sync:', status);
        }).catch(() => {});
    }, [state.driver, adapter, checkDriverStatus]);

    // Poll driver status periodically to detect admin changes
    // Use !!state.driver (boolean) instead of state.driver (object) to avoid
    // tearing down and recreating the interval on every driver update
    const hasDriver = !!state.driver;
    useEffect(() => {
        if (!hasDriver) return;

        // Faster polling when inactive, slower when active
        const intervalMs = driverStatus === 'active' ? 60000 : 15000;
        const intervalId = setInterval(() => {
            checkDriverStatus().catch(() => {});
        }, intervalMs);

        return () => clearInterval(intervalId);
    }, [hasDriver, driverStatus, checkDriverStatus]);

    // Re-check driver status when app returns from background
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && stateDriverRef.current) {
                checkDriverStatus().catch(() => {});
            }
        });
        return () => subscription.remove();
    }, [checkDriverStatus]);

    // Track driver position — uses a stable ref so this callback never
    // changes identity and doesn't trigger cascading re-renders on every
    // GPS ping.  We intentionally do NOT call setDriver here because the
    // API response for a tracking ping doesn't contain meaningful state
    // changes, and updating driver state every 15 s would cascade through
    // the entire component tree.
    const trackDriver = useCallback(
        async (data = {}) => {
            if (!stateDriverRef.current) return;
            await stateDriverRef.current.track(data);
        },
        []
    );

    // Update driver meta attributes — uses stateDriverRef for stability
    const updateDriverMeta = useCallback(
        async (newMeta = {}) => {
            if (!stateDriverRef.current) return;
            const meta = { ...stateDriverRef.current.getAttribute('meta'), ...newMeta };
            const driver = await stateDriverRef.current.update({ meta });
            setDriver(driver);
            return driver;
        },
        [setDriver]
    );

    // Update driver attributes — uses stateDriverRef for stability
    const updateDriver = useCallback(
        async (data = {}) => {
            if (!stateDriverRef.current) return;
            try {
                dispatch({ type: 'START_UPDATE', driver: stateDriverRef.current, isUpdating: true });
                const driver = await stateDriverRef.current.update({ ...data });
                setDriver(driver);
                dispatch({ type: 'END_UPDATE', driver, isUpdating: false });
                return driver;
            } catch (err) {
                dispatch({ type: 'END_UPDATE', driver: stateDriverRef.current, isUpdating: false });
                throw err;
            }
        },
        [setDriver]
    );

    // Toggle driver online status — uses stateDriverRef for stability
    const toggleOnline = useCallback(
        async (online = null) => {
            if (!adapter || !stateDriverRef.current) return;

            online = online === null ? !getDriverOnlineStatus(stateDriverRef.current) : online;

            const driver = await adapter.post(`drivers/${stateDriverRef.current.id}/toggle-online`, { online });
            setDriver(driver);
            return driver;
        },
        [adapter, setDriver]
    );

    // Register driver's device and platform
    const syncDevice = useCallback(async (driver, token) => {
        await driver.syncDevice({ token, platform: Platform.OS });
    }, []);

    // Register current state driver's device and platform
    const registerDevice = useCallback(async (token) => {
        if (!stateDriverRef.current) return;
        await syncDevice(stateDriverRef.current, token);
    }, [syncDevice]);

    // Remove local session data
    const clearSessionData = useCallback(() => {
        storage.removeItem('_driver_token');
        storage.removeItem('organizations');
        storage.removeItem('driver');
        storage.removeItem('registration_completed');
        storage.removeItem('driver_status');
        setDriverStatusState('active');
        didSyncStatusRef.current = false;
        organizationsLoadedRef.current = false;

        logoutFacebookIfAvailable();
    }, []);

    // Check if a driver already completed registration (has vehicle/meta)
    const isDriverRegistrationComplete = useCallback((driverInstance) => {
        if (!driverInstance) return false;
        const getAttr = (key) => {
            if (typeof driverInstance.getAttribute === 'function') {
                return driverInstance.getAttribute(key);
            }
            return driverInstance[key];
        };
        const meta = getAttr('meta') ?? {};
        if (meta.registration_completed) return true;
        if (getAttr('vehicle_uuid') || getAttr('current_vehicle_uuid') || getAttr('vehicle')) return true;
        if (meta.vehicle_uuid || meta.vehicle_plate) return true;
        return false;
    }, []);

    // Create a session from driver data/JSON
    const createDriverSession = useCallback(
        async (driver, callback = null) => {
            clearSessionData();
            const instance = driver instanceof Driver ? driver : new Driver(driver, adapter);

            // Sync driver status from the server response immediately
            syncDriverStatusFromData(instance);
            didSyncStatusRef.current = true;

            // Auto-detect if registration was already completed for existing drivers
            if (isDriverRegistrationComplete(instance)) {
                storage.setBool('registration_completed', true);
            }

            // setDriverDefaultLocation(driver);
            setDriver(instance);
            setAuthToken(instance.token);

            // run a callback with the driver instance
            if (typeof callback === 'function') {
                callback(instance);
            }

            // Sync the driver device
            if (deviceToken) {
                syncDevice(instance, deviceToken);
            }

            organizationsLoadedRef.current = false;
            loadOrganizationsPromiseRef.current = null;

            return instance;
        },
        [adapter, clearSessionData, deviceToken, isDriverRegistrationComplete, setAuthToken, setDriver, syncDevice, syncDriverStatusFromData]
    );

    // Create Account: Send verification code (kept for backward compatibility)
    const requestCreationCode = useCallback(
        async (phone, _method = 'sms') => {
            dispatch({ type: 'CREATING_ACCOUNT', phone, isSendingCode: true });
            try {
                // Fleetbase does not have a separate SMS endpoint for new driver registration.
                // loginWithPhone only works for existing users.
                // We simply store the phone and proceed — actual creation happens in verifyAccountCreation.
                console.log('[AuthContext] requestCreationCode: skipping SMS (not supported for new drivers), phone stored.');
                dispatch({ type: 'CREATING_ACCOUNT', phone, isSendingCode: false });
            } catch (error) {
                console.warn('[AuthContext] requestCreationCode failed:', error);
                dispatch({ type: 'CREATING_ACCOUNT', phone, isSendingCode: false });
                throw error;
            }
        },
        []
    );

    // Create Account: Create driver directly via Fleetbase API
    // Fleetbase uses POST drivers/verify-code with { for: 'create_driver', name, phone }
    // No SMS verification is required for new driver creation.
    const verifyAccountCreation = useCallback(
        async (phone, _code, attributes = {}) => {
            dispatch({ type: 'VERIFY', isVerifyingCode: true });
            try {
                getFleetbaseOrThrow();
                if (!adapter) {
                    throw new Error('Fleetbase adapter is not initialized.');
                }

                let response = null;

                // Build payload for driver creation
                const driverName = attributes.name || phone;
                const createPayload = {
                    phone,
                    name: driverName,
                    identity: phone,
                    for: 'create_driver',
                    code: '999000',
                    password: phone, // Fleetbase create() requires password for User creation
                    ...attributes,
                };

                // Try endpoints in order of likelihood
                const attempts = [
                    { path: 'drivers/verify-code', payload: createPayload },
                    { path: 'drivers', payload: { phone, name: driverName, password: phone, ...attributes } },
                ];

                let lastError = null;
                for (const attempt of attempts) {
                    try {
                        console.log(`[AuthContext] Trying create driver: POST ${attempt.path}`, JSON.stringify(attempt.payload));
                        response = await withTimeout(
                            adapter.post(attempt.path, attempt.payload),
                            VERIFY_TIMEOUT_MS,
                            'Account creation timed out. Please try again.'
                        );
                        console.log(`[AuthContext] Success on POST ${attempt.path}`, JSON.stringify(response));
                        lastError = null;
                        break;
                    } catch (error) {
                        const status = error?.response?.status ?? error?.status;
                        const errorText = getErrorText(error);
                        const responseBody = JSON.stringify(error?.response?.data ?? error?.data ?? {});
                        console.warn(`[AuthContext] POST ${attempt.path} failed (status=${status}): ${errorText}`);
                        console.warn(`[AuthContext] Response body: ${responseBody}`);

                        if (isRouteMissingError(error)) {
                            // Route doesn't exist on this endpoint — try next
                            lastError = error;
                            continue;
                        }

                        if (status === 500) {
                            // Server error — try next endpoint as fallback
                            lastError = error;
                            continue;
                        }

                        // 400 = bad request (duplicate phone, invalid data) — don't retry, surface the error
                        throw error;
                    }
                }

                if (lastError && !response) {
                    throw lastError;
                }

                // Account created successfully on the server.
                // Do NOT authenticate here — the user must verify their phone via SMS first.
                console.log('[AuthContext] Driver account created. Phone verification required before authentication.');

                // Driver status is managed by admin on the backend
                // App will read it via checkDriverStatus() polling
            } catch (error) {
                console.warn('[AuthContext] Account creation failed:', error);
                throw error;
            } finally {
                dispatch({ type: 'VERIFY', isVerifyingCode: false });
            }
        },
        [adapter, getFleetbaseOrThrow]
    );

    // Login: Send verification code
    const login = useCallback(
        async (phone) => {
            dispatch({ type: 'LOGIN', phone, isSendingCode: true });
            try {
                const sdk = getFleetbaseOrThrow();
                const { method } = await sdk.drivers.login(phone);
                dispatch({ type: 'LOGIN', phone, isSendingCode: false, loginMethod: method ?? 'sms' });
            } catch (error) {
                dispatch({ type: 'LOGIN', phone, isSendingCode: false });
                console.warn('[AuthContext] Login failed:', error);
                throw error;
            }
        },
        [getFleetbaseOrThrow]
    );

    // Verify code
    const verifyCode = useCallback(
        async (code) => {
            const normalizedPhone = `${state.phone ?? ''}`.trim();
            const normalizedCode = `${code ?? ''}`.replace(/\D/g, '');

            if (!normalizedPhone) {
                throw new Error('Phone number is missing. Please request a new code.');
            }

            if (normalizedCode.length !== 6) {
                throw new Error('Invalid verification code.');
            }

            dispatch({ type: 'VERIFY', isVerifyingCode: true });
            try {
                const sdk = getFleetbaseOrThrow();
                const driver = await withTimeout(
                    sdk.drivers.verifyCode(normalizedPhone, normalizedCode),
                    VERIFY_TIMEOUT_MS,
                    'Verification timed out. Please try again.'
                );
                const driverSession = await createDriverSession(driver);
                dispatch({ type: 'VERIFY', driver: driverSession, isVerifyingCode: false });
            } catch (error) {
                console.warn('[AuthContext] Code verification failed:', error);
                dispatch({ type: 'VERIFY', isVerifyingCode: false });
                throw error;
            }
        },
        [createDriverSession, getFleetbaseOrThrow, state.phone]
    );

    // Load organizations driver belongs to — uses stateDriverRef for stability
    const loadOrganizations = useCallback(async () => {
        if (!stateDriverRef.current || loadOrganizationsPromiseRef.current) {return;}

        try {
            loadOrganizationsPromiseRef.current = stateDriverRef.current.listOrganizations();
            const organizations = await loadOrganizationsPromiseRef.current;
            console.log('[loadOrganizations #organizations]', organizations);
            setOrganizations(organizations.map((n) => n.serialize()));
        } catch (err) {
            console.warn('Error trying to load driver organizations:', err);
        } finally {
            organizationsLoadedRef.current = true;
            loadOrganizationsPromiseRef.current = null;
        }
    }, [setOrganizations]);

    // Switch organization — uses stateDriverRef for stability
    const switchOrganization = useCallback(
        async (organization) => {
            if (!adapter || !stateDriverRef.current) {return;}

            try {
                const { driver } = await adapter.post(`drivers/${stateDriverRef.current.id}/switch-organization`, { next: organization.id });
                console.log('[switchOrganization #driver]', driver);
                console.log('[switchOrganization #driver.token]', driver.token);
                createDriverSession(driver);
            } catch (err) {
                console.warn('Error trying to switch driver organization:', err);
            }
        },
        [adapter, createDriverSession]
    );

    // Get current organization — uses stateDriverRef for stability
    const getCurrentOrganization = useCallback(async () => {
        if (!stateDriverRef.current) {return;}

        try {
            const currentOrganization = await stateDriverRef.current.currentOrganization();
            return currentOrganization;
        } catch (err) {
            console.warn('Error trying fetch drivers current organization:', err);
        }
    }, []);

    // Logout: Clear session
    const logout = useCallback(() => {
        dispatch({ type: 'LOGOUT', isSigningOut: true });

        // Remove driver session
        setDriver(null);

        // Clear storage/ cache
        clearSessionData();

        // Reset locale
        setLocale(navigatorConfig('defaultLocale', 'en'));

        later(() => {
            dispatch({ type: 'LOGOUT', isSigningOut: false });
        });
    }, [clearSessionData, setDriver, setLocale]);

    // // Sync device token if it changes
    // // Test on IOS before adding
    // useEffect(() => {
    //     if (deviceToken && state.driver) {
    //         syncDevice(state.driver, deviceToken);
    //     }
    // }, [deviceToken, state.driver]);

    // Memoize useful props and methods
    const value = useMemo(
        () => ({
            driver: state.driver,
            driverStatus,
            phone: state.phone,
            isSendingCode: state.isSendingCode,
            isVerifyingCode: state.isVerifyingCode,
            isAuthenticated: !!state.driver,
            isNotAuthenticated: !state.driver,
            isOnline: getDriverOnlineStatus(state.driver),
            isOffline: getDriverOnlineStatus(state.driver) === false,
            isSigningOut: state.isSigningOut,
            isUpdating: state.isUpdating,
            loginMethod: state.loginMethod,
            updateDriverMeta,
            updateDriver,
            trackDriverLocation,
            organizations,
            loadOrganizations,
            switchOrganization,
            getCurrentOrganization,
            reloadDriver,
            checkDriverStatus,
            updateDriverStatus,
            trackDriver,
            toggleOnline,
            clearSessionData,
            setDriver,
            login,
            verifyCode,
            logout,
            requestCreationCode,
            verifyAccountCreation,
            createDriverSession,
            syncDevice,
            registerDevice,
            authToken,
        }),
        [
            authToken,
            clearSessionData,
            createDriverSession,
            driverStatus,
            getCurrentOrganization,
            login,
            loadOrganizations,
            logout,
            organizations,
            registerDevice,
            reloadDriver,
            checkDriverStatus,
            updateDriverStatus,
            requestCreationCode,
            setDriver,
            state.driver,
            state.phone,
            state.isSendingCode,
            state.isVerifyingCode,
            state.isSigningOut,
            state.isUpdating,
            state.loginMethod,
            switchOrganization,
            syncDevice,
            toggleOnline,
            trackDriver,
            trackDriverLocation,
            updateDriverMeta,
            updateDriver,
            verifyAccountCreation,
            verifyCode,
        ]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const useIsAuthenticated = () => {
    const { isAuthenticated } = useAuth();
    return isAuthenticated;
};

export const useIsNotAuthenticated = () => {
    const { isNotAuthenticated } = useAuth();
    return isNotAuthenticated;
};
