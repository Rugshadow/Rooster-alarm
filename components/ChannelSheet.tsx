import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import AlarmRingingModal from './AlarmRingingModal';
import AppAlert from './AppAlert';
import { useAppAlert } from '../hooks/useAppAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import ChannelAvatar from './ChannelAvatar';
import AudioListRow from './AudioListRow';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';
import { saveFavoriteChannel, removeFavoriteChannel } from '../lib/cachedFavorites';
import { useTranslation } from 'react-i18next';

export type Channel = {
  id: string;
  name: string;
  genre: string;
  listeners: number;
  bio: string;
  uploads: AudioClip[];
  imageUrl?: string;
  listeningOrder?: 'newest' | 'oldest';
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
  const { bg, text, textSecondary } = useTheme();
  const { showAlert, alertProps } = useAppAlert();
  const { t } = useTranslation();
  const { playingId, play, stop } = useAudioPlayer();
  const [previewClip, setPreviewClip] = useState<{ audioUrl: string; duration: number; title: string; audioId: string } | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteClips, setFavoriteClips] = useState<string[]>([]);
  const [heardClips, setHeardClips] = useState<string[]>([]);
  const [userOrder, setUserOrder] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    if (visible && channel) {
      setUserOrder(channel.listeningOrder ?? 'newest');
      if (isLoggedIn && session) checkFavoriteStatus();
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

  const handleUserOrderChange = async (newOrder: 'newest' | 'oldest') => {
    setUserOrder(newOrder);
    if (!session || !channel) return;
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
    if (!session || !channel) return;
    // uploads is newest-first; indices > clipIndex are older clips — mark them all as heard
    const idsToHear = channel.uploads.slice(clipIndex + 1).map(c => c.id);
    const updated = Array.from(new Set([...heardClips, ...idsToHear]));
    setHeardClips(updated);
    await supabase
      .from('users')
      .update({ heard_audio: updated } as any)
      .eq('user_id', session.user.id);
  };

  const handleResetFrom = async (clipIndex: number) => {
    if (!session || !channel) return;
    // uploads is newest-first; indices 0..clipIndex are this clip + all newer ones
    const idsToReset = new Set(channel.uploads.slice(0, clipIndex + 1).map(c => c.id));
    const updated = heardClips.filter(id => !idsToReset.has(id));
    setHeardClips(updated);
    await supabase
      .from('users')
      .update({ heard_audio: updated } as any)
      .eq('user_id', session.user.id);
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
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['top', 'left', 'right']}>
        <ScrollView>
          <View className="items-center px-6 pt-8 pb-6">
            <ChannelAvatar id={channel.id} name={channel.name} size="large" imageUrl={channel.imageUrl} />
            <Text className="text-[22px] font-bold mt-4" style={{ color: text }}>{channel.name}</Text>
            <Text className="text-[14px] mt-1" style={{ color: textSecondary }}>
              {t('channel_sheet.listeners_genre', { listeners: channel.listeners.toLocaleString(), genre: t(`genres.${channel.genre.toLowerCase()}`) })}
            </Text>
            {!!channel.bio && (
              <Text className="text-[15px] mt-3 text-center" style={{ color: textSecondary }}>
                {channel.bio}
              </Text>
            )}

            <View className="flex-row gap-3 mt-6 w-full">
              <TouchableOpacity
                onPress={isLoggedIn ? () => onSetAlarm(channel) : showLoginAlert}
                className="flex-1 rounded-full py-3 items-center"
                style={{ backgroundColor: Colors.primary, opacity: isLoggedIn ? 1 : 0.4 }}
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
              isHeard={isLoggedIn ? heardClips.includes(clip.id) : undefined}
              imageUrl={clip.imageUrl}
              onPress={() => { stop(); setPreviewClip({ audioUrl: clip.audioUrl, duration: clip.duration, title: clip.title, audioId: clip.id }); }}
              onFavorite={() => toggleFavoriteClip(clip.id)}
              onListenFrom={isLoggedIn ? () => handleListenFrom(index) : undefined}
              onResetFrom={isLoggedIn ? () => handleResetFrom(index) : undefined}
            />
          ))}

          {isLoggedIn && (
            <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
              <Text style={{ color: textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 12 }}>
                {t('channel_sheet.listening_order')}
              </Text>
              <View style={{ flexDirection: 'row', backgroundColor: '#F5F5F0', borderRadius: 16, padding: 4 }}>
                {(['newest', 'oldest'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => handleUserOrderChange(mode)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      alignItems: 'center',
                      backgroundColor: userOrder === mode ? Colors.primary : 'transparent',
                    }}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: userOrder === mode ? Colors.textPrimary : Colors.textSecondary,
                    }}>
                      {mode === 'newest' ? t('channel_sheet.order_newest') : t('channel_sheet.order_oldest')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
    </Modal>
  );
}
