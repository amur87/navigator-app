import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import ChatAttachment from './ChatAttachment';
import ChatParticipantAvatar from './ChatParticipantAvatar';

const formatTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return format(date, 'HH:mm');
};

const ChatMessage = ({ record, currentUserId }) => {
    const isOutgoing = record?.isOutgoing ?? record?.sender?.userId === currentUserId;
    const isSystem = record?.type === 'system';
    const isSticker = record?.type === 'sticker';
    const hasAttachment = ['image', 'audio', 'file', 'location'].includes(record?.type);

    if (isSystem) {
        return (
            <View style={styles.systemWrap}>
                <Text style={styles.systemText}>{record.content}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.row, isOutgoing ? styles.rowOutgoing : styles.rowIncoming]}>
            {!isOutgoing ? <ChatParticipantAvatar participant={record.sender} size={26} /> : null}
            <View style={[styles.bubble, isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
                {!isOutgoing ? <Text style={styles.sender}>{record.sender?.name}</Text> : null}
                {isSticker ? <Text style={styles.stickerText}>{record.content}</Text> : null}
                {!isSticker && record.content ? <Text style={[styles.messageText, isOutgoing ? styles.messageTextOutgoing : styles.messageTextIncoming]}>{record.content}</Text> : null}
                {hasAttachment ? <ChatAttachment record={record} isOutgoing={isOutgoing} /> : null}
                <Text style={[styles.time, isOutgoing ? styles.timeOutgoing : styles.timeIncoming]}>
                    {record.status === 'sending' ? 'Отправка...' : formatTime(record.createdAt)}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginBottom: 4,
        alignItems: 'flex-end',
    },
    rowOutgoing: {
        justifyContent: 'flex-end',
    },
    rowIncoming: {
        justifyContent: 'flex-start',
        gap: 6,
    },
    bubble: {
        maxWidth: '76%',
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 6,
    },
    bubbleOutgoing: {
        backgroundColor: '#d98aac',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 4,
    },
    bubbleIncoming: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 18,
    },
    sender: {
        color: '#112b66',
        fontSize: 11,
        marginBottom: 4,
        fontFamily: 'Rubik-Medium',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 21,
        fontFamily: 'Rubik-Regular',
    },
    messageTextOutgoing: {
        color: '#ffffff',
    },
    messageTextIncoming: {
        color: '#111111',
    },
    stickerText: {
        fontSize: 44,
        lineHeight: 52,
    },
    time: {
        marginTop: 4,
        fontSize: 10,
        fontFamily: 'Rubik-Regular',
        textAlign: 'right',
    },
    timeOutgoing: {
        color: 'rgba(255,255,255,0.72)',
    },
    timeIncoming: {
        color: '#8e8e93',
    },
    systemWrap: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 6,
    },
    systemText: {
        fontSize: 12,
        color: '#8e8e93',
        fontFamily: 'Rubik-Regular',
        backgroundColor: 'rgba(255,255,255,0.85)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
});

export default ChatMessage;

