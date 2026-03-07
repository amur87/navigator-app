import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faFaceSmile, faLocationArrow, faMicrophone, faPaperclip, faPaperPlane, faPhotoFilm, faPhone, faStar, faStop } from '@fortawesome/free-solid-svg-icons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useHeaderHeight } from '@react-navigation/elements';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import { CHAT_STICKERS, QUICK_EMOJIS } from '../constants/chat';
import { useLocation } from '../contexts/LocationContext';
import { getMaterialRipple } from '../utils/material-ripple';
import { formatAudioDuration, startVoiceRecording, stopVoiceRecording } from '../services/chat-audio';

const ChatKeyboard = ({
    channel,
    capabilities,
    onSend,
    onSendPhoto,
    onSendFile,
    onSendVoice,
    onSendLocation,
    onSendSticker,
    onStartCall,
    disabled = false,
    disabledReason = '',
}) => {
    const headerHeight = useHeaderHeight();
    const { location, trackLocation } = useLocation();
    const [message, setMessage] = useState('');
    const [showEmojiRow, setShowEmojiRow] = useState(false);
    const [showStickerRow, setShowStickerRow] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDurationMs, setRecordingDurationMs] = useState(0);
    const [voiceBusy, setVoiceBusy] = useState(false);

    const canSend = useMemo(() => message.trim().length > 0, [message]);

    useEffect(() => {
        return () => {
            if (isRecording) {
                stopVoiceRecording().catch(() => undefined);
            }
        };
    }, [isRecording]);

    const handleSend = async () => {
        if (disabled) {
            Alert.alert('Чат', disabledReason || 'Отправка сейчас недоступна.');
            return;
        }

        const normalized = message.trim();
        if (!normalized) {
            return;
        }

        await onSend(normalized);
        setMessage('');
        setShowEmojiRow(false);
        setShowStickerRow(false);
    };

    const handlePickPhoto = async () => {
        if (disabled) {
            Alert.alert('Чат', disabledReason || 'Отправка сейчас недоступна.');
            return;
        }

        const response = await launchImageLibrary({
            mediaType: 'photo',
            selectionLimit: 1,
            quality: 'high',
        });

        const asset = response.assets?.[0];
        if (!asset?.uri) {
            return;
        }

        await onSendPhoto(asset);
    };

    const handleSendLocation = async () => {
        if (disabled) {
            Alert.alert('Чат', disabledReason || 'Отправка сейчас недоступна.');
            return;
        }

        const resolvedLocation = location?.coords ? location : await trackLocation();
        if (!resolvedLocation?.coords) {
            Alert.alert('Геопозиция', 'Не удалось определить текущее местоположение.');
            return;
        }

        await onSendLocation({
            latitude: resolvedLocation.coords.latitude,
            longitude: resolvedLocation.coords.longitude,
        });
    };

    const handlePickFile = async () => {
        if (disabled) {
            Alert.alert('Чат', disabledReason || 'Отправка сейчас недоступна.');
            return;
        }

        if (!capabilities?.files) {
            handleUnsupported('Файлы');
            return;
        }

        try {
            const document = await DocumentPicker.pickSingle({
                type: [DocumentPicker.types.pdf, DocumentPicker.types.plainText, DocumentPicker.types.doc, DocumentPicker.types.docx, DocumentPicker.types.allFiles],
                copyTo: 'cachesDirectory',
            });

            await onSendFile(document);
        } catch (error) {
            if (!DocumentPicker.isCancel(error)) {
                Alert.alert('Файлы', 'Не удалось выбрать файл.');
            }
        }
    };

    const ensureMicrophonePermission = async () => {
        if (Platform.OS !== 'android') {
            return true;
        }

        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    };

    const handleVoiceToggle = async () => {
        if (disabled) {
            Alert.alert('Чат', disabledReason || 'Отправка сейчас недоступна.');
            return;
        }

        if (!capabilities?.voice) {
            handleUnsupported('Голосовые сообщения');
            return;
        }

        if (voiceBusy) {
            return;
        }

        if (!isRecording) {
            const hasPermission = await ensureMicrophonePermission();
            if (!hasPermission) {
                Alert.alert('Микрофон', 'Разрешение на запись звука не выдано.');
                return;
            }

            try {
                setVoiceBusy(true);
                setRecordingDurationMs(0);
                const filePath = `${RNFS.CachesDirectoryPath}/voice-${Date.now()}.m4a`;
                await startVoiceRecording(filePath, setRecordingDurationMs);
                setIsRecording(true);
            } catch (error) {
                Alert.alert('Голосовое сообщение', 'Не удалось начать запись.');
            } finally {
                setVoiceBusy(false);
            }

            return;
        }

        try {
            setVoiceBusy(true);
            const recordedPath = await stopVoiceRecording();
            const normalizedPath = recordedPath?.startsWith('file://') ? recordedPath.replace('file://', '') : recordedPath;
            const stat = normalizedPath ? await RNFS.stat(normalizedPath) : null;
            setIsRecording(false);
            await onSendVoice({
                uri: normalizedPath ? `file://${normalizedPath}` : recordedPath,
                fileName: `voice-${Date.now()}.m4a`,
                type: 'audio/mp4',
                size: stat?.size ? Number(stat.size) : undefined,
                durationSeconds: recordingDurationMs > 0 ? recordingDurationMs / 1000 : undefined,
            });
            setRecordingDurationMs(0);
        } catch (error) {
            setIsRecording(false);
            Alert.alert('Голосовое сообщение', 'Не удалось отправить запись.');
        } finally {
            setVoiceBusy(false);
        }
    };

    const handleUnsupported = (feature) => {
        Alert.alert(feature, 'Эта функция уже заведена в архитектуру Matrix, но для полной работы нужен server-side media policy и ключи доступа.');
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
            {showEmojiRow ? (
                <View style={styles.panel}>
                    {QUICK_EMOJIS.map((emoji) => (
                        <Pressable
                            key={emoji}
                            onPress={() => setMessage((prev) => `${prev}${emoji}`)}
                            android_ripple={getMaterialRipple({ color: 'rgba(153,26,78,0.10)' })}
                            style={styles.panelButton}
                        >
                            <Text style={styles.panelEmoji}>{emoji}</Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}

            {showStickerRow ? (
                <View style={styles.panel}>
                    {CHAT_STICKERS.map((sticker) => (
                        <Pressable
                            key={sticker.id}
                            onPress={() => onSendSticker(sticker)}
                            android_ripple={getMaterialRipple({ color: 'rgba(153,26,78,0.12)' })}
                            style={styles.stickerButton}
                        >
                            <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
                            <Text style={styles.stickerLabel}>{sticker.label}</Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}

            {isRecording ? (
                <View style={styles.recordingBanner}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Идет запись: {formatAudioDuration(recordingDurationMs / 1000)}</Text>
                </View>
            ) : null}

            <View style={styles.wrap}>
                <Pressable onPress={handlePickPhoto} style={styles.actionButton} android_ripple={getMaterialRipple({ color: 'rgba(153,26,78,0.12)' })}>
                    <FontAwesomeIcon icon={faPhotoFilm} size={16} color='#991A4E' />
                </Pressable>
                <Pressable onPress={handlePickFile} style={styles.actionButton} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.10)' })}>
                    <FontAwesomeIcon icon={faPaperclip} size={15} color='#112b66' />
                </Pressable>
                <View style={styles.inputWrap}>
                    <Pressable onPress={() => { setShowEmojiRow((prev) => !prev); setShowStickerRow(false); }} style={styles.inlineAction}>
                        <FontAwesomeIcon icon={faFaceSmile} size={16} color='#8e8e93' />
                    </Pressable>
                    <TextInput
                        value={message}
                        onChangeText={setMessage}
                        onChange={(event) => {
                            const nextValue = event.nativeEvent.text ?? '';
                            if (nextValue !== message) {
                                setMessage(nextValue);
                            }
                        }}
                        placeholder='Сообщение'
                        placeholderTextColor='#8e8e93'
                        multiline
                        style={styles.input}
                    />
                    <Pressable onPress={() => { setShowStickerRow((prev) => !prev); setShowEmojiRow(false); }} style={styles.inlineAction}>
                        <FontAwesomeIcon icon={faStar} size={16} color='#8e8e93' />
                    </Pressable>
                </View>
                {canSend ? (
                    <Pressable onPress={handleSend} style={styles.sendButton} android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.16)' })}>
                        <FontAwesomeIcon icon={faPaperPlane} size={14} color='#FFFFFF' />
                    </Pressable>
                ) : (
                    <>
                        <Pressable onPress={handleSendLocation} style={styles.sideButton} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.10)' })}>
                            <FontAwesomeIcon icon={faLocationArrow} size={15} color='#112b66' />
                        </Pressable>
                        <Pressable onPress={handleVoiceToggle} style={isRecording ? styles.sendButtonRecording : styles.sendButtonMuted} android_ripple={getMaterialRipple({ color: 'rgba(153,26,78,0.10)' })}>
                            <FontAwesomeIcon icon={isRecording ? faStop : faMicrophone} size={14} color='#991A4E' />
                        </Pressable>
                    </>
                )}
                <Pressable onPress={onStartCall} style={styles.sideButton} android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.10)' })}>
                    <FontAwesomeIcon icon={faPhone} size={14} color='#112b66' />
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    panel: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: 4,
        backgroundColor: 'rgba(248,248,250,0.96)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.08)',
    },
    panelButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    panelEmoji: {
        fontSize: 22,
    },
    stickerButton: {
        width: 68,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        overflow: 'hidden',
    },
    stickerEmoji: {
        fontSize: 28,
        marginBottom: 3,
    },
    stickerLabel: {
        fontSize: 11,
        color: '#6e6e73',
        fontFamily: 'Rubik-Regular',
    },
    recordingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 2,
        backgroundColor: 'rgba(248,248,250,0.96)',
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
    },
    recordingText: {
        color: '#991A4E',
        fontSize: 12,
        fontFamily: 'Rubik-Medium',
    },
    wrap: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 24 : 96,
        backgroundColor: 'rgba(248,248,250,0.96)',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.08)',
    },
    actionButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(153,26,78,0.10)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    sideButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    inputWrap: {
        flex: 1,
        minHeight: 42,
        maxHeight: 120,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.10)',
        paddingLeft: 10,
        paddingRight: 8,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
    },
    inlineAction: {
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    input: {
        flex: 1,
        fontSize: 15,
        lineHeight: 20,
        color: '#111111',
        fontFamily: 'Rubik-Regular',
        maxHeight: 96,
        paddingTop: 2,
        paddingBottom: 2,
    },
    sendButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#991A4E',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    sendButtonMuted: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(153,26,78,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    sendButtonRecording: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,59,48,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});

export default ChatKeyboard;
