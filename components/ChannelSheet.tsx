import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Text } from './Text';
import AlarmRingingModal from './AlarmRingingModal';
import AppAlert from './AppAlert';
import { useAppAlert } from '../hooks/useAppAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset } from '../hooks/useTopInset';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import AudioListRow from './AudioListRow';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { saveFavoriteChannel, removeFavoriteChannel } from '../lib/cachedFavorites';
import { isOfflineEnabled, enableOffline, disableOffline, addLocalHeardAudio, removeLocalHeardAudio, setLocalHeardAudio } from '../lib/offlineAudio';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_ORDER_KEY = 'channel_order_overrides';

export type Channel = {
  id: string;
  name: string;
  genre: string;
  listeners: number;
  bio: string;
  uploads: AudioClip[];
  imageUrl?: string;
  listeningOrder?: 'newest' | 'oldest' | 'shuffle';
};

export type AudioClip = {
  id: string;
  title: string;
  date: string;
  duration: number;
  audioUrl: string;
  imageUrl?: string;
};

type Props = {
  channel: Channel | null;
  visible: boolean;
  onClose: () => void;
  onSetAlarm: (channel: Channel) => void;
};

export default function ChannelSheet({ channel, visible, onClose, onSetAlarm }: Props) {
  const { session, isLoggedIn } = useAuth();
  const { bg, text, textSecondary, surface } = useTheme();
  const { showAlert, alertProps } = useAppAlert();
  const { t } = useTranslation();
  const topPad = useTopInset();
  const { playingId, play, stop } = useAudioPlayer();
  const [previewClip, setPreviewClip] = useState<{ audioUrl: string; duration: number; title: string; audioId: string } | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteClips, setFavoriteClips] = useState<string[]>([]);
  const [heardClips, setHeardClips] = useState<string[]>([]);
  const [userOrder, setUserOrder] = useState<'newest' | 'oldest' | 'shuffle'>('newest');
  const [reportStep, setReportStep] = useState<0 | 1 | 2 | 3>(0);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [channelOptionsVisible, setChannelOptionsVisible] = useState(false);
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const { height: screenHeight } = useWindowDimensions();

  const isClosingRef = useRef(false);

  const openChannelOptions = useCallback(() => {
    isClosingRef.current = false;
    sheetAnim.setValue(0);
    if (channel) isOfflineEnabled(channel.id).then(setOfflineEnabled);
    setTimeout(() => {
      setChannelOptionsVisible(true);
      Animated.timing(sheetAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }, 50);
  }, [channel]);

  const closeChannelOptions = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(sheetAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(({ finished }) => {
      if (finished) { setChannelOptionsVisible(false); isClosingRef.current = false; }
    });
  }, []);
  const [ownerUsername, setOwnerUsername] = useState<string | null>(null);

  useEffect(() => {
    if (visible && channel) {
      supabase.from('channels').select('owner_id').eq('channel_id', channel.id).single()
        .then(async ({ data }) => {
          if (data?.owner_id) {
            const { data: u } = await supabase.from('users').select('username').eq('user_id', data.owner_id).single();
            setOwnerUsername(u?.username ?? null);
          }
        });
      if (isLoggedIn && session) {
        checkFavoriteStatus();
      } else {
        setUserOrder(channel.listeningOrder ?? 'newest');
        AsyncStorage.getItem(LOCAL_ORDER_KEY).then((raw) => {
          const overrides: Record<string, 'newest' | 'oldest'> = raw ? JSON.parse(raw) : {};
          setUserOrder(overrides[channel.id] ?? channel.listeningOrder ?? 'newest');
        });
      }
    }
  }, [visible, channel, isLoggedIn, session]);

  const checkFavoriteStatus = async () => {
    const { data } = await supabase
      .from('users')
      .select('favorite_channels, favorite_samples, heard_audio, channel_listening_overrides')
      .eq('user_id', session!.user.id)
      .single();
    setIsFavorited((data?.favorite_channels ?? []).includes(channel!.id));
    setFavoriteClips(data?.favorite_samples ?? []);
    setHeardClips((data?.heard_audio as string[]) ?? []);
    const overrides = (data?.channel_listening_overrides as Record<string, 'newest' | 'oldest'>) ?? {};
    setUserOrder(overrides[channel!.id] ?? channel!.listeningOrder ?? 'newest');
  };

  const handleUserOrderChange = async (newOrder: 'newest' | 'oldest' | 'shuffle') => {
    if (!channel) return;
    setUserOrder(newOrder);
    if (session) {
      const { data } = await supabase
        .from('users')
        .select('channel_listening_overrides')
        .eq('user_id', session.user.id)
        .single();
      const current = (data?.channel_listening_overrides as Record<string, string>) ?? {};
      await supabase
        .from('users')
        .update({ channel_listening_overrides: { ...current, [channel.id]: newOrder } } as any)
        .eq('user_id', session.user.id);
    } else {
      const raw = await AsyncStorage.getItem(LOCAL_ORDER_KEY);
      const overrides: Record<string, string> = raw ? JSON.parse(raw) : {};
      overrides[channel.id] = newOrder;
      await AsyncStorage.setItem(LOCAL_ORDER_KEY, JSON.stringify(overrides));
    }
  };

  const toggleFavorite = async () => {
    if (!isLoggedIn || !session || !channel) return;
    const { data } = await supabase
      .from('users')
      .select('favorite_channels')
      .eq('user_id', session.user.id)
      .single();

    const current: string[] = data?.favorite_channels ?? [];
    const updated = isFavorited
      ? current.filter((id) => id !== channel.id)
      : [...current, channel.id];

    await supabase.from('users').update({ favorite_channels: updated }).eq('user_id', session.user.id);

    if (isFavorited) {
      removeFavoriteChannel(channel.id).catch(() => {});
    } else {
      saveFavoriteChannel({ id: channel.id, name: channel.name, imageUrl: channel.imageUrl }).catch(() => {});
    }

    setIsFavorited(!isFavorited);
  };

  if (!channel) return null;

  const handleClose = async () => {
    await stop();
    onClose();
  };

  const showLoginAlert = () => {
    showAlert(t('channel_sheet.login_required'), t('channel_sheet.login_for_alarm'));
  };

  const handleListenFrom = async (clipIndex: number) => {
    if (!channel) return;
    const idsToHear = channel.uploads.slice(clipIndex + 1).map(c => c.id);
    const updated = Array.from(new Set([...heardClips, ...idsToHear]));
    setHeardClips(updated);
    await Promise.all(idsToHear.map(id => addLocalHeardAudio(id)));
    if (session) {
      await supabase.from('users').update({ heard_audio: updated } as any).eq('user_id', session.user.id);
    }
  };

  const handleResetFrom = async (clipIndex: number) => {
    if (!channel) return;
    const idsToReset = channel.uploads.slice(0, clipIndex + 1).map(c => c.id);
    const updated = heardClips.filter(id => !new Set(idsToReset).has(id));
    setHeardClips(updated);
    await removeLocalHeardAudio(idsToReset);
    if (session) {
      await supabase.from('users').update({ heard_audio: updated } as any).eq('user_id', session.user.id);
    }
  };

  const handleResetChannel = async () => {
    if (!channel) return;
    const channelIds = channel.uploads.map(c => c.id);
    const updated = heardClips.filter(id => !new Set(channelIds).has(id));
    setHeardClips(updated);
    await removeLocalHeardAudio(channelIds);
    if (session) {
      await supabase.from('users').update({ heard_audio: updated } as any).eq('user_id', session.user.id);
    }
  };

  const handleSubmitReport = async () => {
    if (!channel || !reportReason.trim()) return;
    setReportSubmitting(true);
    try {
      const { data: channelData } = await supabase
        .from('channels')
        .select('owner_id')
        .eq('channel_id', channel.id)
        .single();
      let ownerUsername = '';
      let ownerEmail = '';
      if (channelData?.owner_id) {
        const { data: ownerData } = await supabase
          .from('users')
          .select('username, email')
          .eq('user_id', channelData.owner_id)
          .single();
        ownerUsername = (ownerData as any)?.username ?? '';
        ownerEmail = (ownerData as any)?.email ?? '';
      }
      await supabase.from('user_reports').insert({
        reported_user_id: channelData?.owner_id ?? '',
        reported_user_username: ownerUsername,
        reported_user_email: ownerEmail,
        reporting_user_id: session?.user.id ?? '',
        reporting_user_username: session ? (session.user.user_metadata?.username ?? '') : 'Guest',
        reporting_user_email: session?.user.email ?? '',
        stated_reason: `[Channel: ${channel.name} (${channel.id})] ${reportReason.trim()}`,
        timestamp: new Date().toISOString(),
      } as any);
      setReportStep(3);
    } catch (e) {
      console.error('[report] failed:', e);
    } finally {
      setReportSubmitting(false);
    }
  };

  const toggleFavoriteClip = async (clipId: string) => {
    if (!isLoggedIn || !session) { showAlert(t('channel_sheet.login_required'), t('channel_sheet.login_for_favorite')); return; }
    const { data } = await supabase
      .from('users')
      .select('favorite_samples')
      .eq('user_id', session.user.id)
      .single();

    const current: string[] = data?.favorite_samples ?? [];
    const updated = current.includes(clipId)
      ? current.filter((id) => id !== clipId)
      : [...current, clipId];

    await supabase.from('users').update({ favorite_samples: updated }).eq('user_id', session.user.id);
    setFavoriteClips(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <AppAlert {...alertProps} />
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg, paddingTop: topPad }} edges={['left', 'right']}>
        <ScrollView>
          <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
            {channel.imageUrl ? (
              <Image
                source={{ uri: channel.imageUrl }}
                style={{ width: '100%', aspectRatio: 1, borderRadius: 0 }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ width: '100%', aspectRatio: 1, borderRadius: 0, backgroundColor: require('../constants/colors').getChannelColor(channel.id), alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 64, fontWeight: 'bold' }}>
                  {channel.name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
                </Text>
              </View>
            )}
          </View>
          <View className="items-center px-6 pt-3 pb-6">
            <Text className="text-[22px] font-bold" style={{ color: text }}>{channel.name}</Text>
            <Text className="text-[14px] mt-1" style={{ color: textSecondary }}>
              {t('channel_sheet.listeners_genre', { listeners: channel.listeners.toLocaleString(), genre: t(`genres.${channel.genre.toLowerCase()}`) })}
            </Text>
            {!!channel.bio && (
              <Text className="text-[15px] mt-3 text-center" style={{ color: textSecondary }}>
                {channel.bio}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 24, width: '100%', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => onSetAlarm(channel)}
                className="flex-1 rounded-full py-3 items-center"
                style={{ backgroundColor: Colors.primary }}
              >
                <Text className="font-bold text-[15px] text-text-primary">{t('channel_sheet.set_alarm')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={isLoggedIn ? toggleFavorite : showLoginAlert}
                className="flex-1 rounded-full py-3 items-center border"
                style={{
                  borderColor: Colors.primary,
                  backgroundColor: isFavorited ? Colors.primary : 'transparent',
                  opacity: isLoggedIn ? 1 : 0.4,
                }}
              >
                <Text className="font-medium text-[15px]" style={{ color: isFavorited ? Colors.textPrimary : text }}>
                  {isFavorited ? t('channel_sheet.favorite_active') : t('channel_sheet.favorite_inactive')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={openChannelOptions}
                style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="settings-outline" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <View className="px-4 pb-2">
            <Text className="text-[13px] font-semibold tracking-wider" style={{ color: textSecondary }}>
              {t('channel_sheet.all_uploads', { count: channel.uploads.length })}
            </Text>
          </View>

          {channel.uploads.map((clip, index) => (
            <AudioListRow
              key={clip.id}
              id={clip.id}
              title={clip.title}
              channelName={channel.name}
              channelId={channel.id}
              date={clip.date}
              duration={clip.duration}
              isPlaying={playingId === clip.id}
              isFavorited={favoriteClips.includes(clip.id)}
              isHeard={heardClips.includes(clip.id)}
              imageUrl={clip.imageUrl}
              onPress={() => { stop(); setPreviewClip({ audioUrl: clip.audioUrl, duration: clip.duration, title: clip.title, audioId: clip.id }); }}
              onFavorite={() => toggleFavoriteClip(clip.id)}
              onListenFrom={() => handleListenFrom(index)}
              onResetFrom={() => handleResetFrom(index)}
            />
          ))}

          {ownerUsername && (
            <View style={{ paddingTop: 40, paddingBottom: 32, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: textSecondary }}>by {ownerUsername}</Text>
            </View>
          )}

        </ScrollView>

        <View style={{ backgroundColor: Colors.primary, height: 56 }}>
          <TouchableOpacity
            onPress={handleClose}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {previewClip && (
        <AlarmRingingModal
          visible={!!previewClip}
          channelId={channel.id}
          channelName={channel.name}
          channelImageUrl={channel.imageUrl}
          previewClip={previewClip}
          onDismiss={() => setPreviewClip(null)}
        />
      )}

      {/* Channel Options */}
      <Modal visible={channelOptionsVisible} animationType="none" transparent>
        <TouchableOpacity style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={closeChannelOptions}>
          <Animated.View style={{ height: '100%', backgroundColor: bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [screenHeight, 0] }) }] }}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }}>
            <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' }}>
                Channel Settings
              </Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <Text style={{ color: textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 10 }}>
                {t('channel_sheet.listening_order')}
              </Text>
              <View style={{ backgroundColor: surface, borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
                {([
                  { mode: 'newest', label: t('channel_sheet.order_newest') },
                  { mode: 'oldest', label: t('channel_sheet.order_oldest') },
                  { mode: 'shuffle', label: t('channel_sheet.order_shuffle') },
                ] as { mode: 'newest' | 'oldest' | 'shuffle'; label: string }[]).map(({ mode, label }, i, arr) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => handleUserOrderChange(mode)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                      borderBottomColor: bg,
                      backgroundColor: userOrder === mode ? Colors.primary : 'transparent',
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: userOrder === mode ? '#000000' : textSecondary }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={async () => {
                  if (!channel) return;
                  setOfflineLoading(true);
                  try {
                    if (offlineEnabled) {
                      await disableOffline(channel.id);
                      setOfflineEnabled(false);
                    } else {
                      await enableOffline(channel.id);
                      setOfflineEnabled(true);
                    }
                  } catch (e) {
                    console.error('[offline] toggle failed:', e);
                  } finally {
                    setOfflineLoading(false);
                  }
                }}
                disabled={offlineLoading}
                style={{ backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 14, alignItems: 'center', marginBottom: 12, opacity: offlineLoading ? 0.6 : 1, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
              >
                {offlineLoading
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Ionicons name={offlineEnabled ? 'cloud-done' : 'cloud-download-outline'} size={18} color="#000000" />
                }
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#000000' }}>
                  {offlineEnabled ? 'Saved Offline' : 'Save Offline'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => showAlert(
                  `Reset ${channel.name}?`,
                  `Are you sure you want to reset ${channel.name}? All tracks will be marked as unlistened.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', style: 'destructive', onPress: handleResetChannel },
                  ]
                )}
                style={{ backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 14, alignItems: 'center', marginBottom: 12 }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#000000' }}>Reset Channel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { closeChannelOptions(); setReportReason(''); setReportStep(1); }}
                style={{ alignItems: 'center', paddingVertical: 10 }}
              >
                <Text style={{ color: '#E05555', fontWeight: '600', fontSize: 13 }}>Report Channel</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ backgroundColor: Colors.primary, height: 56 }}>
              <TouchableOpacity
                onPress={() => closeChannelOptions()}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
                <Text style={{ fontWeight: '500', fontSize: 15, color: Colors.textPrimary }}>{t('common.back')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Step 1: Confirmation */}
      <Modal visible={reportStep === 1} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: bg, borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: text, marginBottom: 8 }}>Report Channel</Text>
            <Text style={{ fontSize: 15, color: textSecondary, marginBottom: 24, lineHeight: 22 }}>
              Are you sure you want to report {channel.name}?
            </Text>
            <TouchableOpacity onPress={() => setReportStep(2)} style={{ backgroundColor: '#CC3333', borderRadius: 100, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReportStep(0)} style={{ backgroundColor: '#F5F5F0', borderRadius: 100, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#666' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Step 2: Reason input */}
      <Modal visible={reportStep === 2} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: bg, borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: text, marginBottom: 16 }}>
              Reason for reporting {channel.name}
            </Text>
            <TextInput
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Describe the issue..."
              placeholderTextColor={textSecondary}
              multiline
              style={{ backgroundColor: '#F5F5F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#000000', minHeight: 100, textAlignVertical: 'top', marginBottom: 20 }}
            />
            <TouchableOpacity
              onPress={handleSubmitReport}
              disabled={!reportReason.trim() || reportSubmitting}
              style={{ backgroundColor: '#CC3333', borderRadius: 100, paddingVertical: 14, alignItems: 'center', marginBottom: 10, opacity: reportReason.trim() && !reportSubmitting ? 1 : 0.4 }}
            >
              {reportSubmitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Report</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReportStep(0)} style={{ backgroundColor: '#F5F5F0', borderRadius: 100, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#666' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Step 3: Success */}
      <Modal visible={reportStep === 3} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: bg, borderRadius: 20, padding: 24, width: '100%' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: text, marginBottom: 8 }}>
              {channel.name} has been reported.
            </Text>
            <TouchableOpacity onPress={() => setReportStep(0)} style={{ backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 14, alignItems: 'center', marginTop: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.textPrimary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}
