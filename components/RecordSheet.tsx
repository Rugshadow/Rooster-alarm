import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, Pressable, PanResponder } from 'react-native';
import AppAlert from './AppAlert';
import { useAppAlert } from '../hooks/useAppAlert';
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
import { useTheme } from '../hooks/useTheme';
import FinalizeAudioSheet from './FinalizeAudioSheet';
import { useTranslation } from 'react-i18next';

type RecordState = 'idle' | 'recording' | 'stopped' | 'playing';

type EditAudio = {
  url: string;
  duration: number;
  title: string;
  thumbnailUri?: string;
  releaseDate?: Date;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  scheduledDates?: { date: Date; title: string }[];
  editAudio?: EditAudio;
  onSave: (data: { uri: string; title: string; thumbnailUri?: string; thumbnailBase64?: string; releaseDate?: Date; durationSeconds: number }) => void;
};

const MAX_SECONDS = 300;
const NUM_BARS = 60; // one bar per 2 seconds over 2 minutes

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

const BAR_COUNT_WAVEFORM = 40;

async function fetchWaveformSamples(url: string): Promise<number[]> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=4096-204800' } });
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const step = Math.floor(bytes.length / NUM_BARS);
    const raw = Array.from({ length: NUM_BARS }, (_, i) => {
      const start = i * step;
      const end = Math.min(start + step, bytes.length);
      let sum = 0;
      for (let j = start; j < end; j++) sum += bytes[j];
      return sum / (end - start);
    });
    const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
    const devs = raw.map(v => Math.abs(v - mean));
    const smoothed = devs.map((v, i) => {
      const w = devs.slice(Math.max(0, i - 1), i + 2);
      return w.reduce((a, b) => a + b, 0) / w.length;
    });
    const max = Math.max(...smoothed, 1);
    return smoothed.map(v => Math.max(0.04, Math.min(1, 0.08 + 0.92 * (v / max))));
  } catch {
    return Array.from({ length: NUM_BARS }, (_, i) => 0.15 + 0.2 * Math.abs(Math.sin(i * 0.4)));
  }
}

