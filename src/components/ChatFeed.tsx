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
        return 'Сегодня';
    }
    if (isYesterday(date)) {
        return 'Вчера';
    }
    return format(date, 'd MMMM');
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
                            <Text style={styles.dateText}>{item.label}</Text>
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
        paddingTop: 8,
        paddingBottom: 12,
    },
    dateWrap: {
        alignItems: 'center',
        marginVertical: 8,
    },
    dateText: {
        fontSize: 11,
        color: '#8e8e93',
        fontFamily: 'Rubik-Regular',
        backgroundColor: 'rgba(255,255,255,0.78)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },
});

export default ChatFeed;

