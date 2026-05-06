import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Image,
  Vibration, NativeModules, Animated, useWindowDimensions, StyleSheet,
} from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const { IntentData, AlarmClock } = NativeModules;

// TODO: replace with your real Banner Ad Unit ID from the AdMob console
const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.BANNER : 'ca-app-pub-5233217461143034/6960004092';
const VIBRATION_PATTERN = [0, 500, 250];
const BAR_COUNT = 40;

type AudioMeta = { audioUrl: string; duration: number; waveform: number[]; audioId: string; listeningOrder: 'newest' | 'oldest'; title: string };

type Props = {
  visible: boolean;
  channelId: string;
  channelName: string;
  channelImageUrl?: string;
  onDismiss: () => void;
};

export default function AlarmRingingModal({ visible, channelId, channelName, channelImageUrl, onDismiss }: Props) {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const [usingFallback, setUsingFallback] = useState(false);
  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const startedRef = useRef(false);
  const dismissedRef = useRef(false);
  const userDismissedRef = useRef(false);
  const playedAudioRef = useRef<{ audioId: string; listeningOrder: 'newest' | 'oldest' } | null>(null);

  const playheadAnim = useRef(new Animated.Value(0)).current;
  const playheadLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible && !startedRef.current) {
      startedRef.current = true;
      dismissedRef.current = false;
      userDismissedRef.current = false;
      NavigationBar.setVisibilityAsync('hidden');
      launch();
    }
    if (!visible) {
      dismissedRef.current = true;
      stopAlarm();
      stopPlayhead();
      startedRef.current = false;
      setMeta(null);
    }
  }, [visible]);

  const launch = async () => {
    Vibration.vibrate(VIBRATION_PATTERN, true);
    console.log('[launch] channelId:', channelId, 'userId:', session?.user.id);
    try {
      const audioMeta = await fetchAudioMeta(channelId, session?.user.id);
      if (dismissedRef.current) {
        console.log('[launch] dismissed during fetch, aborting playback');
        return;
      }
      console.log('[launch] fetchAudioMeta ok, audioUrl:', audioMeta.audioUrl);
      setMeta(audioMeta);
      playedAudioRef.current = { audioId: audioMeta.audioId, listeningOrder: audioMeta.listeningOrder };
      const alreadyPlaying = await IntentData.isAlarmPlaying?.() ?? false;
      const startMs = alreadyPlaying ? (await IntentData.getAlarmPlaybackPosition?.() ?? 0) : 0;
      console.log('[launch] alreadyPlaying:', alreadyPlaying, 'startMs:', startMs);
      if (!alreadyPlaying) {
        IntentData.playAlarmUrl(audioMeta.audioUrl).catch((e: any) => console.error('[launch] playAlarmUrl error:', e));
      }
      startPlayhead(audioMeta.duration, startMs);
      setUsingFallback(false);
    } catch (e) {
      if (dismissedRef.current) return;
      console.error('[launch] fetchAudioMeta threw:', e);
      try { await IntentData?.playAlarmFallback?.(); } catch {}
      setUsingFallback(true);
    }
  };

  const startPlayhead = (durationSeconds: number, startMs: number = 0) => {
    const totalMs = durationSeconds * 1000;
    const clampedMs = Math.max(0, Math.min(startMs, totalMs));
    const startFraction = clampedMs / totalMs;
    const remainingMs = totalMs - clampedMs;

    playheadLoopRef.current?.stop();
    playheadAnim.setValue(startFraction);

    const startLoop = () => {
      const loop = Animated.loop(
        Animated.timing(playheadAnim, { toValue: 1, duration: totalMs, useNativeDriver: true })
      );
      playheadLoopRef.current = loop;
      loop.start();
    };

    if (clampedMs < 500) {
      startLoop();
    } else {
      // Animate from current position to end, then loop from beginning
      const firstPass = Animated.timing(playheadAnim, {
        toValue: 1,
        duration: remainingMs,
        useNativeDriver: true,
      });
      playheadLoopRef.current = firstPass as any;
      firstPass.start(({ finished }) => {
        if (!finished) return;
        playheadAnim.setValue(0);
        startLoop();
      });
    }
  };

  const stopPlayhead = () => {
    playheadLoopRef.current?.stop();
    playheadAnim.setValue(0);
  };

  const stopAlarm = () => {
    console.log('[stopAlarm] called from:', new Error().stack?.split('\n').slice(1, 4).join(' | '));
    Vibration.cancel();
    IntentData?.stopAlarmService?.();
  };

  const handleRestart = () => {
    if (!meta) return;
    stopPlayhead();
    IntentData?.playAlarmUrl?.(meta.audioUrl)?.catch(() => {});
    startPlayhead(meta.duration);
  };

  const handleSnooze = async () => {
    stopAlarm();
    stopPlayhead();
    if (AlarmClock) {
      try {
        await AlarmClock.scheduleAlarm(
          `snooze_${Date.now()}`,
          Date.now() + 5 * 60 * 1000,
          { channelId, channelName, channelImageUrl: channelImageUrl ?? '' }
        );
      } catch {}
    }
    onDismiss();
  };

  const markAsHeard = async (audioId: string) => {
    if (!session) { console.warn('[markAsHeard] no session'); return; }
    const userId = session.user.id;
    const { data, error: fetchErr } = await supabase.from('users').select('heard_audio').eq('user_id', userId).single();
    if (fetchErr) { console.error('[markAsHeard] fetch error:', fetchErr.message); return; }
    const current: string[] = (data?.heard_audio as string[]) ?? [];
    if (!current.includes(audioId)) {
      const { error: updateErr } = await supabase
        .from('users')
        .update({ heard_audio: [...current, audioId] } as any)
        .eq('user_id', userId);
      if (updateErr) console.error('[markAsHeard] update error:', updateErr.message);
      else console.log('[markAsHeard] marked heard:', audioId);
    }
  };

  const handleStop = () => {
    if (!userDismissedRef.current) {
      console.log('[handleStop] blocked phantom call from React internals');
      return;
    }
    userDismissedRef.current = false;
    stopAlarm();
    stopPlayhead();
    const played = playedAudioRef.current;
    if (played) {
      markAsHeard(played.audioId);
    }
    playedAudioRef.current = null;
    onDismiss();
  };

  const vizSize = width;
  const barAreaHeight = vizSize * 0.4;
  const barMaxHeight = barAreaHeight / 2;

  return (
    <Modal visible={visible} animationType="none" presentationStyle="fullScreen">
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }} edges={['top', 'left', 'right']}>

        {/* Square visualizer */}
        <View style={{ width: vizSize, height: vizSize, flexShrink: 1 }}>
          {channelImageUrl ? (
            <Image source={{ uri: channelImageUrl }} style={{ width: vizSize, height: vizSize }} resizeMode="cover" />
          ) : (
            <View style={{ width: vizSize, height: vizSize, backgroundColor: Colors.primary }} />
          )}

          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

          {/* Waveform bars — centered vertically in bottom 40% of visualizer */}
          <View style={{
            position: 'absolute',
            left: 12, right: 12,
            bottom: vizSize * 0.08,
            height: barAreaHeight,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
          }}>
            {(meta?.waveform ?? placeholderWaveform).map((amp, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: Math.max(3, amp * barMaxHeight * 2),
                  backgroundColor: Colors.primary,
                  borderRadius: 2,
                  opacity: 0.9,
                }}
              />
            ))}
          </View>

          {/* Playhead */}
          <Animated.View style={{
            position: 'absolute', top: 0, bottom: 0, width: 2,
            backgroundColor: 'rgba(255,255,255,0.85)',
            transform: [{
              translateX: playheadAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, vizSize - 2],
              }),
            }],
          }} />
        </View>

        {/* Channel info */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: '#888', fontSize: 11, letterSpacing: 2.5, marginBottom: 4 }}>
            {usingFallback ? 'ALARM' : 'NOW PLAYING'}
          </Text>
          <MarqueeText
            text={meta?.title ? `${channelName}, ${meta.title}` : channelName}
            style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}
          />
          {usingFallback && (
            <Text style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
              Playing offline — connect to Wi-Fi to hear your channel
            </Text>
          )}
        </View>

        {/* Buttons */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 12, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={handleRestart}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="refresh" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { userDismissedRef.current = true; handleSnooze(); }}
            style={{ flex: 1, height: 56, borderRadius: 28, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
          >
            <Ionicons name="moon" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Snooze 5 min</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { userDismissedRef.current = true; handleStop(); }}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="stop" size={22} color="#000" />
          </TouchableOpacity>
        </View>

        {/* AdMob banner — pinned to bottom */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }}>
          <BannerAd
            unitId={BANNER_AD_UNIT_ID}
            size={BannerAdSize.MEDIUM_RECTANGLE}
            requestOptions={{ requestNonPersonalizedAdsOnly: false }}
            onAdLoaded={() => console.log('[AdMob] banner loaded')}
            onAdFailedToLoad={(e) => console.log('[AdMob] banner failed:', e)}
          />
        </View>

      </SafeAreaView>
    </Modal>
  );
}