export default function RecordSheet({ visible, onClose, onSave, scheduledDates, editAudio }: Props) {
  const { bg, surface, text, textSecondary } = useTheme();
  const { showAlert, alertProps } = useAppAlert();
  const { t } = useTranslation();
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
  const hasNewRecordingRef = useRef(false);
  const [hasNewRecording, setHasNewRecording] = useState(false);

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 100);
  const player = useAudioPlayer(recordingUri ? { uri: recordingUri } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (visible && editAudio) {
      hasNewRecordingRef.current = false;
      setHasNewRecording(false);
      setRecordingUri(editAudio.url);
      setElapsed(editAudio.duration);
      setState('stopped');
      setPlayheadRatio(0);
      fetchWaveformSamples(editAudio.url).then(setSamples);
    }
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

  const effectiveDuration = (state === 'recording' || hasNewRecording)
    ? (elapsed > 0 ? elapsed : MAX_SECONDS)
    : ((playerStatus as any).duration > 0 ? (playerStatus as any).duration : MAX_SECONDS);

  useEffect(() => {
    if (!isDraggingRef.current && state === 'playing') {
      const dur = hasNewRecording
        ? (elapsed > 0 ? elapsed : MAX_SECONDS)
        : ((playerStatus as any).duration > 0 ? (playerStatus as any).duration : MAX_SECONDS);
      const ratio = Math.min(1, playerStatus.currentTime / dur);
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
      showAlert(t('record.permission_required'), t('record.microphone_needed'));
      return;
    }
    hasNewRecordingRef.current = true;
    setHasNewRecording(true);
    setSamples([]);
    lastSampleTimeRef.current = 0;
    try { await recorder.stop(); } catch {}
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
    setSamples(prev => {
      if (prev.length === 0) return prev;
      if (prev.length >= NUM_BARS) return prev.slice(0, NUM_BARS);
      return Array.from({ length: NUM_BARS }, (_, i) => {
        const srcIdx = (i / (NUM_BARS - 1)) * (prev.length - 1);
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, prev.length - 1);
        const t = srcIdx - lo;
        return prev[lo] * (1 - t) + prev[hi] * t;
      });
    });
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
    hasNewRecordingRef.current = false;
    setHasNewRecording(false);
    lastSampleTimeRef.current = 0;
    onClose();
  };

  const handleClose = () => {
    if (hasNewRecordingRef.current) {
      const isEdit = !!editAudio;
      showAlert(
        isEdit ? t('record.cancel_editing_title') : t('record.delete_recording_title'),
        isEdit ? t('record.cancel_editing_msg') : t('record.delete_recording_msg'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: doClose },
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
      player.seekTo(ratio * effectiveDuration);
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
          backgroundColor: isRecorded ? Colors.primary : surface,
          borderRadius: 2,
          marginHorizontal: 1,
          alignSelf: 'center',
        }}
      />
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <AppAlert {...alertProps} />
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">{t('record.title')}</Text>
          </View>
        </SafeAreaView>

        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ fontSize: 13, color: textSecondary, textAlign: 'center', marginBottom: 24 }}>
            {t('record.length_hint')}
          </Text>
          <View className="flex-row items-end mb-8 gap-1">
            <Text style={{ fontSize: 40, fontWeight: 'bold', color: text }}>
              {formatTime(state === 'recording' ? elapsed : Math.round(playheadRatio * effectiveDuration))}
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '600', color: textSecondary, marginBottom: 4 }}> / </Text>
            <Text style={{ fontSize: 40, fontWeight: 'bold', color: textSecondary }}>
              {formatTime(state === 'recording' ? elapsed : Math.round(effectiveDuration))}
            </Text>
            <Text style={{ fontSize: 24, fontWeight: '600', color: textSecondary, marginBottom: 4 }}> / </Text>
            <Text style={{ fontSize: 40, fontWeight: 'bold', color: textSecondary }}>
              {formatTime(MAX_SECONDS)}
            </Text>
          </View>

          <View
            style={{ height: 120, position: 'relative', width: '100%', backgroundColor: surface, flexDirection: 'row', alignItems: 'center' }}
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
                  backgroundColor: text,
                }}
              />
            )}
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: boxWidth * (60 / (state === 'recording' ? MAX_SECONDS : effectiveDuration)), top: '50%', transform: [{ translateX: -6 }, { translateY: -6 }] }}
            >
              <Text style={{ fontSize: 12, color: textSecondary, fontWeight: 'bold', lineHeight: 12 }}>✕</Text>
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
                style={{ aspectRatio: 1, opacity: state === 'stopped' || state === 'playing' ? 1 : 0.3, backgroundColor: surface, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}
            >
              <Ionicons name={state === 'playing' ? 'pause' : 'play'} size={32} color={text} />
            </TouchableOpacity>

            {/* Return to start */}
            <TouchableOpacity
              onPress={state === 'stopped' || state === 'playing' ? () => { player.seekTo(0); setPlayheadRatio(0); if (state === 'playing') { player.pause(); setState('stopped'); } } : undefined}
              style={{ aspectRatio: 1, opacity: state === 'stopped' || state === 'playing' ? 1 : 0.3, backgroundColor: surface, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}
            >
              <Ionicons name="play-skip-back" size={32} color={text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ backgroundColor: Colors.primary, flexDirection: 'row', height: 56 }}>
          <TouchableOpacity
            onPress={handleClose}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
          </TouchableOpacity>
          <View style={{ width: 1, backgroundColor: Colors.primaryDark, marginVertical: 8 }} />
          <TouchableOpacity
            onPress={recordingUri && (editAudio && !hasNewRecording || elapsed >= 60) ? () => { if (state === 'playing') { player.pause(); setState('stopped'); } setFinalizeVisible(true); } : undefined}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: recordingUri && (editAudio && !hasNewRecording || elapsed >= 60) ? 1 : 0.4 }}
          >
            <Text className="font-medium text-[15px] text-text-primary">{t('record.next')}</Text>
            <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FinalizeAudioSheet
        visible={finalizeVisible}
        onBack={() => setFinalizeVisible(false)}
        scheduledDates={scheduledDates}
        initialTitle={editAudio?.title}
        initialThumbnailUri={editAudio?.thumbnailUri}
        initialReleaseDate={editAudio?.releaseDate}
        releaseDateLocked={editAudio ? (!!editAudio.releaseDate && editAudio.releaseDate <= new Date()) : false}
        onComplete={(data) => {
          onSave({ uri: recordingUri!, durationSeconds: elapsed, ...data });
          doClose();
        }}
      />
    </Modal>
  );
}
