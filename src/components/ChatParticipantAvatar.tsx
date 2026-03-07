import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Avatar } from 'tamagui';

const ChatParticipantAvatar = ({ participant, size = 44 }) => {
    const fallback = `${participant?.avatarFallback ?? participant?.name ?? participant?.username ?? 'U'}`.slice(0, 1).toUpperCase();

    return (
        <View style={styles.wrap}>
            <Avatar circular size={size}>
                {participant?.avatarUrl ? <Avatar.Image accessibilityLabel={participant?.name ?? 'Chat avatar'} src={participant.avatarUrl} /> : null}
                <Avatar.Fallback delayMs={0} backgroundColor='#d9e3ff' justifyContent='center' alignItems='center'>
                    <Text style={[styles.fallbackText, { fontSize: Math.max(14, Math.round(size / 2.4)) }]}>{fallback}</Text>
                </Avatar.Fallback>
            </Avatar>
            {participant?.isOnline ? <View style={styles.onlineDot} /> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        position: 'relative',
    },
    fallbackText: {
        color: '#112b66',
        fontFamily: 'Rubik-Bold',
    },
    onlineDot: {
        position: 'absolute',
        right: 1,
        bottom: 1,
        width: 11,
        height: 11,
        borderRadius: 6,
        backgroundColor: '#34C759',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
});

export default ChatParticipantAvatar;

