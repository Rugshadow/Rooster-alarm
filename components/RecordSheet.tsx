import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

type RecordState = 'idle' | 'recording' | 'stopped';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (uri: string) => void;
};

export default function RecordSheet({ visible, onClose, onSave }: Props) {
  const [state, setState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_SECONDS = 120;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const startRecording = () => {
    setState('recording');
    setElapsed(0);
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= MAX_SECONDS) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState('stopped');
  };

  const handleClose = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState('idle');
    setElapsed(0);
    onClose();
  };

  const WaveformBar = ({ index }: { index: number }) => {
    const heights = [20, 35, 50, 40, 55, 30, 45, 60, 35, 25, 50, 40, 30, 55, 45];
    const h = heights[index % heights.length];
    return (
      <View
        style={{
          width: 4,
          height: state === 'recording' ? h : 12,
          backgroundColor: state === 'recording' ? Colors.primary : Colors.surface,
          borderRadius: 2,
          marginHorizontal: 2,
        }}
      />
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <View className="w-8" />
          <Text className="text-[17px] font-semibold text-text-primary">Record Alarm</Text>
          <TouchableOpacity onPress={handleClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[40px] font-bold text-text-primary mb-8">
            {formatTime(elapsed)} / 2:00
          </Text>

          <View
            className="w-full rounded-2xl bg-surface items-center justify-center flex-row"
            style={{ height: 120 }}
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <WaveformBar key={i} index={i} />
            ))}
          </View>

          <View className="flex-row items-center gap-6 mt-10">
            {state === 'stopped' && (
              <TouchableOpacity
                onPress={() => setState('idle')}
                className="w-14 h-14 rounded-full bg-surface items-center justify-center"
              >
                <Ionicons name="play" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={state === 'recording' ? stopRecording : startRecording}
              className="w-20 h-20 rounded-full items-center justify-center"
              style={{ backgroundColor: Colors.destructive }}
            >
              {state === 'recording' ? (
                <View className="w-10 h-10 rounded-lg bg-white" />
              ) : (
                <View className="w-10 h-10 rounded-full bg-white" />
              )}
            </TouchableOpacity>

            {state === 'stopped' && (
              <TouchableOpacity
                onPress={startRecording}
                className="w-14 h-14 rounded-full bg-surface items-center justify-center"
              >
                <Ionicons name="mic" size={28} color={Colors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View className="flex-row gap-3 px-6 py-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={handleClose}
            className="flex-1 rounded-full py-3 items-center bg-surface"
          >
            <Text className="font-semibold text-[15px] text-text-primary">Cancel</Text>
          </TouchableOpacity>
          {state === 'stopped' && (
            <TouchableOpacity
              onPress={() => { onSave('recorded-uri'); handleClose(); }}
              className="flex-1 rounded-full py-3 items-center"
              style={{ backgroundColor: Colors.primaryDark }}
            >
              <Text className="font-bold text-[15px] text-text-primary">Save</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
