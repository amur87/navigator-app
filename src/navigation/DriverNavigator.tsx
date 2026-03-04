import { createStaticNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faHome,
    faGaugeHigh,
    faComments,
    faWalkieTalkie,
    faClipboardList,
    faClipboard,
    faChartLine,
    faUser,
    faTriangleExclamation,
    faFlag,
    faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { Text, View, XStack, Image } from 'tamagui';
import { navigatorConfig, get, config, toArray } from '../utils';
import { configCase } from '../utils/format';
import { format } from 'date-fns';
import { PortalHost } from '@gorhom/portal';
import { useIsNotAuthenticated, useIsAuthenticated } from '../contexts/AuthContext';
import { useTempStore } from '../contexts/TempStoreContext';
import DriverDashboardScreen from '../screens/DriverDashboardScreen';
import DriverOrderManagementScreen from '../screens/DriverOrderManagementScreen';
import OrderScreen from '../screens/OrderScreen';
import EntityScreen from '../screens/EntityScreen';
import ProofOfDeliveryScreen from '../screens/ProofOfDeliveryScreen';
import DriverReportScreen from '../screens/DriverReportScreen';
import CreateIssueScreen from '../screens/CreateIssueScreen';
import EditIssueScreen from '../screens/EditIssueScreen';
import IssueScreen from '../screens/IssueScreen';
import CreateFuelReportScreen from '../screens/CreateFuelReportScreen';
import EditFuelReportScreen from '../screens/EditFuelReportScreen';
import FuelReportScreen from '../screens/FuelReportScreen';
import ChatHomeScreen from '../screens/ChatHomeScreen';
import ChatChannelScreen from '../screens/ChatChannelScreen';
import ChatParticipantsScreen from '../screens/ChatParticipantsScreen';
import CreateChatChannelScreen from '../screens/CreateChatChannelScreen';
import DriverProfileScreen from '../screens/DriverProfileScreen';
import DriverAccountScreen from '../screens/DriverAccountScreen';
import EditAccountPropertyScreen from '../screens/EditAccountPropertyScreen';
import { useOrderManager } from '../contexts/OrderManagerContext';
import { useChat } from '../contexts/ChatContext';
import DriverLayout from '../layouts/DriverLayout';
import useAppTheme from '../hooks/use-app-theme';
import DriverOnlineToggle from '../components/DriverOnlineToggle';
import BackButton from '../components/BackButton';
import HeaderButton from '../components/HeaderButton';
import Badge from '../components/Badge';
import DeviceInfo from 'react-native-device-info';
import I18n from 'react-native-i18n';

const isAndroid = Platform.OS === 'android';
const appDisplayName = config('APP_NAME', 'max.kg');
const YANDEX_YELLOW = '#FFCC00';
const YANDEX_BLACK = '#1F1F1F';
const YANDEX_HEADER_LIGHT = '#F5F5F5';
const YANDEX_LIGHT_BG = '#F5F5F5';
const YANDEX_LIGHT_MUTED = '#737373';
const YANDEX_DARK_BG = '#1F1F1F';
const YANDEX_DARK_MUTED = '#B8B8B8';
const importedIconsMap = {
    faHome,
    faGaugeHigh,
    faComments,
    faWalkieTalkie,
    faClipboardList,
    faClipboard,
    faChartLine,
    faUser,
    faTriangleExclamation,
    faFlag,
};

function getTabConfig(name, key, defaultValue = null) {
    const tabs = navigatorConfig('tabs');
    const tab = tabs.find(({ name: tabName }) => name === tabName);
    if (tab) {
        return get(tab, key, defaultValue);
    }

    return defaultValue;
}

function createTabScreens() {
    const tabs = toArray(navigatorConfig('driverNavigator.tabs', 'DriverDashboardTab,DriverTaskTab,DriverReportTab,DriverChatTab,DriverAccountTab'));
    const screens = {
        DriverDashboardTab: {
            screen: DriverDashboardTab,
            options: {
                tabBarLabel: config('DRIVER_DASHBOARD_TAB_LABEL', 'Dash'),
            },
        },
        DriverTaskTab: {
            screen: DriverTaskTab,
            options: () => {
                const { allActiveOrders } = useOrderManager();

                return {
                    tabBarLabel: config('DRIVER_ORDER_TAB_LABEL', 'Orders'),
                    tabBarBadge: allActiveOrders.length,
                    tabBarBadgeStyle: {
                        marginRight: -5,
                        opacity: allActiveOrders.length ? 1 : 0.5,
                    },
                };
            },
        },
        DriverReportTab: {
            screen: DriverReportTab,
            options: () => {
                return {
                    tabBarLabel: config('DRIVER_REPORT_TAB_LABEL', 'Reports'),
                };
            },
        },
        DriverChatTab: {
            screen: DriverChatTab,
            options: () => {
                const { unreadCount } = useChat();

                return {
                    tabBarLabel: config('DRIVER_CHAT_TAB_LABEL', 'Chat'),
                    tabBarBadge: unreadCount,
                    tabBarBadgeStyle: {
                        marginRight: -5,
                        opacity: unreadCount ? 1 : 0.5,
                    },
                };
            },
        },
        DriverAccountTab: {
            screen: DriverAccountTab,
            options: () => {
                return {
                    tabBarLabel: config('DRIVER_ACCOUNT_TAB_LABEL', 'Account'),
                };
            },
        },
    };

    const screenTabs = {};
    for (let i = 0; i < tabs.length; i++) {
        const tab = tabs[i];
        if (tab) {
            screenTabs[tab] = screens[tab];
        }
    }

    return screenTabs;
}

function getDefaultTabIcon(routeName) {
    // Check if able to load from config/env setting first
    const routeIconConfig = config(`${configCase(routeName)}_ICON`);
    if (routeIconConfig && importedIconsMap[routeIconConfig]) {
        return importedIconsMap[routeIconConfig];
    }

    let icon;
    switch (routeName) {
        case 'DriverDashboardTab':
            icon = faGaugeHigh;
            break;
        case 'DriverTaskTab':
            icon = faClipboardList;
            break;
        case 'DriverReportTab':
            icon = faFlag;
            break;
        case 'DriverChatTab':
            icon = faWalkieTalkie;
            break;
        case 'DriverAccountTab':
            icon = faUser;
            break;
    }

    return icon;
}

function getDriverNavigatorHeaderOptions({ route, navigation }) {
    return {
        headerTitle: '',
        headerLeft: (props) => (
            <Text color={YANDEX_BLACK} fontSize={20} fontWeight='bold'>
                {appDisplayName}
            </Text>
        ),
        headerRight: (props) => <DriverOnlineToggle {...props} />,
        headerStyle: {
            backgroundColor: YANDEX_HEADER_LIGHT,
            headerTintColor: YANDEX_BLACK,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
        },
        headerShadowVisible: false,
    };
}

const DriverDashboardTab = createNativeStackNavigator({
    initialRouteName: 'DriverDashboard',
    screens: {
        DriverDashboard: {
            screen: DriverDashboardScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                };
            },
        },
    },
});

