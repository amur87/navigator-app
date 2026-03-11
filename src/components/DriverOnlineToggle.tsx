import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Switch, Label, XStack } from 'tamagui';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { canDriverGoOnline, getOnlineBlockMessage } from '../utils/driver-status';
import useAppTheme from '../hooks/use-app-theme';

const resolveOnlineStatus = (driverLike, fallback) => {
    if (!driverLike) {
        return fallback;
    }

    if (typeof driverLike.isOnline === 'boolean') {
        return driverLike.isOnline;
    }

    if (typeof driverLike.getAttribute === 'function') {
        const online = driverLike.getAttribute('online');
        if (typeof online === 'boolean') {
            return online;
        }
    }

    if (typeof driverLike.online === 'boolean') {
        return driverLike.online;
    }

    return fallback;
};

const DriverOnlineToggle = ({ showLabel = false }) => {
    const { isDarkMode } = useAppTheme();
    const { t } = useLanguage();
    const { language } = useLanguage();
    const localeCode = language?.code === 'ru' || language?.code === 'ky' ? language.code : 'en';
    const { isOnline, toggleOnline, isUpdating, driverStatus } = useAuth();
    const [checked, setChecked] = useState(isOnline);

    const isBlocked = !canDriverGoOnline(driverStatus);

    const onCheckedChange = async (nextChecked) => {
        if (isBlocked) {
            const msg = getOnlineBlockMessage(driverStatus, localeCode);
            Alert.alert(msg.title, msg.message, [{ text: 'OK' }]);
            return;
        }

        setChecked(nextChecked);

        try {
            const updatedDriver = await toggleOnline(nextChecked);
            const nextStatus = resolveOnlineStatus(updatedDriver, nextChecked);
            setChecked(nextStatus);
        } catch (err) {
            setChecked(!nextChecked);
            console.warn('Error attempting to change driver online status:', err);
        }
    };

    useEffect(() => {
        setChecked(isOnline);
    }, [isOnline]);

    return (
        <XStack alignItems='center' gap='$2'>
            <Switch
                id='driverOnline'
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={isUpdating}
                opacity={isUpdating || isBlocked ? 0.5 : 1}
                bg={checked ? '$green-600' : '$gray-500'}
                borderWidth={1}
                borderColor={isDarkMode ? '$gray-700' : '$white'}
            >
                <Switch.Thumb animation='quick' bg={isDarkMode ? '$gray-200' : '$white'} borderColor={isDarkMode ? '$gray-700' : '$gray-500'} borderWidth={1} />
            </Switch>
            {showLabel === true && (
                <Label htmlFor='driverOnline' color='$gray-500' size='$2' lineHeight='$4'>
                    {isBlocked
                        ? (localeCode === 'ru' ? 'Выйти на линию' : localeCode === 'ky' ? 'Линияга чыгуу' : 'Go online')
                        : checked ? t('DriverDashboard.onlineStatusOn') : t('DriverDashboard.onlineStatusOff')}
                </Label>
            )}
        </XStack>
    );
};

export default DriverOnlineToggle;
