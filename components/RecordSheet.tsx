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
  onSave: (data: { uri: string; title: string; thumbnailUri?: string; thumbnailBase64?: string; releaseDate?: Date }) => void;
};

const MAX_SECONDS = 120;
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
  const [playheadRatio, setPlayheadRatio] = useState(0);
  const isDraggingRef = useRef(false);
  const [finalizeVisible, setFinalizeVisible] = useState(false);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const player = useAudioPlayer(recordingUri ? { uri: recordingUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!visible) handleClose();
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
      player.seekTo(0);
      player.play();
      setState('playing');
    }
  };

  const handleClose = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (state === 'recording') await recorder.stop();
    if (state === 'playing') player.pause();
    setState('idle');
    setElapsed(0);
    setRecordingUri(null);
    onClose();
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
          <Text className="text-[40px] font-bold text-text-primary mb-8">
            {formatTime(elapsed)} / 2:00
          </Text>

          <View
            className="w-full rounded-2xl bg-surface flex-row items-center"
            style={{ height: 120, position: 'relative' }}
            onLayout={(e) => { boxWidthRef.current = e.nativeEvent.layout.width; }}
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
                  left: playheadRatio * boxWidthRef.current - 1,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  backgroundColor: Colors.textPrimary,
                  borderRadius: 1,
                }}
              />
            )}
          </View>

          <View className="flex-row w-full mt-10 gap-2">
            <TouchableOpacity
              onPress={state !== 'recording' && state !== 'playing' ? startRecording : undefined}
              className="flex-1 items-center justify-center rounded-2xl"
              style={{ aspectRatio: 1, backgroundColor: Colors.destructive, opacity: state === 'recording' || state === 'playing' ? 0.3 : 1 }}
            >
              <Ionicons name="mic" size={32} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={state === 'stopped' || state === 'playing' ? togglePlayback : undefined}
              className="flex-1 items-center justify-center rounded-2xl bg-surface"
              style={{ aspectRatio: 1, opacity: state === 'stopped' || state === 'playing' ? 1 : 0.3 }}
            >
              <Ionicons name={state === 'playing' ? 'pause' : 'play'} size={32} color={Colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={state === 'recording' ? stopRecording : undefined}
              className="flex-1 items-center justify-center rounded-2xl bg-surface"
              style={{ aspectRatio: 1, opacity: state === 'recording' ? 1 : 0.3 }}
            >
              <Ionicons name="stop" size={32} color={Colors.destructive} />
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
            onPress={recordingUri ? () => setFinalizeVisible(true) : undefined}
            className="flex-1 flex-row items-center justify-center gap-1 py-4"
            style={{ opacity: recordingUri ? 1 : 0.4 }}
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
          setFinalizeVisible(false);
          onSave({ uri: recordingUri!, ...data });
          handleClose();
        }}
      />
    </Modal>
  );
}
