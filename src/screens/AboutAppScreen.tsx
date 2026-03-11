import React from 'react';
import { ScrollView, View, Text, StatusBar, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DeviceInfo from 'react-native-device-info';
import GlassHeader from '../components/GlassHeader';

const AboutAppScreen = () => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={styles.screen}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="О приложении" onBackPress={() => navigation.goBack()} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingTop: topInset + 48 + 12 }]}
            >
                <View style={styles.logoCard}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoText}>MM</Text>
                    </View>
                    <Text style={styles.appName}>МаксМакрет Курьер</Text>
                    <Text style={styles.version}>
                        Версия {DeviceInfo.getVersion()} (сборка {DeviceInfo.getBuildNumber()})
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.heading}>О компании</Text>
                    <Text style={styles.body}>
                        ОсОО «МаксМакрет» — технологическая компания, зарегистрированная в Кыргызской Республике. Мы разрабатываем цифровые решения для автоматизации логистики и курьерской доставки на территории Кыргызстана.
                    </Text>

                    <Text style={styles.heading}>О приложении</Text>
                    <Text style={styles.body}>
                        Приложение «МаксМакрет Курьер» предназначено для курьеров и водителей-экспедиторов. Оно позволяет:{'\n\n'}
                        — Получать и принимать заказы на доставку в реальном времени;{'\n'}
                        — Строить оптимальные маршруты с навигацией;{'\n'}
                        — Отслеживать статус и историю выполненных заказов;{'\n'}
                        — Фиксировать подтверждение доставки (фото, подпись);{'\n'}
                        — Общаться с диспетчером и другими участниками через встроенный чат;{'\n'}
                        — Управлять профилем и настройками.
                    </Text>

                    <Text style={styles.heading}>Правовая информация</Text>
                    <Text style={styles.body}>
                        Приложение разработано и принадлежит ОсОО «МаксМакрет». Все права защищены в соответствии с Законом Кыргызской Республики «Об авторском праве и смежных правах».{'\n\n'}
                        Использование приложения регулируется законодательством Кыргызской Республики, включая:{'\n\n'}
                        — Гражданский кодекс КР;{'\n'}
                        — Закон КР «Об информации персонального характера»;{'\n'}
                        — Закон КР «О защите прав потребителей»;{'\n'}
                        — Закон КР «Об авторском праве и смежных правах».
                    </Text>

                    <Text style={styles.heading}>Контакты</Text>
                    <Text style={styles.body}>
                        ОсОО «МаксМакрет»{'\n'}
                        Кыргызская Республика, г. Бишкек{'\n'}
                        E-mail: partner@max.kg
                    </Text>

                    <Text style={styles.copyright}>
                        {'\u00A9'} {new Date().getFullYear()} ОсОО «МаксМакрет». Все права защищены.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F2F2F7' },
    scroll: { paddingHorizontal: 12, paddingBottom: 96, gap: 10 },
    logoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
    },
    logoCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#142A65',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    logoText: {
        fontSize: 24,
        fontFamily: 'Rubik-Black',
        color: '#FFFFFF',
    },
    appName: {
        fontSize: 18,
        fontFamily: 'Rubik-Bold',
        color: '#111111',
        marginBottom: 4,
    },
    version: {
        fontSize: 13,
        fontFamily: 'Rubik-Regular',
        color: '#8E8E93',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 18,
    },
    heading: {
        fontSize: 15,
        fontFamily: 'Rubik-Bold',
        color: '#142A65',
        marginTop: 18,
        marginBottom: 6,
    },
    body: {
        fontSize: 13,
        fontFamily: 'Rubik-Regular',
        color: '#333333',
        lineHeight: 20,
    },
    copyright: {
        fontSize: 12,
        fontFamily: 'Rubik-Medium',
        color: '#8E8E93',
        textAlign: 'center',
        marginTop: 24,
    },
});

export default AboutAppScreen;
