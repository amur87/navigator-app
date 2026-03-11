import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faFileLines, faLocationDot, faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
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
        return (
            <View style={styles.imageWrap}>
                <Image source={{ uri: record.url }} style={styles.image} resizeMode='cover' />
            </View>
        );
    }

    if (record.type === 'audio') {
        return (
            <Pressable onPress={handleAudioPress} style={styles.audioCard}>
                <View style={[styles.playBtn, isOutgoing ? styles.playBtnOut : styles.playBtnIn]}>
                    <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} size={14} color={isOutgoing ? '#6b1434' : '#6b1434'} />
                </View>
                <View style={styles.audioBody}>
                    <View style={styles.waveform}>
                        {[0.3, 0.6, 1, 0.4, 0.8, 0.5, 0.9, 0.3, 0.7, 1, 0.5, 0.8, 0.4, 0.6, 0.9, 0.3].map((h, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.waveLine,
                                    { height: 18 * h },
                                    isOutgoing ? styles.waveLineOut : styles.waveLineIn,
                                ]}
                            />
                        ))}
                    </View>
                    <Text style={[styles.audioDuration, isOutgoing ? styles.metaOut : styles.metaIn]}>
                        {formatAudioDuration(record.durationSeconds)}
                    </Text>
                </View>
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
                style={[styles.locCard, isOutgoing ? styles.locCardOut : styles.locCardIn]}
            >
                <View style={[styles.locIcon, isOutgoing ? styles.locIconOut : styles.locIconIn]}>
                    <FontAwesomeIcon icon={faLocationDot} size={18} color={isOutgoing ? '#2d8a4e' : '#2d8a4e'} />
                </View>
                <View style={styles.locBody}>
                    <Text style={styles.locTitle}>Геопозиция</Text>
                    <Text style={[styles.locMeta, isOutgoing ? styles.metaOut : styles.metaIn]} numberOfLines={1}>{record.content}</Text>
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
                style={[styles.fileCard, isOutgoing ? styles.fileCardOut : styles.fileCardIn]}
            >
                <View style={[styles.fileIcon, isOutgoing ? styles.fileIconOut : styles.fileIconIn]}>
                    <FontAwesomeIcon icon={faFileLines} size={18} color={isOutgoing ? '#112b66' : '#112b66'} />
                </View>
                <View style={styles.fileBody}>
                    <Text style={styles.fileName} numberOfLines={1}>{record.fileName || 'Файл'}</Text>
                    <Text style={[styles.fileMeta, isOutgoing ? styles.metaOut : styles.metaIn]} numberOfLines={1}>
                        {record.mimeType || 'Документ'}
                    </Text>
                </View>
            </Pressable>
        );
    }

    return null;
};

const styles = StyleSheet.create({
    imageWrap: {
        borderRadius: 10,
        overflow: 'hidden',
        marginTop: 4,
        marginBottom: 2,
    },
    image: {
        width: 220,
        height: 165,
        borderRadius: 10,
    },
    audioCard: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        minWidth: 200,
    },
    playBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playBtnOut: {
        backgroundColor: 'rgba(107,20,52,0.14)',
    },
    playBtnIn: {
        backgroundColor: 'rgba(107,20,52,0.10)',
    },
    audioBody: {
        flex: 1,
    },
    waveform: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        marginBottom: 3,
    },
    waveLine: {
        width: 3,
        borderRadius: 1.5,
    },
    waveLineOut: {
        backgroundColor: 'rgba(107,20,52,0.4)',
    },
    waveLineIn: {
        backgroundColor: 'rgba(107,20,52,0.3)',
    },
    audioDuration: {
        fontSize: 11,
        fontFamily: 'Rubik-Regular',
    },
    locCard: {
        marginTop: 4,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        maxWidth: 240,
    },
    locCardOut: {
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
    locCardIn: {
        backgroundColor: 'rgba(52,199,89,0.08)',
    },
    locIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    locIconOut: {
        backgroundColor: 'rgba(52,199,89,0.14)',
    },
    locIconIn: {
        backgroundColor: 'rgba(52,199,89,0.12)',
    },
    locBody: {
        flex: 1,
    },
    locTitle: {
        color: '#111111',
        fontSize: 13,
        fontFamily: 'Rubik-SemiBold',
        marginBottom: 2,
    },
    locMeta: {
        fontSize: 11,
        fontFamily: 'Rubik-Regular',
    },
    fileCard: {
        marginTop: 4,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        maxWidth: 240,
    },
    fileCardOut: {
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
    fileCardIn: {
        backgroundColor: 'rgba(17,43,102,0.06)',
    },
    fileIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fileIconOut: {
        backgroundColor: 'rgba(17,43,102,0.10)',
    },
    fileIconIn: {
        backgroundColor: 'rgba(17,43,102,0.08)',
    },
    fileBody: {
        flex: 1,
    },
    fileName: {
        color: '#111111',
        fontSize: 13,
        fontFamily: 'Rubik-SemiBold',
        marginBottom: 2,
    },
    fileMeta: {
        fontSize: 11,
        fontFamily: 'Rubik-Regular',
    },
    metaOut: {
        color: 'rgba(0,0,0,0.42)',
    },
    metaIn: {
        color: '#8e8e93',
    },
});

export default ChatAttachment;
