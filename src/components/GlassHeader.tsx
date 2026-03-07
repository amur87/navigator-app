import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { getMaterialRipple } from '../utils/material-ripple';

const FONTS = {
    bold: 'Rubik-Bold',
};

const lightRipple = getMaterialRipple({ color: 'rgba(17,43,102,0.10)', foreground: true });

type GlassHeaderProps = {
    title: string;
    onBackPress?: () => void;
    rightContent?: React.ReactNode;
};

const GlassHeader = ({ title, onBackPress, rightContent }: GlassHeaderProps) => {
    const insets = useSafeAreaInsets();
    const topInset = Math.max(insets.top, 0);

    return (
        <View style={[styles.glassHeader, { paddingTop: topInset, height: topInset + 48 }]}>
            {Platform.OS === 'ios' ? (
                <BlurView
                    style={StyleSheet.absoluteFill}
                    blurType="light"
                    blurAmount={24}
                    reducedTransparencyFallbackColor="rgba(242,242,247,0.88)"
                />
            ) : null}
            <View style={styles.glassHeaderBg} />
            <View style={styles.glassHeaderContent}>
                {onBackPress ? (
                    <Pressable style={styles.backButton} onPress={onBackPress} android_ripple={lightRipple}>
                        <Svg width={20} height={20} viewBox="0 0 24 24">
                            <Path fill="#111111" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
                        </Svg>
                    </Pressable>
                ) : null}
                <Text style={styles.navTitle}>{title}</Text>
                {rightContent ? (
                    <View style={styles.rightSlot}>{rightContent}</View>
                ) : null}
            </View>
            <View style={styles.glassHeaderBorder} />
        </View>
    );
};

const styles = StyleSheet.create({
    glassHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        overflow: 'hidden',
    },
    glassHeaderBg: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Platform.select({
            ios: 'rgba(242,242,247,0.72)',
            android: 'rgba(242,242,247,0.92)',
        }),
    },
    glassHeaderContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 10,
    },
    glassHeaderBorder: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0,0,0,0.08)',
    },
    navTitle: {
        fontSize: 17,
        fontFamily: FONTS.bold,
        color: '#111111',
    },
    backButton: {
        position: 'absolute',
        left: 8,
        bottom: 4,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    rightSlot: {
        position: 'absolute',
        right: 8,
        bottom: 4,
        height: 36,
        justifyContent: 'center',
    },
});

export default GlassHeader;
