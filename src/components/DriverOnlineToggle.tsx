import { useState, useEffect } from 'react';
import { Switch, Label, XStack } from 'tamagui';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
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
    const { isOnline, toggleOnline, isUpdating } = useAuth();
    const [checked, setChecked] = useState(isOnline);

    const onCheckedChange = async (nextChecked) => {
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
                opacity={isUpdating ? 0.75 : 1}
                bg={checked ? '$green-600' : '$gray-500'}
                borderWidth={1}
                borderColor={isDarkMode ? '$gray-700' : '$white'}
            >
                <Switch.Thumb animation='quick' bg={isDarkMode ? '$gray-200' : '$white'} borderColor={isDarkMode ? '$gray-700' : '$gray-500'} borderWidth={1} />
            </Switch>
            {showLabel === true && (
                <Label htmlFor='driverOnline' color='$gray-500' size='$2' lineHeight='$4'>
                    {checked ? t('DriverDashboard.onlineStatusOn') : t('DriverDashboard.onlineStatusOff')}
                </Label>
            )}
        </XStack>
    );
};

export default DriverOnlineToggle;