function MarqueeText({ text, style }: { text: string; style: object }) {
  const animX = useRef(new Animated.Value(0)).current;
  const containerW = useRef(0);
  const contentW = useRef(0);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const startScroll = () => {
    const overflow = contentW.current - containerW.current;
    if (overflow <= 4) return;
    loopRef.current?.stop();
    animX.setValue(0);
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(animX, { toValue: -overflow, duration: overflow * 28, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(animX, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    loopRef.current.start();
  };

  useEffect(() => () => { loopRef.current?.stop(); }, []);

  return (
    <View
      style={{ overflow: 'hidden', flexDirection: 'row' }}
      onLayout={e => { containerW.current = e.nativeEvent.layout.width; startScroll(); }}
    >
      <Animated.Text
        style={[style, { flexShrink: 0, transform: [{ translateX: animX }] }]}
        numberOfLines={1}
        onLayout={e => { contentW.current = e.nativeEvent.layout.width; startScroll(); }}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

// Shown before waveform data loads
const placeholderWaveform = Array.from({ length: BAR_COUNT }, (_, i) =>
  0.15 + 0.2 * Math.abs(Math.sin(i * 0.4))
);

async function fetchAudioMeta(channelId: string, userId?: string): Promise<AudioMeta> {
  const [channelResult, userResult] = await Promise.all([
    supabase.from('channels').select('listening_order').eq('channel_id', channelId).single(),
    userId
      ? supabase.from('users').select('channel_listening_overrides').eq('user_id', userId).single()
      : Promise.resolve({ data: null }),
  ]);

  const channelDefault: 'newest' | 'oldest' = (channelResult.data?.listening_order as any) ?? 'newest';
  const overrides = ((userResult.data as any)?.channel_listening_overrides as Record<string, 'newest' | 'oldest'>) ?? {};
  const listeningOrder = overrides[channelId] ?? channelDefault;
  console.log('[fetchAudioMeta] channelId:', channelId, 'listeningOrder:', listeningOrder, 'override:', overrides[channelId] ?? 'none');
  const now = new Date().toISOString();

  let audioId: string;
  let audioUrl: string;
  let duration: number;
  let title: string;

  if (listeningOrder === 'newest') {
    const { data, error } = await supabase
      .from('audio_files')
      .select('audio_id, audio_file, duration_seconds, title')
      .eq('channel_id', channelId)
      .or(`release_at.is.null,release_at.lte.${now}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data?.audio_file) throw new Error('no audio');
    audioId = data.audio_id as string;
    audioUrl = data.audio_file as string;
    duration = (data.duration_seconds as number) ?? 30;
    title = (data.title as string) ?? '';
  } else {
    let heardIds: string[] = [];
    if (userId) {
      const { data: userData } = await supabase
        .from('users')
        .select('heard_audio')
        .eq('user_id', userId)
        .single();
      heardIds = (userData?.heard_audio as string[]) ?? [];
    }

    const { data: allAudio, error } = await supabase
      .from('audio_files')
      .select('audio_id, audio_file, duration_seconds, title')
      .eq('channel_id', channelId)
      .or(`release_at.is.null,release_at.lte.${now}`)
      .order('created_at', { ascending: true });

    if (error || !allAudio?.length) throw new Error('no audio');

    const unheard = allAudio.filter((a: any) => !heardIds.includes(a.audio_id));
    const target = unheard.length > 0 ? unheard[0] : allAudio[allAudio.length - 1];

    audioId = target.audio_id as string;
    audioUrl = target.audio_file as string;
    duration = (target.duration_seconds as number) ?? 30;
    title = (target.title as string) ?? '';
  }

  const waveform = await computeWaveform(audioUrl);
  return { audioUrl, duration, waveform, audioId, listeningOrder, title };
}

async function computeWaveform(url: string): Promise<number[]> {
  try {
    // Fetch a slice of the audio (skip file header, grab up to 200KB of audio data)
    const response = await fetch(url, { headers: { Range: 'bytes=4096-204800' } });
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const step = Math.floor(bytes.length / BAR_COUNT);
    const raw = Array.from({ length: BAR_COUNT }, (_, i) => {
      const start = i * step;
      const end = Math.min(start + step, bytes.length);
      let sum = 0;
      for (let j = start; j < end; j++) sum += bytes[j];
      return sum / (end - start);
    });

    // Deviation from mean correlates with loudness in compressed audio
    const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
    const devs = raw.map(v => Math.abs(v - mean));

    // Smooth with a 3-sample moving average
    const smoothed = devs.map((v, i) => {
      const window = devs.slice(Math.max(0, i - 1), i + 2);
      return window.reduce((a, b) => a + b, 0) / window.length;
    });

    const max = Math.max(...smoothed, 1);
    return smoothed.map(v => 0.08 + 0.92 * (v / max));
  } catch {
    return seededWaveform(url);
  }
}

// Deterministic fallback if fetch fails
function seededWaveform(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const x = Math.sin(hash + i * 127.1) * 43758.5453;
    return 0.1 + 0.9 * (x - Math.floor(x));
  });
}