const DriverTaskTab = createNativeStackNavigator({
    initialRouteName: 'DriverOrderManagement',
    screens: {
        DriverOrderManagement: {
            screen: DriverOrderManagementScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                };
            },
        },
        Order: {
            screen: OrderScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                };
            },
        },
        OrderModal: {
            screen: OrderScreen,
            options: ({ route, navigation }) => {
                const order = route.params.order;
                return {
                    presentation: 'modal',
                    headerTitle: '',
                    headerLeft: (props) => (
                        <Text color='$textPrimary' fontSize={20} fontWeight='bold' numberOfLines={1}>
                            {order.id}
                        </Text>
                    ),
                    headerRight: (props) => <HeaderButton icon={faTimes} onPress={() => navigation.goBack()} />,
                    headerStyle: {
                        backgroundColor: YANDEX_HEADER_LIGHT,
                        headerTintColor: YANDEX_BLACK,
                    },
                };
            },
        },
        Entity: {
            screen: EntityScreen,
            options: ({ route, navigation }) => {
                const params = route.params ?? {};
                const entity = params.entity;

                return {
                    headerTitle: '',
                    headerShown: true,
                    headerLeft: (props) => (
                        <Text color='$textPrimary' fontSize={20} fontWeight='bold' numberOfLines={1}>
                            {entity.name ?? entity.tracking_number.tracking_number}
                        </Text>
                    ),
                    headerRight: (props) => (
                        <XStack alignItems='center' space='$2'>
                            <Badge status={entity.tracking_number.status_code.toLowerCase()} />
                            <HeaderButton icon={faTimes} onPress={() => navigation.goBack()} />
                        </XStack>
                    ),
                    headerStyle: {
                        backgroundColor: YANDEX_HEADER_LIGHT,
                        headerTintColor: YANDEX_BLACK,
                    },
                    presentation: 'modal',
                };
            },
        },
        ProofOfDelivery: {
            screen: ProofOfDeliveryScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                };
            },
        },
    },
});

