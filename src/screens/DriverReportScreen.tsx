import { useState, useMemo, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Pressable, FlatList, RefreshControl, StatusBar, View } from 'react-native';
import { Text, YStack, XStack, Button, Separator, Image, useTheme } from 'tamagui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faPenToSquare } from '@fortawesome/free-solid-svg-icons';
import { singularize } from 'inflected';
import { format } from 'date-fns';
import { titleize, formatCurrency } from '../utils/format';
import { later } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useTempStore } from '../contexts/TempStoreContext';
import { useLanguage } from '../contexts/LanguageContext';
import TabSwitch from '../components/TabSwitch';
import Badge from '../components/Badge';
import Spacer from '../components/Spacer';
import useStorage from '../hooks/use-storage';
import useFleetbase from '../hooks/use-fleetbase';
import GlassHeader from '../components/GlassHeader';

const DriverReportScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const { t } = useLanguage();
    const { driver } = useAuth();
    const { adapter } = useFleetbase();
    const { setValue } = useTempStore();
    const [issues, setIssues] = useStorage(`${driver?.id}_issues`, []);
    const [fuelReports, setFuelReports] = useStorage(`${driver?.id}_fuel_reports`, []);
    const [currentTab, setCurrentTab] = useStorage('current_reports_tab', 'issue');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const reportOptions = [
        { value: 'issue', label: t('Core.IssueScreen.issues') },
        { value: 'fuel-report', label: t('DriverReport.fuelReports') },
    ];

    const currentIndex = reportOptions.findIndex((option) => option.value === currentTab);
    const content = useMemo(() => (currentTab === 'issue' ? issues : fuelReports), [currentTab, issues, fuelReports]);

    const handleCreate = useCallback(() => {
        if (currentTab === 'issue') {
            navigation.navigate('CreateIssue');
        } else {
            navigation.navigate('CreateFuelReport');
        }
    }, [currentTab, navigation]);

    const handleOpenIssue = useCallback(
        (issue) => {
            setValue('issue', issue);
            later(() => navigation.navigate('Issue'), 300);
        },
        [navigation, setValue]
    );

    const handleOpenFuelReport = useCallback(
        (fuelReport) => {
            setValue('fuelReport', fuelReport);
            later(() => navigation.navigate('FuelReport'), 300);
        },
        [navigation, setValue]
    );

    const loadIssues = useCallback(
        async (params = {}) => {
            try {
                const issues = await adapter.get('issues', { driver: driver.id, sort: '-created_at', ...params });
                setIssues(issues);
            } catch (err) {
                console.warn('Error loading issues:', err);
            }
        },
        [adapter, driver?.id, setIssues]
    );

    const loadFuelReports = useCallback(
        async (params = {}) => {
            try {
                const fuelReports = await adapter.get('fuel-reports', { driver: driver.id, sort: '-created_at', ...params });
                setFuelReports(fuelReports);
            } catch (err) {
                console.warn('Error loading fuel reports:', err);
            }
        },
        [adapter, driver?.id, setFuelReports]
    );

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            if (currentTab === 'issue') {
                await loadIssues();
            } else {
                await loadFuelReports();
            }
        } catch (err) {
            console.warn(`Error reloading ${titleize(currentTab)}:`, err);
        } finally {
            setIsRefreshing(false);
        }
    }, [currentTab, loadIssues, loadFuelReports]);

    const renderIssues = ({ item: issue }) => (
        <Pressable onPress={() => handleOpenIssue(issue)}>
            <YStack py='$3' px='$2'>
                <YStack borderWidth={1} borderColor='$borderColor' borderRadius='$6' gap='$3' bg='$surface'>
                    <XStack bg='$secondary' py='$3' px='$3' borderBottomWidth={1} borderColor='$borderColor' space='$2' borderTopLeftRadius='$6' borderTopRightRadius='$6'>
                        <Text size='$5' color='$textSecondary' fontWeight='bold' numberOfLines={1}>
                            {t('DriverReport.issueOn')}
                        </Text>
                        <Text size='$5' color='$textPrimary' fontWeight='bold' numberOfLines={1}>
                            {format(new Date(issue.created_at), 'MMM dd, yyyy HH:mm')}
                        </Text>
                    </XStack>
                    <YStack pb='$2' px='$3' gap='$2'>
                        <XStack gap='$2'>
                            <XStack gap='$2' alignItems='center'>
                                <Text fontWeight='bold'>{t('Core.IssueScreen.status')}:</Text>
                                <Badge status={issue.status} alignSelf='flex-start' py='$1' px='$2' borderRadius='$3' numberOfLines={1} />
                            </XStack>
                            <XStack gap='$2' alignItems='center'>
                                <Text fontWeight='bold'>{t('Core.IssueScreen.priority')}:</Text>
                                <Badge status={issue.priority} alignSelf='flex-start' py='$1' px='$2' borderRadius='$3' numberOfLines={1} />
                            </XStack>
                        </XStack>
                        <YStack flex={1} gap='$2'>
                            <Text fontWeight='bold'>{t('Core.IssueScreen.report')}:</Text>
                            <Text color='$textSecondary' numberOfLines={3}>
                                {issue.report}
                            </Text>
                        </YStack>
                    </YStack>
                    <Separator />
                    <YStack pb='$2' gap='$2'>
                        <YStack gap='$3'>
                            <XStack gap='$2' px='$3' justifyContent='space-between'>
                                <Text fontWeight='bold'>{t('Core.IssueScreen.type')}:</Text>
                                <Text numberOfLines={1}>{titleize(issue.type) ?? t('OrderScreen.notAvailable')}</Text>
                            </XStack>
                            <Separator />
                            <XStack gap='$2' px='$3' justifyContent='space-between'>
                                <Text fontWeight='bold'>{t('Core.IssueScreen.category')}:</Text>
                                <Text numberOfLines={1}>{titleize(issue.category) ?? t('OrderScreen.notAvailable')}</Text>
                            </XStack>
                            <Separator />
                            <XStack gap='$2' px='$3' justifyContent='space-between'>
                                <Text fontWeight='bold'>{t('Core.IssueScreen.vehicleName')}:</Text>
                                <Text numberOfLines={1}>{issue.vehicle_name ?? t('OrderScreen.notAvailable')}</Text>
                            </XStack>
                            <Separator />
                            <XStack gap='$2' px='$3' pb='$2' justifyContent='space-between'>
                                <Text fontWeight='bold'>{t('DriverReport.reporter')}:</Text>
                                <Text numberOfLines={1}>{issue.reporter_name ?? t('OrderScreen.notAvailable')}</Text>
                            </XStack>
                        </YStack>
                    </YStack>
                </YStack>
            </YStack>
        </Pressable>
    );

    const renderFuelReports = ({ item: fuelReport }) => (
        <Pressable onPress={() => handleOpenFuelReport(fuelReport)}>
            <YStack py='$3' px='$2'>
                <YStack borderWidth={1} borderColor='$borderColor' borderRadius='$6' gap='$3' bg='$surface'>
                    <XStack alignItems='center' justifyContent='space-between' bg='$secondary' py='$3' px='$3' borderBottomWidth={1} borderColor='$borderColor' space='$2' borderTopLeftRadius='$6' borderTopRightRadius='$6'>
                        <XStack space='$2'>
                            <Text size='$5' color='$textSecondary' fontWeight='bold' numberOfLines={1}>
                                {t('DriverReport.fuelReported')}
                            </Text>
                            <Text size='$5' color='$textPrimary' fontWeight='bold' numberOfLines={1}>
                                {format(new Date(fuelReport.created_at), 'MMM dd, yyyy HH:mm')}
                            </Text>
                        </XStack>
                    </XStack>
                    <YStack px='$3' gap='$3'>
                        <XStack gap='$2' alignItems='center'>
                            <Text fontWeight='bold'>{t('Core.IssueScreen.status')}:</Text>
                            <Badge status={fuelReport.status} alignSelf='flex-start' py='$1' px='$2' borderRadius='$3' numberOfLines={1} />
                        </XStack>
                        <XStack space='$2'>
                            <YStack>
                                <Image source={{ uri: fuelReport.vehicle.photo_url }} width={42} height={42} borderRadius='$4' borderWidth={1} borderColor='$borderColor' />
                            </YStack>
                            <YStack space='$1'>
                                <Text color='$textPrimary' fontWeight='bold'>
                                    {fuelReport.vehicle.name}
                                </Text>
                                <Text color='$textSecondary'>{fuelReport.vehicle.plate_number ?? fuelReport.vehicle.id}</Text>
                            </YStack>
                        </XStack>
                    </YStack>
                    <Separator />
                    <YStack pb='$2' gap='$2'>
                        <YStack gap='$3'>
                            <XStack gap='$2' px='$3' justifyContent='space-between'>
                                <Text fontWeight='bold'>{t('FuelReportForm.odometer')}:</Text>
                                <Text numberOfLines={1}>{fuelReport.odometer ?? t('OrderScreen.notAvailable')}</Text>
                            </XStack>
                            <Separator />
                            <XStack gap='$2' px='$3' justifyContent='space-between'>
                                <Text fontWeight='bold'>{t('FuelReportForm.volume')}:</Text>
                                <Text numberOfLines={1}>{`${fuelReport.volume} ${fuelReport.metric_unit}` ?? t('OrderScreen.notAvailable')}</Text>
                            </XStack>
                            <Separator />
                            <XStack gap='$2' px='$3' pb='$2' justifyContent='space-between'>
                                <Text fontWeight='bold'>{t('FuelReportForm.cost')}:</Text>
                                <Text numberOfLines={1}>{formatCurrency(fuelReport.amount, fuelReport.currency) ?? t('OrderScreen.notAvailable')}</Text>
                            </XStack>
                        </YStack>
                    </YStack>
                </YStack>
            </YStack>
        </Pressable>
    );

    useFocusEffect(
        useCallback(() => {
            if (!adapter) return;
            loadIssues();
            loadFuelReports();
        }, [adapter, loadIssues, loadFuelReports])
    );

    const insets = useSafeAreaInsets();
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={{ flex: 1, backgroundColor: theme.background?.val ?? '#F2F2F7' }}>
            <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
            <GlassHeader title="Отчеты" />
            <FlatList
                data={content}
                keyExtractor={(item, index) => `${item?.id ?? index}`}
                renderItem={currentTab === 'issue' ? renderIssues : renderFuelReports}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={theme.primary.val} />}
                ItemSeparatorComponent={() => <Separator borderBottomWidth={1} borderColor='$borderColor' />}
                stickyHeaderIndices={[0]}
                contentContainerStyle={{ paddingTop: topInset + 48 }}
                ListHeaderComponent={
                    <YStack px='$2' pt='$4' bg='$background'>
                        <TabSwitch initialIndex={currentIndex} options={reportOptions} onTabChange={setCurrentTab} />
                    </YStack>
                }
                ListFooterComponent={<Spacer height={200} />}
                ListEmptyComponent={
                    <YStack height={500} width='100%' flex={1} alignItems='center' justifyContent='center' px='$5'>
                        <Text color='$textPrimary' fontSize={22} textAlign='center'>
                            {t('DriverReport.noReports', { label: reportOptions[currentIndex].label })}
                        </Text>
                    </YStack>
                }
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
            />
            <YStack bg='$background' position='absolute' bottom={0} left={0} right={0} borderTopWidth={1} borderColor='$borderColor'>
                <YStack px='$3' py='$4'>
                    <Button onPress={handleCreate} bg='$primary' borderWidth={1} borderColor='$primaryBorder' height={52} borderRadius='$10'>
                        <Button.Icon>
                            <FontAwesomeIcon icon={faPenToSquare} color={theme.primaryText.val} size={16} />
                        </Button.Icon>
                        <Button.Text color='$primaryText' fontSize={16} fontWeight='700'>
                            {t('DriverReport.createNewReport', { type: singularize(reportOptions[currentIndex].label) })}
                        </Button.Text>
                    </Button>
                </YStack>
            </YStack>
        </View>
    );
};

export default DriverReportScreen;
