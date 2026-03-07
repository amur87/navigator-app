import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faFileLines, faLocationDot, faPause, faPlay, faWaveSquare } from '@fortawesome/free-solid-svg-icons';
import { formatAudioDuration, startVoicePlayback, stopVoicePlayback } from '../services/chat-audio';

const ChatAttachment = ({ record, isOutgoing }) => {
    const [isPlaying, setIsPlaying] = useState(false);

    const playableAudioUri = useMemo(() => record?.localPath || record?.url || null, [record?.localPath, record?.url]);
    const fileOpenUri = useMemo(() => record?.localPath || record?.url || null, [record?.localPath, record?.url]);

    useEffect(() => {
        return () => {
            stopVoicePlayback().catch(() => undefined);
        };
    }, []);

    if (!record) {
        return null;
    }

    const handleAudioPress = async () => {
        if (!playableAudioUri) {
            Alert.alert('Голосовое сообщение', 'Источник аудио недоступен для воспроизведения.');
            return;
        }

        if (isPlaying) {
            await stopVoicePlayback();
            setIsPlaying(false);
            return;
        }

        try {
            setIsPlaying(true);
            await startVoicePlayback(playableAudioUri, undefined, () => setIsPlaying(false), record.durationSeconds);
        } catch (error) {
            setIsPlaying(false);
            Alert.alert('Голосовое сообщение', 'Не удалось воспроизвести аудио.');
        }
    };

    if (record.type === 'image' && record.url) {
        return <Image source={{ uri: record.url }} style={styles.image} resizeMode='cover' />;
    }

    if (record.type === 'audio') {
        return (
            <Pressable onPress={handleAudioPress} style={[styles.fileCard, isOutgoing ? styles.fileCardOutgoing : styles.fileCardIncoming]}>
                <View style={styles.audioIcon}>
                    <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} size={12} color={isOutgoing ? '#991A4E' : '#2F2F33'} />
                </View>
                <View style={styles.fileTextWrap}>
                    <Text style={styles.fileTitle}>Голосовое сообщение</Text>
                    <Text style={styles.fileMeta}>{formatAudioDuration(record.durationSeconds)}</Text>
                </View>
                <FontAwesomeIcon icon={faWaveSquare} size={16} color={isOutgoing ? '#991A4E' : '#6e6e73'} />
            </Pressable>
        );
    }

    if (record.type === 'location') {
        return (
            <Pressable
                onPress={() => {
                    if (record.geoUri) {
                        Linking.openURL(record.geoUri).catch(() => undefined);
                    }
                }}
                style={[styles.fileCard, isOutgoing ? styles.fileCardOutgoing : styles.fileCardIncoming]}
            >
                <View style={styles.audioIcon}>
                    <FontAwesomeIcon icon={faLocationDot} size={14} color={isOutgoing ? '#991A4E' : '#2F2F33'} />
                </View>
                <View style={styles.fileTextWrap}>
                    <Text style={styles.fileTitle}>Геопозиция</Text>
                    <Text style={styles.fileMeta} numberOfLines={1}>{record.content}</Text>
                </View>
            </Pressable>
        );
    }

    if (record.type === 'file') {
        return (
            <Pressable
                onPress={() => {
                    if (fileOpenUri) {
                        Linking.openURL(fileOpenUri).catch(() => undefined);
                    }
                }}
                style={[styles.fileCard, isOutgoing ? styles.fileCardOutgoing : styles.fileCardIncoming]}
            >
                <View style={styles.audioIcon}>
                    <FontAwesomeIcon icon={faFileLines} size={14} color={isOutgoing ? '#991A4E' : '#2F2F33'} />
                </View>
                <View style={styles.fileTextWrap}>
                    <Text style={styles.fileTitle} numberOfLines={1}>{record.fileName || 'Файл'}</Text>
                    <Text style={styles.fileMeta} numberOfLines={1}>{record.mimeType || 'Документ'}</Text>
                </View>
            </Pressable>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    image: {
        width: 212,
        height: 156,
        borderRadius: 14,
        marginTop: 4,
    },
    fileCard: {
        marginTop: 4,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        maxWidth: 238,
    },
    fileCardOutgoing: {
        backgroundColor: 'rgba(255,255,255,0.74)',
    },
    fileCardIncoming: {
        backgroundColor: 'rgba(17,43,102,0.06)',
    },
    audioIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    fileTextWrap: {
        flex: 1,
    },
    fileTitle: {
        color: '#111111',
        fontSize: 13,
        fontFamily: 'Rubik-Medium',
        marginBottom: 2,
    },
    fileMeta: {
        color: '#6e6e73',
        fontSize: 11,
        fontFamily: 'Rubik-Regular',
    },
});

export default ChatAttachment;