const DriverReportTab = createNativeStackNavigator({
    initialRouteName: 'DriverReport',
    screens: {
        DriverReport: {
            screen: DriverReportScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                };
            },
        },
        CreateFuelReport: {
            screen: CreateFuelReportScreen,
            options: ({ route, navigation }) => {
                return {
                    presentation: 'modal',
                    headerTitle: '',
                    headerLeft: (props) => (
                            <Text color='$textPrimary' fontSize={20} fontWeight='bold'>
                                {I18n.t('DriverNavigator.createFuelReportTitle')}
                            </Text>
                    ),
                    headerRight: (props) => <HeaderButton icon={faTimes} onPress={() => navigation.goBack()} />,
                    headerStyle: {
                        backgroundColor: YANDEX_HEADER_LIGHT,
                        headerTintColor: YANDEX_BLACK,
                    },
                };
            },
        },
        EditFuelReport: {
            screen: EditFuelReportScreen,
            options: ({ route, navigation }) => {
                const params = route.params || {};
                const fuelReport = params.fuelReport;

                return {
                    presentation: 'modal',
                    headerTitle: '',
                    headerLeft: (props) => (
                            <Text color='$textPrimary' fontSize={18} fontWeight='bold' numberOfLines={1}>
                                {I18n.t('DriverNavigator.editFuelReportFrom', { date: format(new Date(fuelReport.created_at), 'MMM dd, yyyy HH:mm') })}
                            </Text>
                    ),
                    headerRight: (props) => <HeaderButton icon={faTimes} onPress={() => navigation.goBack()} />,
                    headerStyle: {
                        backgroundColor: YANDEX_HEADER_LIGHT,
                        headerTintColor: YANDEX_BLACK,
                    },
                };
            },
        },
        FuelReport: {
            screen: FuelReportScreen,
            options: ({ route, navigation }) => {
                const {
                    store: { fuelReport },
                } = useTempStore();

                return {
                    presentation: 'modal',
                    headerTitle: '',
                    headerLeft: (props) => (
                        <Text color='$textPrimary' fontSize={18} fontWeight='bold' numberOfLines={1}>
                            {format(new Date(fuelReport.created_at), 'MMM dd, yyyy HH:mm')}
                        </Text>
                    ),
                    headerRight: (props) => <PortalHost name='FuelReportScreenHeaderRightPortal' />,
                    headerStyle: {
                        backgroundColor: YANDEX_HEADER_LIGHT,
                        headerTintColor: YANDEX_BLACK,
                    },
                };
            },
        },
        CreateIssue: {
            screen: CreateIssueScreen,
            options: ({ route, navigation }) => {
                return {
                    presentation: 'modal',
                    headerTitle: '',
                    headerLeft: (props) => (
                            <Text color='$textPrimary' fontSize={20} fontWeight='bold'>
                                {I18n.t('DriverNavigator.createIssueTitle')}
                            </Text>
                    ),
                    headerRight: (props) => <HeaderButton icon={faTimes} onPress={() => navigation.goBack()} />,
                    headerStyle: {
                        backgroundColor: YANDEX_HEADER_LIGHT,
                        headerTintColor: YANDEX_BLACK,
                    },
                };
            },
        },
        EditIssue: {
            screen: EditIssueScreen,
            options: ({ route, navigation }) => {
                const params = route.params || {};
                const issue = params.issue;

                return {
                    presentation: 'modal',
                    headerTitle: '',
                    headerLeft: (props) => (
                            <Text color='$textPrimary' fontSize={18} fontWeight='bold' numberOfLines={1}>
                                {I18n.t('DriverNavigator.editIssueFrom', { date: format(new Date(issue.created_at), 'MMM dd, yyyy HH:mm') })}
                            </Text>
                    ),
                    headerRight: (props) => <HeaderButton icon={faTimes} onPress={() => navigation.goBack()} />,
                    headerStyle: {
                        backgroundColor: YANDEX_HEADER_LIGHT,
                        headerTintColor: YANDEX_BLACK,
                    },
                };
            },
        },
        Issue: {
            screen: IssueScreen,
            options: ({ route, navigation }) => {
                const {
                    store: { issue },
                } = useTempStore();

                return {
                    presentation: 'modal',
                    headerTitle: '',
                    headerLeft: (props) => (
                        <Text color='$textPrimary' fontSize={18} fontWeight='bold' numberOfLines={1}>
                            {format(new Date(issue.created_at), 'MMM dd, yyyy HH:mm')}
                        </Text>
                    ),
                    headerRight: (props) => <PortalHost name='IssueScreenHeaderRightPortal' />,
                    headerStyle: {
                        backgroundColor: YANDEX_HEADER_LIGHT,
                        headerTintColor: YANDEX_BLACK,
                    },
                };
            },
        },
    },
});

