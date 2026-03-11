import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Boot, LocationPermission } from './stacks/CoreStack';
import AuthStack from './stacks/AuthStack';
import DriverNavigator from './DriverNavigator';
import { useIsAuthenticated } from '../contexts/AuthContext';
import AppLayout from '../layouts/AppLayout';
import VehicleTypeSelectScreen from '../screens/VehicleTypeSelectScreen';
import FleetSelectScreen from '../screens/FleetSelectScreen';
import VehicleDetailsScreen from '../screens/VehicleDetailsScreen';
import DriverLicenseScreen from '../screens/DriverLicenseScreen';
import RegistrationCompleteScreen from '../screens/RegistrationCompleteScreen';

const registrationScreenOptions = { headerShown: false, gestureEnabled: true };

const RootStack = createNativeStackNavigator({
    initialRouteName: 'LocationPermission',
    layout: AppLayout,
    screens: {
        Boot,
        LocationPermission,
        ...AuthStack,
        VehicleTypeSelect: {
            if: useIsAuthenticated,
            screen: VehicleTypeSelectScreen,
            options: registrationScreenOptions,
        },
        FleetSelect: {
            if: useIsAuthenticated,
            screen: FleetSelectScreen,
            options: registrationScreenOptions,
        },
        VehicleDetails: {
            if: useIsAuthenticated,
            screen: VehicleDetailsScreen,
            options: registrationScreenOptions,
        },
        DriverLicense: {
            if: useIsAuthenticated,
            screen: DriverLicenseScreen,
            options: registrationScreenOptions,
        },
        RegistrationComplete: {
            if: useIsAuthenticated,
            screen: RegistrationCompleteScreen,
            options: { headerShown: false, gestureEnabled: false },
        },
        DriverNavigator: {
            if: useIsAuthenticated,
            screen: DriverNavigator,
            options: { headerShown: false, gestureEnabled: false, animation: 'none' },
        },
    },
});

const AppNavigator = createStaticNavigation(RootStack);
export default AppNavigator;
