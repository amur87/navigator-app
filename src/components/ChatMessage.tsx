import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCheck, faCheckDouble } from '@fortawesome/free-solid-svg-icons';
import ChatAttachment from './ChatAttachment';
import ChatParticipantAvatar from './ChatParticipantAvatar';

const formatTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return format(date, 'HH:mm');
};

const ReadReceipt = ({ status, isOutgoing }) => {
    if (!isOutgoing) {
        return null;
    }

    if (status === 'sending') {
        return <FontAwesomeIcon icon={faCheck} size={11} color='rgba(255,255,255,0.5)' />;
    }

    if (status === 'read') {
        return <FontAwesomeIcon icon={faCheckDouble} size={11} color='#53bdeb' />;
    }

    return <FontAwesomeIcon icon={faCheckDouble} size={11} color='rgba(255,255,255,0.6)' />;
};

const ChatMessage = ({ record, currentUserId }) => {
    const isOutgoing = record?.isOutgoing ?? record?.sender?.userId === currentUserId;
    const isSystem = record?.type === 'system';
    const isSticker = record?.type === 'sticker';
    const hasAttachment = ['image', 'audio', 'file', 'location'].includes(record?.type);

    if (isSystem) {
        return (
            <View style={styles.systemWrap}>
                <View style={styles.systemBubble}>
                    <Text style={styles.systemText}>{record.content}</Text>
                </View>
            </View>
        );
    }

    if (isSticker) {
        return (
            <View style={[styles.row, isOutgoing ? styles.rowOutgoing : styles.rowIncoming]}>
                <View style={styles.stickerWrap}>
                    <Text style={styles.stickerText}>{record.content}</Text>
                    <Text style={[styles.stickerTime, isOutgoing ? styles.stickerTimeOut : styles.stickerTimeIn]}>
                        {formatTime(record.createdAt)}
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.row, isOutgoing ? styles.rowOutgoing : styles.rowIncoming]}>
            {!isOutgoing ? (
                <View style={styles.avatarWrap}>
                    <ChatParticipantAvatar participant={record.sender} size={28} />
                </View>
            ) : null}
            <View style={[styles.bubble, isOutgoing ? styles.bubbleOutgoing : styles.bubbleIncoming]}>
                {/* Bubble tail */}
                <View style={[styles.tail, isOutgoing ? styles.tailOutgoing : styles.tailIncoming]} />

                {!isOutgoing && record.sender?.name ? (
                    <Text style={styles.senderName}>{record.sender.name}</Text>
                ) : null}

                {hasAttachment ? <ChatAttachment record={record} isOutgoing={isOutgoing} /> : null}

                {record.content && !isSticker ? (
                    <Text style={[styles.messageText, isOutgoing ? styles.textOutgoing : styles.textIncoming]}>
                        {record.content}
                    </Text>
                ) : null}

                <View style={styles.metaRow}>
                    <Text style={[styles.time, isOutgoing ? styles.timeOutgoing : styles.timeIncoming]}>
                        {record.status === 'sending' ? 'Отправка...' : formatTime(record.createdAt)}
                    </Text>
                    <ReadReceipt status={record.status} isOutgoing={isOutgoing} />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        marginBottom: 3,
        alignItems: 'flex-end',
    },
    rowOutgoing: {
        justifyContent: 'flex-end',
        paddingLeft: 52,
    },
    rowIncoming: {
        justifyContent: 'flex-start',
        paddingRight: 52,
    },
    avatarWrap: {
        marginRight: 4,
        marginBottom: 2,
    },
    bubble: {
        maxWidth: '100%',
        paddingHorizontal: 10,
        paddingTop: 6,
        paddingBottom: 5,
        position: 'relative',
    },
    bubbleOutgoing: {
        backgroundColor: '#dcf8c6',
        borderRadius: 10,
        borderTopRightRadius: 3,
    },
    bubbleIncoming: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderTopLeftRadius: 3,
    },
    tail: {
        position: 'absolute',
        top: 0,
        width: 0,
        height: 0,
        borderStyle: 'solid',
    },
    tailOutgoing: {
        right: -6,
        borderLeftWidth: 8,
        borderLeftColor: '#dcf8c6',
        borderTopWidth: 8,
        borderTopColor: '#dcf8c6',
        borderRightWidth: 8,
        borderRightColor: 'transparent',
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
    },
    tailIncoming: {
        left: -6,
        borderRightWidth: 8,
        borderRightColor: '#FFFFFF',
        borderTopWidth: 8,
        borderTopColor: '#FFFFFF',
        borderLeftWidth: 8,
        borderLeftColor: 'transparent',
        borderBottomWidth: 0,
        borderBottomColor: 'transparent',
    },
    senderName: {
        color: '#6b1434',
        fontSize: 12,
        fontFamily: 'Rubik-SemiBold',
        marginBottom: 2,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 21,
        fontFamily: 'Rubik-Regular',
    },
    textOutgoing: {
        color: '#1a1a1a',
    },
    textIncoming: {
        color: '#111111',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 3,
        marginTop: 2,
    },
    time: {
        fontSize: 11,
        fontFamily: 'Rubik-Regular',
    },
    timeOutgoing: {
        color: 'rgba(0,0,0,0.42)',
    },
    timeIncoming: {
        color: '#8e8e93',
    },
    stickerWrap: {
        alignItems: 'center',
    },
    stickerText: {
        fontSize: 56,
        lineHeight: 66,
    },
    stickerTime: {
        fontSize: 11,
        fontFamily: 'Rubik-Regular',
        marginTop: 2,
    },
    stickerTimeOut: {
        color: 'rgba(0,0,0,0.42)',
    },
    stickerTimeIn: {
        color: '#8e8e93',
    },
    systemWrap: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 6,
    },
    systemBubble: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: 'rgba(225,218,208,0.85)',
    },
    systemText: {
        fontSize: 12,
        color: '#54504a',
        fontFamily: 'Rubik-Regular',
        textAlign: 'center',
    },
});

export default ChatMessage;
