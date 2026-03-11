import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { format, isToday, isYesterday } from 'date-fns';
import ChatMessage from './ChatMessage';

const getDateLabel = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    if (isToday(date)) {
        return 'СЕГОДНЯ';
    }
    if (isYesterday(date)) {
        return 'ВЧЕРА';
    }
    return format(date, 'd MMMM').toUpperCase();
};

const flattenFeed = (feed = []) => {
    const result = [];
    let currentDateLabel = null;

    feed.forEach((message) => {
        const label = getDateLabel(message.createdAt);
        if (label && label !== currentDateLabel) {
            currentDateLabel = label;
            result.push({ id: `date-${label}-${message.id}`, type: 'date', label });
        }
        result.push({ id: message.id, type: 'message', message });
    });

    return result;
};

const ChatFeed = forwardRef(({ channel, currentUserId }, ref) => {
    const listRef = useRef(null);
    const data = useMemo(() => flattenFeed(channel?.feed ?? []), [channel?.feed]);

    useImperativeHandle(ref, () => ({
        scrollToEnd: () => listRef.current?.scrollToEnd({ animated: true }),
    }));

    return (
        <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
                if (item.type === 'date') {
                    return (
                        <View style={styles.dateWrap}>
                            <View style={styles.datePill}>
                                <Text style={styles.dateText}>{item.label}</Text>
                            </View>
                        </View>
                    );
                }

                return <ChatMessage record={item.message} currentUserId={currentUserId} />;
            }}
            contentContainerStyle={styles.content}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
        />
    );
});

const styles = StyleSheet.create({
    content: {
        paddingTop: 6,
        paddingBottom: 8,
    },
    dateWrap: {
        alignItems: 'center',
        marginVertical: 10,
    },
    datePill: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: 'rgba(225,218,208,0.88)',
    },
    dateText: {
        fontSize: 11,
        letterSpacing: 0.3,
        color: '#54504a',
        fontFamily: 'Rubik-Medium',
    },
});

export default ChatFeed;
