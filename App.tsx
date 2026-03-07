import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TamaguiProvider, Theme } from 'tamagui';
import { Toasts } from '@backpackapp-io/react-native-toast';
import { PortalProvider, PortalHost } from '@gorhom/portal';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider } from './src/contexts/AuthContext';
import { SocketClusterProvider } from './src/contexts/SocketClusterContext';
import { OrderManagerProvider } from './src/contexts/OrderManagerContext';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { TempStoreProvider } from './src/contexts/TempStoreContext';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useThemeContext } from './src/contexts/ThemeContext';
import { NotificationProvider } from './src/contexts/NotificationContext';
import { ChatProvider } from './src/contexts/ChatContext';
import { LocationProvider } from './src/contexts/LocationContext';
import { ConfigProvider } from './src/contexts/ConfigContext';
import config from './tamagui.config';
import BootSplash from 'react-native-bootsplash';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

console.log('[bootstrap] App.tsx module evaluated');

RNText.defaultProps = RNText.defaultProps || {};
RNText.defaultProps.style = [RNText.defaultProps.style, { fontFamily: 'Rubik-Regular' }];

RNTextInput.defaultProps = RNTextInput.defaultProps || {};
RNTextInput.defaultProps.style = [RNTextInput.defaultProps.style, { fontFamily: 'Rubik-Regular' }];

function AppContent(): React.JSX.Element {
    const { appTheme } = useThemeContext();

    console.log('[bootstrap] AppContent render start', { appTheme });

    useEffect(() => {
        console.log('[bootstrap] AppContent mounted');
        const timer = setTimeout(async () => {
            try {
                console.log('[bootstrap] BootSplash.hide requested');
                await BootSplash.hide({ fade: true });
                console.log('[bootstrap] BootSplash.hide resolved');
            } catch {}
        }, 250);

        return () => clearTimeout(timer);
    }, []);

    return (
        <TamaguiProvider config={config} theme={appTheme}>
            <Theme name={appTheme}>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <SafeAreaProvider>
                        <BottomSheetModalProvider>
                            <ConfigProvider>
                                <NotificationProvider>
                                    <LanguageProvider>
                                        <AuthProvider>
                                            <SocketClusterProvider>
                                                <LocationProvider>
                                                    <TempStoreProvider>
                                                        <ChatProvider>
                                                            <OrderManagerProvider>
                                                                <AppNavigator />
                                                                <Toasts extraInsets={{ bottom: 80 }} />
                                                                <PortalHost name='MainPortal' />
                                                                <PortalHost name='BottomSheetPanelPortal' />
                                                                <PortalHost name='LocationPickerPortal' />
                                                            </OrderManagerProvider>
                                                        </ChatProvider>
                                                    </TempStoreProvider>
                                                </LocationProvider>
                                            </SocketClusterProvider>
                                        </AuthProvider>
                                    </LanguageProvider>
                                </NotificationProvider>
                            </ConfigProvider>
                        </BottomSheetModalProvider>
                    </SafeAreaProvider>
                </GestureHandlerRootView>
            </Theme>
        </TamaguiProvider>
    );
}

function App(): React.JSX.Element {
    return (
        <PortalProvider>
            <ThemeProvider>
                <AppContent />
            </ThemeProvider>
        </PortalProvider>
    );
}

export default App;
