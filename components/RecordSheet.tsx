import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert, Pressable, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  requestRecordingPermissionsAsync,
  RecordingPresets,
} from 'expo-audio';
import { Colors } from '../constants/colors';
import FinalizeAudioSheet from './FinalizeAudioSheet';

type RecordState = 'idle' | 'recording' | 'stopped' | 'playing';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { uri: string; title: string; thumbnailUri?: string; thumbnailBase64?: string; releaseDate?: Date; durationSeconds: number }) => void;
};

const MAX_SECONDS = 180;
const NUM_BARS = 60; // one bar per 2 seconds over 2 minutes

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

export default function RecordSheet({ visible, onClose, onSave }: Props) {
  const [state, setState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [samples, setSamples] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSampleTimeRef = useRef(0);
  const boxWidthRef = useRef(1);
  const [boxWidth, setBoxWidth] = useState(1);
  const [playheadRatio, setPlayheadRatio] = useState(0);
  const isDraggingRef = useRef(false);
  const [finalizeVisible, setFinalizeVisible] = useState(false);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const player = useAudioPlayer(recordingUri ? { uri: recordingUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!visible) doClose();
  }, [visible]);

  useEffect(() => {
    if (state !== 'recording') return;
    const ms = recorderState.durationMillis;
    if (ms - lastSampleTimeRef.current >= (MAX_SECONDS * 1000) / NUM_BARS) {
      lastSampleTimeRef.current = ms;
      const db = recorderState.metering ?? -60;
      const normalized = Math.max(0.04, Math.min(1, (db + 60) / 60));
      setSamples((prev) => [...prev, normalized]);
    }
  }, [recorderState.durationMillis]);

  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status: any) => {
      if (status.didJustFinish) { setState('stopped'); setPlayheadRatio(0); }
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (!isDraggingRef.current && state === 'playing') {
      const ratio = Math.min(1, playerStatus.currentTime / MAX_SECONDS);
      setPlayheadRatio(ratio);
    }
  }, [playerStatus.currentTime]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed to record.');
      return;
    }
    setSamples([]);
    lastSampleTimeRef.current = 0;
    await recorder.prepareToRecordAsync();
    recorder.record();
    setState('recording');
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= MAX_SECONDS) { stopRecording(); return prev; }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    await recorder.stop();
    const uri = recorder.uri;
    setRecordingUri(uri ?? null);
    setState('stopped');
  };

  const togglePlayback = () => {
    if (state === 'playing') {
      player.pause();
      setState('stopped');
    } else {
      player.play();
      setState('playing');
    }
  };

  const doClose = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (state === 'recording') await recorder.stop();
    if (state === 'playing') player.pause();
    setState('idle');
    setElapsed(0);
    setRecordingUri(null);
    setSamples([]);
    setPlayheadRatio(0);
    setFinalizeVisible(false);
    lastSampleTimeRef.current = 0;
    onClose();
  };

  const handleClose = () => {
    if (elapsed > 0) {
      Alert.alert(
        'Delete Recording',
        'Are you sure you want to delete this recording?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doClose },
        ]
      );
    } else {
      doClose();
    }
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => state === 'stopped' || state === 'playing',
    onMoveShouldSetPanResponder: () => state === 'stopped' || state === 'playing',
    onPanResponderGrant: (e) => {
      isDraggingRef.current = true;
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / boxWidthRef.current));
      setPlayheadRatio(ratio);
    },
    onPanResponderMove: (e) => {
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / boxWidthRef.current));
      setPlayheadRatio(ratio);
    },
    onPanResponderRelease: (e) => {
      const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / boxWidthRef.current));
      setPlayheadRatio(ratio);
      player.seekTo(ratio * MAX_SECONDS);
      isDraggingRef.current = false;
    },
  });

  const WaveformBar = ({ index }: { index: number }) => {
    const sample = samples[index];
    const isRecorded = sample !== undefined;
    const height = isRecorded ? Math.max(4, sample * 80) : 4;
    return (
      <View
        style={{
          flex: 1,
          height,
          backgroundColor: isRecorded ? Colors.primary : '#E5E7EB',
          borderRadius: 2,
          marginHorizontal: 1,
          alignSelf: 'center',
        }}
      />
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">Record Alarm</Text>
          </View>
        </SafeAreaView>

        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[13px] text-text-secondary text-center mb-6">
            Alarms must be between 1 and 3 minutes in length.
          </Text>
          <View className="flex-row items-end mb-8 gap-1">
            <Text className="text-[40px] font-bold text-text-primary">
              {formatTime(state === 'recording' ? elapsed : Math.round(playheadRatio * MAX_SECONDS))}
            </Text>
            <Text className="text-[24px] font-semibold text-text-secondary mb-1"> / </Text>
            <Text className="text-[40px] font-bold text-text-secondary">
              {formatTime(elapsed)}
            </Text>
            <Text className="text-[24px] font-semibold text-text-secondary mb-1"> / </Text>
            <Text className="text-[40px] font-bold text-text-secondary">
              {formatTime(MAX_SECONDS)}
            </Text>
          </View>

          <View
            className="w-full bg-surface flex-row items-center"
            style={{ height: 120, position: 'relative' }}
            onLayout={(e) => { boxWidthRef.current = e.nativeEvent.layout.width; setBoxWidth(e.nativeEvent.layout.width); }}
            {...panResponder.panHandlers}
          >
            {Array.from({ length: NUM_BARS }).map((_, i) => (
              <WaveformBar key={i} index={i} />
            ))}
            {(state === 'stopped' || state === 'playing') && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: playheadRatio * boxWidthRef.current - 0.5,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: Colors.textPrimary,
                }}
              />
            )}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: boxWidth / 3, top: '50%', transform: [{ translateX: -6 }, { translateY: -6 }] }}
            >
              <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: 'bold', lineHeight: 12 }}>✕</Text>
            </View>
          </View>

          <View className="flex-row w-full mt-10 gap-2">
            {/* Record / Stop */}
            <TouchableOpacity
              onPress={state === 'recording' ? stopRecording : state === 'playing' ? undefined : startRecording}
              className="flex-1 items-center justify-center rounded-2xl"
              style={{ aspectRatio: 1, backgroundColor: Colors.destructive, opacity: state === 'playing' ? 0.3 : 1 }}
            >
              <Ionicons name={state === 'recording' ? 'stop' : 'mic'} size={32} color="white" />
            </TouchableOpacity>

            {/* Play / Pause */}
            <TouchableOpacity
              onPress={state === 'stopped' || state === 'playing' ? togglePlayback : undefined}
              className="flex-1 items-center justify-center rounded-2xl bg-surface"
              style={{ aspectRatio: 1, opacity: state === 'stopped' || state === 'playing' ? 1 : 0.3 }}
            >
              <Ionicons name={state === 'playing' ? 'pause' : 'play'} size={32} color={Colors.textPrimary} />
            </TouchableOpacity>

            {/* Return to start */}
            <TouchableOpacity
              onPress={state === 'stopped' || state === 'playing' ? () => { player.seekTo(0); setPlayheadRatio(0); if (state === 'playing') { player.pause(); setState('stopped'); } } : undefined}
              className="flex-1 items-center justify-center rounded-2xl bg-surface"
              style={{ aspectRatio: 1, opacity: state === 'stopped' || state === 'playing' ? 1 : 0.3 }}
            >
              <Ionicons name="play-skip-back" size={32} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ backgroundColor: Colors.primary, paddingBottom: 24 }} className="flex-row">
          <TouchableOpacity
            onPress={handleClose}
            className="flex-1 flex-row items-center justify-center gap-1 py-4"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">Back</Text>
          </TouchableOpacity>
          <View style={{ width: 1, backgroundColor: Colors.primaryDark, marginVertical: 8 }} />
          <TouchableOpacity
            onPress={recordingUri && elapsed >= 60 ? () => setFinalizeVisible(true) : undefined}
            className="flex-1 flex-row items-center justify-center gap-1 py-4"
            style={{ opacity: recordingUri && elapsed >= 60 ? 1 : 0.4 }}
          >
            <Text className="font-medium text-[15px] text-text-primary">Next</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FinalizeAudioSheet
        visible={finalizeVisible}
        onBack={() => setFinalizeVisible(false)}
        onComplete={(data) => {
          onSave({ uri: recordingUri!, durationSeconds: elapsed, ...data });
          doClose();
        }}
      />
    </Modal>
  );
}
