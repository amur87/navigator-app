import React, { createContext, useContext, useReducer, useMemo, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { EventRegister } from 'react-native-event-listeners';
import { Driver } from '@fleetbase/sdk';
import { later, isArray, navigatorConfig } from '../utils';
import useStorage, { storage } from '../hooks/use-storage';
import useFleetbase from '../hooks/use-fleetbase';
import { useLanguage } from './LanguageContext';
import { useNotification } from './NotificationContext';

const AuthContext = createContext();

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

const isRouteMissingError = (error) => {
    const status = error?.response?.status ?? error?.status;
    const text = getErrorText(error).toLowerCase();
    return status === 404 || status === 405 || text.includes('not found') || text.includes('method not allowed');
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
            return { ...state, driver: action.driver, isVerifyingCode: action.isVerifyingCode ?? false };
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
    const organizationsLoadedRef = useRef(false);
    const loadOrganizationsPromiseRef = useRef();
    const didInitAuthRef = useRef(false);

    const getFleetbaseOrThrow = useCallback(() => {
        if (!fleetbase) {
            throw new Error('Fleetbase SDK is not initialized. Check FLEETBASE_HOST and FLEETBASE_KEY.');
        }

        return fleetbase;
    }, [fleetbase]);

    // Reset auth only once on app start.
    useEffect(() => {
        if (didInitAuthRef.current) {
            return;
        }

        didInitAuthRef.current = true;

        if (storedDriver) {
            setStoredDriver(null);
        }

        setAuthToken(null);
        dispatch({ type: 'RESTORE_SESSION', driver: null });
    }, [storedDriver, setStoredDriver, setAuthToken]);

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

    // Track driver location
    const trackDriverLocation = useCallback(
        async (location) => {
            try {
                const driver = await state.driver.update({ place: location.id });
                setDriver(driver);
            } catch (err) {
                throw err;
            }
        },
        [setDriver, state.driver]
    );

    // Reload the driver resource
    const reloadDriver = useCallback(
        async () => {
            try {
                const driver = await state.driver.reload();
                setDriver(driver);
            } catch (err) {
                throw err;
            }
        },
        [setDriver, state.driver]
    );

    // Track driver position and other position related data
    const trackDriver = useCallback(
        async (data = {}) => {
            try {
                const driver = await state.driver.track(data);
                setDriver(driver);
            } catch (err) {
                throw err;
            }
        },
        [setDriver, state.driver]
    );

    // Update driver meta attributes
    const updateDriverMeta = useCallback(
        async (newMeta = {}) => {
            const meta = { ...state.driver.getAttribute('meta'), ...newMeta };
            try {
                const driver = await state.driver.update({ meta });
                setDriver(driver);
                return driver;
            } catch (err) {
                throw err;
            }
        },
        [setDriver, state.driver]
    );

    // Update driver meta attributes
    const updateDriver = useCallback(
        async (data = {}) => {
            try {
                dispatch({ type: 'START_UPDATE', driver: state.driver, isUpdating: true });
                const driver = await state.driver.update({ ...data });
                setDriver(driver);
                dispatch({ type: 'END_UPDATE', driver, isUpdating: false });
                return driver;
            } catch (err) {
                dispatch({ type: 'END_UPDATE', driver: state.driver, isUpdating: false });
                throw err;
            }
        },
        [setDriver, state.driver]
    );

    // Toggle driver online status
    const toggleOnline = useCallback(
        async (online = null) => {
            if (!adapter) {return;}

            online = online === null ? !getDriverOnlineStatus(state.driver) : online;

            try {
                const driver = await adapter.post(`drivers/${state.driver.id}/toggle-online`, { online });
                setDriver(driver);

                return driver;
            } catch (err) {
                throw err;
            }
        },
        [adapter, setDriver, state.driver]
    );

    // Register driver's device and platform
    const syncDevice = useCallback(async (driver, token) => {
        try {
            await driver.syncDevice({ token, platform: Platform.OS });
        } catch (err) {
            throw err;
        }
    }, []);

    // Register current state driver's device and platform
    const registerDevice = useCallback(async (token) => {
        try {
            await syncDevice(state.driver, token);
        } catch (err) {
            throw err;
        }
    }, [state.driver, syncDevice]);

    // Remove local session data
    const clearSessionData = useCallback(() => {
        storage.removeItem('_driver_token');
        storage.removeItem('organizations');
        storage.removeItem('driver');

        logoutFacebookIfAvailable();
    }, []);

    // Create a session from driver data/JSON
    const createDriverSession = useCallback(
        async (driver, callback = null) => {
            clearSessionData();
            // setDriverDefaultLocation(driver);
            setDriver(driver);
            setAuthToken(driver.token);

            // run a callback with the driver instance
            const instance = new Driver(driver, adapter);
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
        [adapter, clearSessionData, deviceToken, setAuthToken, setDriver, syncDevice]
    );

    // Create Account: Send verification code
    const requestCreationCode = useCallback(
        async (phone, method = 'sms') => {
            dispatch({ type: 'CREATING_ACCOUNT', phone, isSendingCode: true });
            try {
                const sdk = getFleetbaseOrThrow();
                if (typeof sdk?.drivers?.requestCreationCode === 'function') {
                    await sdk.drivers.requestCreationCode(phone, method);
                } else if (adapter) {
                    const attempts = [
                        { path: 'drivers/request-creation-code', payload: { identity: phone, mode: method } },
                        { path: 'drivers/request-creation-code', payload: { phone, mode: method } },
                        { path: 'drivers/create-account/request-code', payload: { identity: phone, mode: method } },
                        { path: 'drivers/register/request-code', payload: { identity: phone, mode: method } },
                        { path: 'drivers/login-with-sms', payload: { phone } },
                    ];

                    let lastError = null;
                    for (const attempt of attempts) {
                        try {
                            await adapter.post(attempt.path, attempt.payload);
                            lastError = null;
                            break;
                        } catch (error) {
                            const normalizedMessage = getErrorText(error).toLowerCase();
                            if (normalizedMessage.includes('already exists') || normalizedMessage.includes('already registered')) {
                                throw error;
                            }

                            if (isRouteMissingError(error)) {
                                lastError = error;
                                continue;
                            }

                            // If endpoint exists but payload format is rejected, try next variant.
                            if ((error?.response?.status ?? error?.status) === 400) {
                                lastError = error;
                                continue;
                            }

                            throw error;
                        }
                    }

                    if (lastError) {
                        throw lastError;
                    }
                } else {
                    throw new Error('Fleetbase adapter is not initialized.');
                }
                dispatch({ type: 'CREATING_ACCOUNT', phone, isSendingCode: false });
            } catch (error) {
                console.warn('[AuthContext] Account creation verification failed:', error);
                throw error;
            } finally {
                dispatch({ type: 'CREATING_ACCOUNT', phone, isSendingCode: false });
            }
        },
        [getFleetbaseOrThrow, adapter]
    );

    // Create Account: Verify Code
    const verifyAccountCreation = useCallback(
        async (phone, code, attributes = {}) => {
            dispatch({ type: 'VERIFY', isVerifyingCode: true });
            try {
                const sdk = getFleetbaseOrThrow();
                const payload = { identity: phone, code, ...attributes };
                let response = null;

                if (typeof sdk?.drivers?.create === 'function' && sdk.drivers.create.length <= 2) {
                    response = await sdk.drivers.create(payload);
                } else if (adapter) {
                    const attempts = [
                        { path: 'drivers', payload },
                        { path: 'drivers/create', payload },
                        { path: 'drivers/verify-code', payload },
                    ];

                    let lastError = null;
                    for (const attempt of attempts) {
                        try {
                            response = await adapter.post(attempt.path, attempt.payload);
                            lastError = null;
                            break;
                        } catch (error) {
                            if (isRouteMissingError(error)) {
                                lastError = error;
                                continue;
                            }

                            if ((error?.response?.status ?? error?.status) === 400) {
                                lastError = error;
                                continue;
                            }

                            throw error;
                        }
                    }

                    if (lastError && !response) {
                        throw lastError;
                    }
                } else {
                    throw new Error('Fleetbase adapter is not initialized.');
                }

                const driver = resolveDriverFromResponse(response);
                if (!driver) {
                    throw new Error('Unable to create driver session from API response.');
                }

                createDriverSession(driver);
                dispatch({ type: 'VERIFY', driver });
            } catch (error) {
                console.warn('[AuthContext] Account creation verification failed:', error);
                throw error;
            } finally {
                dispatch({ type: 'VERIFY', isVerifyingCode: false });
            }
        },
        [adapter, createDriverSession, getFleetbaseOrThrow]
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
                const driver = await sdk.drivers.verifyCode(normalizedPhone, normalizedCode);
                createDriverSession(driver);
                dispatch({ type: 'VERIFY', driver, isVerifyingCode: false });
            } catch (error) {
                console.warn('[AuthContext] Code verification failed:', error);
                dispatch({ type: 'VERIFY', isVerifyingCode: false });
                throw error;
            }
        },
        [createDriverSession, getFleetbaseOrThrow, state.phone]
    );

    // Load organizations driver belongs to
    const loadOrganizations = useCallback(async () => {
        if (!state.driver || loadOrganizationsPromiseRef.current) {return;}

        try {
            loadOrganizationsPromiseRef.current = state.driver.listOrganizations();
            const organizations = await loadOrganizationsPromiseRef.current;
            console.log('[loadOrganizations #organizations]', organizations);
            setOrganizations(organizations.map((n) => n.serialize()));
        } catch (err) {
            console.warn('Error trying to load driver organizations:', err);
        } finally {
            organizationsLoadedRef.current = true;
            loadOrganizationsPromiseRef.current = null;
        }
    }, [setOrganizations, state.driver]);

    // Load organizations driver belongs to
    const switchOrganization = useCallback(
        async (organization) => {
            if (!adapter) {return;}

            try {
                const { driver } = await adapter.post(`drivers/${state.driver.id}/switch-organization`, { next: organization.id });
                console.log('[switchOrganization #driver]', driver);
                console.log('[switchOrganization #driver.token]', driver.token);
                createDriverSession(driver);
            } catch (err) {
                console.warn('Error trying to switch driver organization:', err);
            }
        },
        [adapter, createDriverSession, state.driver]
    );

    // Load organizations driver belongs to
    const getCurrentOrganization = useCallback(async () => {
        if (!state.driver) {return;}

        try {
            const currentOrganization = await state.driver.currentOrganization();
            return currentOrganization;
        } catch (err) {
            console.warn('Error trying fetch drivers current organization:', err);
        }
    }, [state.driver]);

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
            getCurrentOrganization,
            login,
            loadOrganizations,
            logout,
            organizations,
            registerDevice,
            reloadDriver,
            requestCreationCode,
            setDriver,
            state,
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
