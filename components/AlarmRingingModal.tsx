import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Image, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { registerAudioStop } from '../lib/audioRegistry';

const FALLBACK_SOUND = require('../assets/alarm.wav');
// Vibration pattern: buzz 500ms, pause 250ms, repeat
const VIBRATION_PATTERN = [0, 500, 250];

type Props = {
  visible: boolean;
  channelId: string;
  channelName: string;
  channelImageUrl?: string;
  onDismiss: () => void;
};

export default function AlarmRingingModal({ visible, channelId, channelName, channelImageUrl, onDismiss }: Props) {
  const player = useAudioPlayer(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    return registerAudioStop(() => {
      Vibration.cancel();
      player.pause();
    });
  }, [player]);

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
    Vibration.vibrate(VIBRATION_PATTERN, true);
    try {
      const audioUrl = await fetchLatestAudioUrl(channelId);
      player.replace({ uri: audioUrl });
      player.loop = true;
      player.play();
      setUsingFallback(false);
    } catch {
      playFallback();
    }
  };

  const playFallback = () => {
    setUsingFallback(true);
    player.replace(FALLBACK_SOUND);
    player.loop = true;
    player.play();
  };

  const stopAlarm = () => {
    Vibration.cancel();
    player.pause();
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const { data, error } = await supabase
      .from('audio_files')
      .select('audio_file')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    clearTimeout(timeout);
    if (error || !data?.audio_file) throw new Error('no audio');
    return data.audio_file as string;
  } catch {
    clearTimeout(timeout);
    throw new Error('fetch failed');
  }
}
