import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, Vibration, NativeModules } from 'react-native';

const { IntentData } = NativeModules;
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';

const VIBRATION_PATTERN = [0, 500, 250];

type Props = {
  visible: boolean;
  channelId: string;
  channelName: string;
  channelImageUrl?: string;
  onDismiss: () => void;
};

export default function AlarmRingingModal({ visible, channelId, channelName, channelImageUrl, onDismiss }: Props) {
  const [usingFallback, setUsingFallback] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (visible && !startedRef.current) {
      startedRef.current = true;
      startAlarm();
    }
    if (!visible) {
      stopAlarm();
      startedRef.current = false;
    }
  }, [visible]);

  const startAlarm = async () => {
    console.log('[AlarmModal] startAlarm called, channelId:', channelId);
    console.log('[AlarmModal] IntentData available:', !!IntentData);
    console.log('[AlarmModal] playAlarmUrl available:', !!IntentData?.playAlarmUrl);
    Vibration.vibrate(VIBRATION_PATTERN, true);
    console.log('[AlarmModal] vibration started');
    try {
      console.log('[AlarmModal] fetching audio URL...');
      const audioUrl = await fetchLatestAudioUrl(channelId);
      console.log('[AlarmModal] fetched audio URL:', audioUrl);
      console.log('[AlarmModal] calling IntentData.playAlarmUrl...');
      await IntentData.playAlarmUrl(audioUrl);
      console.log('[AlarmModal] playAlarmUrl resolved');
      setUsingFallback(false);
    } catch (e) {
      console.warn('[AlarmModal] error in startAlarm:', String(e));
      try {
        console.log('[AlarmModal] trying fallback...');
        await IntentData?.playAlarmFallback?.();
        console.log('[AlarmModal] fallback resolved');
      } catch (e2) {
        console.error('[AlarmModal] fallback also failed:', String(e2));
      }
      setUsingFallback(true);
    }
  };

  const stopAlarm = () => {
    Vibration.cancel();
    IntentData?.stopAlarmService?.();
  };

  const handleDismiss = () => {
    stopAlarm();
    onDismiss();
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <SafeAreaView className="flex-1 items-center justify-between pb-16 pt-20 px-8" style={{ backgroundColor: '#0a0a0a' }}>
        <View className="items-center flex-1 justify-center w-full">
          {channelImageUrl ? (
            <Image
              source={{ uri: channelImageUrl }}
              style={{ width: 200, height: 200, borderRadius: 16, marginBottom: 32 }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ width: 200, height: 200, borderRadius: 16, backgroundColor: Colors.primary, marginBottom: 32, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="musical-notes" size={64} color="#000" />
            </View>
          )}

          <Text style={{ color: '#fff', fontSize: 14, letterSpacing: 3, marginBottom: 8 }}>
            {usingFallback ? 'ALARM' : 'NOW PLAYING'}
          </Text>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
            {channelName}
          </Text>
          {usingFallback && (
            <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
              Playing offline alarm — connect to Wi-Fi to hear your channel
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleDismiss}
          style={{
            backgroundColor: Colors.primary,
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="stop" size={36} color="#000" />
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

async function fetchLatestAudioUrl(channelId: string): Promise<string> {
  const { data, error } = await supabase
    .from('audio_files')
    .select('audio_file')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data?.audio_file) throw new Error('no audio');
  return data.audio_file as string;
}
