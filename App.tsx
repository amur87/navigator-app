import React, { useEffect, useRef, useState } from 'react';
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
import { Animated, Easing, StyleSheet, View } from 'react-native';

function AppContent(): React.JSX.Element {
    const { appTheme } = useThemeContext();
    const [showSplash, setShowSplash] = useState(true);
    const scale = useRef(new Animated.Value(0.8)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.timing(scale, { toValue: 1.1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(scale, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 350, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]).start(async () => {
            setShowSplash(false);
            try {
                await BootSplash.hide({ fade: true });
            } catch {}
        });
    }, [scale, opacity]);

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
                    {showSplash && (
                        <View style={StyleSheet.absoluteFill} pointerEvents='none'>
                            <View style={styles.splashBackground} />
                            <Animated.Image
                                source={require('./assets/logo_splash.png')}
                                style={[
                                    styles.splashLogo,
                                    {
                                        transform: [{ scale }],
                                        opacity,
                                    },
                                ]}
                                resizeMode='contain'
                            />
                        </View>
                    )}
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

const styles = StyleSheet.create({
    splashBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#112b66',
    },
    splashLogo: {
        position: 'absolute',
        width: '70%',
        height: '20%',
        top: '40%',
        left: '15%',
    },
});
