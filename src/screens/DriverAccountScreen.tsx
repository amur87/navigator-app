import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView, FlatList, Pressable, ScrollView, Platform, Linking } from 'react-native';
import { Spinner, Avatar, Text, YStack, XStack, Separator, Button, Switch, useTheme } from 'tamagui';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { toast, ToastPosition } from '@backpackapp-io/react-native-toast';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { showActionSheet, abbreviateName } from '../utils';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import useAppTheme from '../hooks/use-app-theme';
import DeviceInfo from 'react-native-device-info';
import storage from '../utils/storage';

const DriverAccountScreen = () => {
    const theme = useTheme();
    const navigation = useNavigation();
    const { t, language, languages, setLocale } = useLanguage();
    const isCyrillic = language.code === 'ru' || language.code === 'ky';
    const { userColorScheme, changeScheme } = useAppTheme();
    const { driver, logout, isSigningOut, updateDriver, switchOrganization, organizations } = useAuth();
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const languageLabels: Record<string, string> = {
        ru: 'Русский',
        ky: 'Кыргызча',
        en: 'English',
    };
    const languageFlags: Record<string, string> = {
        ru: '🇷🇺',
        ky: '🇰🇬',
        en: '🇺🇸',
    };
    const preferredLanguageCodes = ['ru', 'ky', 'en'];

    const getThemeLabel = (scheme: string) => {
        const isDark = scheme === 'dark';
        if (language.code === 'ru') {
            return isDark ? 'Темная' : 'Светлая';
        }
        if (language.code === 'ky') {
            return isDark ? 'Караңгы' : 'Жарык';
        }
        return isDark ? 'Dark' : 'Light';
    };

    const handleClearCache = () => {
        storage.clearStore();
        toast.success(t('AccountScreen.cacheCleared'), { position: ToastPosition.BOTTOM });
    };

    const getDriverValue = (key, fallback = '') => {
        if (!driver) {
            return fallback;
        }

        if (typeof driver.getAttribute === 'function') {
            return driver.getAttribute(key) ?? fallback;
        }

        return driver?.[key] ?? fallback;
    };

    if (!driver) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
                <YStack flex={1} alignItems='center' justifyContent='center' bg='$background' space='$3'>
                    <Spinner color='$textPrimary' />
                    <Text color='$textSecondary'>{t('common.loading')}</Text>
                </YStack>
            </SafeAreaView>
        );
    }

    const handleSignout = () => {
        logout();
        toast.success(t('AccountScreen.signedOut'));
    };

    const handleOpenTermsOfService = async () => {
        const url = 'https://www.fleetbase.io/terms';
        const supported = await Linking.canOpenURL(url);

        if (supported) {
            await Linking.openURL(url);
        } else {
            console.warn(`Can't open URL: ${url}`);
        }
    };

    const handleOpenPrivacyPolicy = async () => {
        const url = 'https://www.fleetbase.io/privacy-policy';
        const supported = await Linking.canOpenURL(url);

        if (supported) {
            await Linking.openURL(url);
        } else {
            console.warn(`Can't open URL: ${url}`);
        }
    };

    const handleChangeProfilePhoto = () => {
        showActionSheet({
            options: [
                t('AccountScreen.changeProfilePhotoOptions.takePhoto'),
                t('AccountScreen.changeProfilePhotoOptions.photoLibrary'),
                t('AccountScreen.changeProfilePhotoOptions.deleteProfilePhoto'),
                t('common.cancel'),
            ],
            cancelButtonIndex: 3,
            destructiveButtonIndex: 2,
            onSelect: (buttonIndex) => {
                switch (buttonIndex) {
                    case 0:
                        launchCamera(
                            {
                                title: t('AccountScreen.changeProfilePhotoOptions.takePhoto'),
                                includeBase64: true,
                                storageOptions: {
                                    skipBackup: true,
                                    path: 'images',
                                },
                            },
                            (response) => {
                                handleUpdateProfilePhoto(response);
                            }
                        );
                        break;
                    case 1:
                        launchImageLibrary(
                            {
                                title: t('AccountScreen.changeProfilePhotoOptions.photoLibrary'),
                                includeBase64: true,
                                storageOptions: {
                                    skipBackup: true,
                                    path: 'images',
                                },
                            },
                            (response) => {
                                handleUpdateProfilePhoto(response);
                            }
                        );
                        break;
                    case 2:
                        handleRemoveProfilePhoto();
                        break;
                    default:
                        break;
                }
            },
        });
    };

    const handleUpdateProfilePhoto = async (response) => {
        const asset = response.assets?.[0];
        if (!asset?.base64) {
            return;
        }

        setIsUploadingPhoto(true);

        try {
            await updateDriver({ photo: asset.base64 });
            toast.success(t('AccountScreen.photoChanged'));
        } catch (err) {
            console.warn('Error updating driver profile photo', err);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleRemoveProfilePhoto = async () => {
        setIsUploadingPhoto(true);

        try {
            await updateDriver({ photo: 'REMOVE' });
            toast.success(t('AccountScreen.photoRemoved'));
        } catch (err) {
            console.warn('Error removing driver profile photo', err);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const handleToggleScheme = (enabled: boolean) => {
        const selectedScheme = enabled ? 'dark' : 'light';
        if (selectedScheme === userColorScheme) {
            return;
        }

        changeScheme(selectedScheme);
        toast.success(t('AccountScreen.schemeChanged', { selectedScheme: getThemeLabel(selectedScheme) }), {
            position: ToastPosition.BOTTOM,
        });
    };

    const handleLanguageSelect = () => {
        const orderedLanguages = preferredLanguageCodes
            .map((code) => languages.find((lang) => lang.code === code))
            .filter(Boolean);
        const options = [
            ...orderedLanguages.map((lang) => `${languageFlags[lang.code] ?? lang.emoji ?? '🌐'} ${languageLabels[lang.code] ?? lang.native ?? lang.name ?? lang.code.toUpperCase()}`),
            t('common.cancel'),
        ];

        showActionSheet({
            options,
            cancelButtonIndex: options.length - 1,
            onSelect: (buttonIndex) => {
                if (buttonIndex !== options.length - 1) {
                    const selectedLanguage = orderedLanguages[buttonIndex];
                    setLocale(selectedLanguage.code);
                    toast.success(t('AccountScreen.languageChanged', { selectedLanguage: languageLabels[selectedLanguage.code] ?? selectedLanguage.native }), {
                        position: ToastPosition.BOTTOM,
                    });
                }
            },
        });
    };

    const handleSelectOrganization = () => {
        if (!organizations || organizations.length === 0) {
            return toast.error(t('ProfileScreen.noOrganizations') ?? t('common.unavailable'));
        }

        const options = [...organizations.map((org) => org.name), t('common.cancel')];
        showActionSheet({
            options,
            cancelButtonIndex: options.length - 1,
            onSelect: async (buttonIndex) => {
                if (buttonIndex !== options.length - 1) {
                    try {
                        const selectedOrganization = organizations[buttonIndex];
                        await switchOrganization(selectedOrganization);
                        toast.success(t('ProfileScreen.organizationChanged', { selectedOrganization: selectedOrganization.name }), {
                            position: ToastPosition.BOTTOM,
                        });
                    } catch (err) {
                        console.warn('Error changing organization:', err);
                        toast.error(err?.message ?? t('common.error'));
                    }
                }
            },
        });
    };

    const renderMenuItem = ({ item }) => (
        <Pressable
            onPress={item.onPress}
            style={({ pressed }) => ({
                backgroundColor: pressed ? theme.secondary.val : 'transparent',
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
            })}
        >
            <XStack alignItems='center' space='$3' flex={1}>
                {item.leftComponent}
                <Text fontSize='$6' fontWeight='700' color='$textPrimary' numberOfLines={1}>
                    {item.title}
                </Text>
            </XStack>
            <XStack alignItems='center' space='$2' maxWidth='55%' justifyContent={item.hideChevron ? 'center' : 'flex-end'}>
                {item.rightComponent}
                {!item.hideChevron && <FontAwesomeIcon icon={faChevronRight} size={16} color={theme.textSecondary.val} />}
            </XStack>
        </Pressable>
    );

    const accountMenu = [
        {
            title: t('AccountScreen.profilePhoto'),
            rightComponent: isUploadingPhoto ? (
                <Spinner color='$textPrimary' />
            ) : (
                <Avatar circular size='$2'>
                    <Avatar.Image src={getDriverValue('photo_url', null)} />
                    <Avatar.Fallback backgroundColor='$primary'>
                        <Text color='$primaryText' fontWeight='bold'>
                            {abbreviateName(getDriverValue('name', ''))}
                        </Text>
                    </Avatar.Fallback>
                </Avatar>
            ),
            onPress: () => handleChangeProfilePhoto(),
        },
        {
            title: t('AccountScreen.email'),
            rightComponent: (
                <Text color='$textSecondary' numberOfLines={1}>
                    {getDriverValue('email')}
                </Text>
            ),
            onPress: () => navigation.navigate('EditAccountProperty', { property: { name: t('AccountScreen.email'), key: 'email', component: 'input' } }),
        },
        {
            title: t('AccountScreen.phoneNumber'),
            rightComponent: (
                <Text color='$textSecondary' numberOfLines={1}>
                    {getDriverValue('phone')}
                </Text>
            ),
            onPress: () => navigation.navigate('EditAccountProperty', { property: { name: t('AccountScreen.phoneNumber'), key: 'phone', component: 'phone-input' } }),
        },
        {
            title: t('AccountScreen.name'),
            rightComponent: (
                <Text color='$textSecondary' numberOfLines={1}>
                    {getDriverValue('name')}
                </Text>
            ),
            onPress: () => navigation.navigate('EditAccountProperty', { property: { name: t('AccountScreen.name'), key: 'name', component: 'input' } }),
        },
        {
            title: t('Account.AccountScreen.organization'),
            rightComponent: (
                <Text color='$textSecondary' numberOfLines={1}>
                    {getDriverValue('company_name')}
                </Text>
            ),
            onPress: handleSelectOrganization,
        },
        {
            title: t('AccountScreen.language'),
            rightComponent: (
                <Text color='$textSecondary' numberOfLines={1}>
                    {(languageFlags[language.code] ?? language.emoji ?? '🌐') + ' ' + (languageLabels[language.code] ?? language.native ?? language.name ?? language.code?.toUpperCase())}
                </Text>
            ),
            onPress: handleLanguageSelect,
        },
        {
            title: t('AccountScreen.theme'),
            rightComponent: (
                <XStack alignItems='center' space='$2'>
                    <Text color='$textSecondary' numberOfLines={1}>
                        {getThemeLabel(userColorScheme)}
                    </Text>
                    <Switch
                        id='themeToggle'
                        checked={userColorScheme === 'dark'}
                        onCheckedChange={handleToggleScheme}
                        bg={userColorScheme === 'dark' ? '#112b66' : '#D1D5DB'}
                        borderWidth={0}
                    >
                        <Switch.Thumb animation='quick' bg='#FFFFFF' />
                    </Switch>
                </XStack>
            ),
            onPress: () => handleToggleScheme(userColorScheme !== 'dark'),
            hideChevron: true,
        },
        {
            title: t('AccountScreen.termsOfService'),
            rightComponent: null,
            onPress: handleOpenTermsOfService,
        },
    ];

    const dataProtectionMenu = [
        {
            title: t('AccountScreen.privacyPolicy'),
            rightComponent: null,
            onPress: handleOpenPrivacyPolicy,
        },
        {
            title: t('AccountScreen.clearCache'),
            rightComponent: null,
            onPress: handleClearCache,
        },
    ];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
            <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
                <YStack flex={1} bg='$background' space='$5' pt={Platform.OS === 'android' ? '$10' : '$5'} pb='$6'>
                    <YStack px='$4'>
                        <XStack justifyContent='space-between' alignItems='center'>
                            <Text fontSize='$8' fontWeight='bold' color='$textPrimary' numberOfLines={1}>
                                {t('AccountScreen.account')}
                            </Text>
                            <Text fontSize='$3' color='$textSecondary' numberOfLines={1}>
                                v{DeviceInfo.getVersion()} #{DeviceInfo.getBuildNumber()}
                            </Text>
                        </XStack>
                    </YStack>

                    <YStack mx='$4' borderWidth={1} borderColor='$borderColor' borderRadius='$6' overflow='hidden' bg='$surface'>
                        <FlatList
                            data={accountMenu}
                            keyExtractor={(item) => item.title}
                            renderItem={renderMenuItem}
                            ItemSeparatorComponent={() => <Separator borderBottomWidth={1} borderColor='$borderColor' />}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                        />
                    </YStack>

                    <YStack px='$4'>
                        <Text color='$textPrimary' fontSize='$8' fontWeight='bold'>
                            {t('AccountScreen.dataProtection')}
                        </Text>
                    </YStack>

                    <YStack mx='$4' borderWidth={1} borderColor='$borderColor' borderRadius='$6' overflow='hidden' bg='$surface'>
                        <FlatList
                            data={dataProtectionMenu}
                            keyExtractor={(item) => item.title}
                            renderItem={renderMenuItem}
                            ItemSeparatorComponent={() => <Separator borderBottomWidth={1} borderColor='$borderColor' />}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                            showsHorizontalScrollIndicator={false}
                        />
                    </YStack>

                    <YStack paddingHorizontal='$4' mt='$2'>
                        <Button
                            bg='#112b66'
                            borderWidth={1}
                            borderColor='#112b66'
                            size='$5'
                            onPress={handleSignout}
                            borderRadius='$6'
                            width='100%'
                            justifyContent='center'
                            alignItems='center'
                        >
                            {isSigningOut ? (
                                <Spinner color='#FFFFFF' />
                            ) : (
                                <Button.Text color='#FFFFFF' fontWeight='700' textAlign='center' fontFamily={isCyrillic ? undefined : 'Rubik-Bold'}>
                                    {t('AccountScreen.signOut')}
                                </Button.Text>
                            )}
                        </Button>
                    </YStack>
                </YStack>
            </ScrollView>
        </SafeAreaView>
    );
};

export default DriverAccountScreen;
