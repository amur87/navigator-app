import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Animated, Keyboard, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
    faCamera,
    faFaceSmile,
    faFile,
    faLocationDot,
    faMicrophone,
    faPaperPlane,
    faPaperclip,
    faStop,
    faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    const insets = useSafeAreaInsets();
    const { location, trackLocation } = useLocation();
    const [message, setMessage] = useState('');
    const [showAttachMenu, setShowAttachMenu] = useState(false);
    const [showEmojiRow, setShowEmojiRow] = useState(false);
    const [showStickerRow, setShowStickerRow] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDurationMs, setRecordingDurationMs] = useState(0);
    const [voiceBusy, setVoiceBusy] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const canSend = useMemo(() => message.trim().length > 0, [message]);

    useEffect(() => {
        return () => {
            if (isRecording) {
                stopVoiceRecording().catch(() => undefined);
            }
        };
    }, [isRecording]);

    const closePanels = () => {
        setShowAttachMenu(false);
        setShowEmojiRow(false);
        setShowStickerRow(false);
    };

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
        closePanels();
    };

    const handlePickPhoto = async () => {
        closePanels();
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
        closePanels();
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
        closePanels();
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
                Alert.alert('Файлы', 'Не удалось открыть файл.');
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
                Alert.alert('Микрофон', 'Необходимо дать доступ на запись.');
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
        Alert.alert(feature, 'Эта функция зависит от конфигурации Matrix, но сейчас может быть недоступна.');
    };

    const bottomPadding = keyboardVisible ? 4 : Math.max(insets.bottom, Platform.OS === 'android' ? 6 : 16);

    return (
        <View>
            {/* Attachment Menu (slide-up panel) */}
            {showAttachMenu ? (
                <View style={styles.attachPanel}>
                    <View style={styles.attachGrid}>
                        <Pressable
                            onPress={handlePickPhoto}
                            style={[styles.attachItem, { backgroundColor: 'rgba(107,20,52,0.10)' }]}
                            android_ripple={getMaterialRipple({ color: 'rgba(107,20,52,0.10)' })}
                        >
                            <FontAwesomeIcon icon={faCamera} size={22} color='#6b1434' />
                            <Text style={styles.attachLabel}>Фото</Text>
                        </Pressable>
                        <Pressable
                            onPress={handlePickFile}
                            style={[styles.attachItem, { backgroundColor: 'rgba(17,43,102,0.08)' }]}
                            android_ripple={getMaterialRipple({ color: 'rgba(17,43,102,0.10)' })}
                        >
                            <FontAwesomeIcon icon={faFile} size={22} color='#112b66' />
                            <Text style={styles.attachLabel}>Файл</Text>
                        </Pressable>
                        <Pressable
                            onPress={handleSendLocation}
                            style={[styles.attachItem, { backgroundColor: 'rgba(52,199,89,0.10)' }]}
                            android_ripple={getMaterialRipple({ color: 'rgba(52,199,89,0.10)' })}
                        >
                            <FontAwesomeIcon icon={faLocationDot} size={22} color='#2d8a4e' />
                            <Text style={styles.attachLabel}>Локация</Text>
                        </Pressable>
                    </View>
                </View>
            ) : null}

            {/* Emoji Row */}
            {showEmojiRow ? (
                <View style={styles.emojiPanel}>
                    <View style={styles.emojiRow}>
                        {QUICK_EMOJIS.map((emoji) => (
                            <Pressable
                                key={emoji}
                                onPress={() => setMessage((prev) => `${prev}${emoji}`)}
                                style={styles.emojiBtn}
                            >
                                <Text style={styles.emojiText}>{emoji}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <View style={styles.stickerRow}>
                        {CHAT_STICKERS.map((sticker) => (
                            <Pressable
                                key={sticker.id}
                                onPress={() => { onSendSticker(sticker); closePanels(); }}
                                style={styles.stickerBtn}
                                android_ripple={getMaterialRipple({ color: 'rgba(107,20,52,0.08)' })}
                            >
                                <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
                                <Text style={styles.stickerLabel}>{sticker.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            ) : null}

            {/* Recording Banner */}
            {isRecording ? (
                <View style={styles.recordingBanner}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingTime}>{formatAudioDuration(recordingDurationMs / 1000)}</Text>
                    <View style={styles.recordingWave}>
                        {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.3, 0.7, 1, 0.5, 0.8].map((h, i) => (
                            <View key={i} style={[styles.waveBar, { height: 16 * h }]} />
                        ))}
                    </View>
                </View>
            ) : null}

            {/* Main Input Bar */}
            <View style={[styles.inputBar, { paddingBottom: bottomPadding }]}>
                {/* Attachment button - left of input (WhatsApp-style) */}
                <Pressable
                    onPress={() => { setShowAttachMenu((p) => !p); setShowEmojiRow(false); }}
                    style={styles.attachBtn}
                    android_ripple={getMaterialRipple({ color: 'rgba(0,0,0,0.08)' })}
                >
                    <FontAwesomeIcon
                        icon={showAttachMenu ? faXmark : faPaperclip}
                        size={20}
                        color='#6e6e73'
                        style={showAttachMenu ? undefined : { transform: [{ rotate: '45deg' }] }}
                    />
                </Pressable>

                {/* Input field */}
                <View style={styles.inputWrap}>
                    <Pressable
                        onPress={() => { setShowEmojiRow((p) => !p); setShowAttachMenu(false); }}
                        style={styles.inlineBtn}
                    >
                        <FontAwesomeIcon icon={faFaceSmile} size={22} color='#6e6e73' />
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
                        placeholderTextColor='#999999'
                        multiline
                        style={styles.input}
                        onFocus={closePanels}
                    />
                    <Pressable
                        onPress={handlePickPhoto}
                        style={styles.inlineBtn}
                    >
                        <FontAwesomeIcon icon={faCamera} size={19} color='#6e6e73' />
                    </Pressable>
                </View>

                {/* Send or Voice button - right side */}
                {canSend ? (
                    <Pressable
                        onPress={handleSend}
                        style={styles.sendBtn}
                        android_ripple={getMaterialRipple({ color: 'rgba(255,255,255,0.2)' })}
                    >
                        <FontAwesomeIcon icon={faPaperPlane} size={18} color='#FFFFFF' />
                    </Pressable>
                ) : (
                    <Pressable
                        onPress={handleVoiceToggle}
                        style={isRecording ? styles.sendBtnRecording : styles.voiceBtn}
                        android_ripple={getMaterialRipple({ color: isRecording ? 'rgba(255,59,48,0.15)' : 'rgba(107,20,52,0.15)' })}
                    >
                        <FontAwesomeIcon
                            icon={isRecording ? faStop : faMicrophone}
                            size={isRecording ? 18 : 20}
                            color={isRecording ? '#FF3B30' : '#FFFFFF'}
                        />
                    </Pressable>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    attachPanel: {
        backgroundColor: '#f7f7f7',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.08)',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    attachGrid: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    attachItem: {
        width: 80,
        height: 80,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        overflow: 'hidden',
    },
    attachLabel: {
        fontSize: 11,
        color: '#333',
        fontFamily: 'Rubik-Medium',
    },
    emojiPanel: {
        backgroundColor: '#f7f7f7',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.08)',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    emojiRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 10,
    },
    emojiBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    emojiText: {
        fontSize: 22,
    },
    stickerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    stickerBtn: {
        width: 64,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        overflow: 'hidden',
    },
    stickerEmoji: {
        fontSize: 26,
        marginBottom: 2,
    },
    stickerLabel: {
        fontSize: 10,
        color: '#6e6e73',
        fontFamily: 'Rubik-Regular',
    },
    recordingBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#f7f7f7',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(0,0,0,0.08)',
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF3B30',
    },
    recordingTime: {
        color: '#333',
        fontSize: 15,
        fontFamily: 'Rubik-Medium',
        minWidth: 50,
    },
    recordingWave: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    waveBar: {
        width: 3,
        borderRadius: 1.5,
        backgroundColor: '#6b1434',
        opacity: 0.5,
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        paddingHorizontal: 6,
        paddingTop: 6,
        backgroundColor: '#f0ebe4',
    },
    attachBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    inputWrap: {
        flex: 1,
        minHeight: 42,
        maxHeight: 120,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        paddingLeft: 6,
        paddingRight: 6,
        paddingVertical: 2,
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    inlineBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        fontSize: 16,
        lineHeight: 21,
        color: '#111111',
        fontFamily: 'Rubik-Regular',
        maxHeight: 100,
        paddingTop: Platform.OS === 'ios' ? 10 : 8,
        paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#6b1434',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    voiceBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#6b1434',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    sendBtnRecording: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,59,48,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
});

export default ChatKeyboard;