const DriverChatTab = createNativeStackNavigator({
    initialRouteName: 'ChatHome',
    screens: {
        ChatHome: {
            screen: ChatHomeScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                };
            },
        },
        ChatChannel: {
            screen: ChatChannelScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                };
            },
        },
        ChatParticipants: {
            screen: ChatParticipantsScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                    presentation: 'modal',
                };
            },
        },
        CreateChatChannel: {
            screen: CreateChatChannelScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                    presentation: 'modal',
                };
            },
        },
    },
});

const DriverAccountTab = createNativeStackNavigator({
    initialRouteName: 'DriverAccount',
    screens: {
        DriverProfile: {
            screen: DriverProfileScreen,
            options: ({ route, navigation }) => {
                return {
                    headerShown: false,
                };
            },
        },
        DriverAccount: {
            screen: DriverAccountScreen,
            options: ({ route, navigation }) => {
                return {
                    title: '',
                    headerTransparent: true,
                    headerShadowVisible: false,
                    headerLeft: () => {
                        return <BackButton onPress={() => navigation.goBack()} />;
                    },
                };
            },
        },
        EditAccountProperty: {
            screen: EditAccountPropertyScreen,
            options: () => {
                return {
                    headerShown: false,
                };
            },
        },
    },
});

const DriverNavigator = createBottomTabNavigator({
    layout: DriverLayout,
    screenOptions: ({ route, navigation }) => {
        const { isDarkMode } = useAppTheme();
        const navBg = isDarkMode ? YANDEX_DARK_BG : YANDEX_LIGHT_BG;
        const textColor = isDarkMode ? '#FFFFFF' : YANDEX_BLACK;
        const mutedColor = isDarkMode ? YANDEX_DARK_MUTED : YANDEX_LIGHT_MUTED;
        const focusedColor = YANDEX_YELLOW;
        const blurredColor = mutedColor;

        return {
            headerShown: false,
            tabBarStyle: { display: 'none' },
        };
    },
    screens: createTabScreens(),
});

export default DriverNavigator;
