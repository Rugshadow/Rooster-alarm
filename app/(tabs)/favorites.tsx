import React, { useState, useCallback, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Text } from '../../components/Text';
import AppAlert from '../../components/AppAlert';
import { useAppAlert } from '../../hooks/useAppAlert';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import ChannelAvatar from '../../components/ChannelAvatar';
import AudioListRow from '../../components/AudioListRow';
import ChannelSheet, { type Channel, type AudioClip } from '../../components/ChannelSheet';
import AlarmSheet from '../../components/AlarmSheet';
import AlarmRingingModal from '../../components/AlarmRingingModal';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import { useAlarmsContext } from '../../contexts/AlarmsContext';
import { supabase } from '../../lib/supabase';

type Tab = 'channels' | 'clips';
type FavoriteClip = AudioClip & { channelName: string; channelId: string; imageUrl?: string };

export default function FavoritesScreen() {
  const { width } = useWindowDimensions();
  const itemWidth = (width - 32 - 32) / 3; // padding 16 each side, gap 16 × 2
  const { isLoggedIn, session } = useAuth();
  const { bg } = useTheme();
  const { t } = useTranslation();
  const { addAlarm } = useAlarmsContext();
  const { showAlert, alertProps } = useAppAlert();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('channels');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [previewClip, setPreviewClip] = useState<{ audioUrl: string; duration: number; title: string; audioId: string; channelId: string; channelName: string; channelImageUrl?: string } | null>(null);
  const player = useAudioPlayer(playingUrl ? { uri: playingUrl } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (playingUrl) player.play();
  }, [playingUrl]);

  useEffect(() => {
    if (playerStatus.didJustFinish) { setPlayingId(null); setPlayingUrl(null); }
  }, [playerStatus.didJustFinish]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [clips, setClips] = useState<FavoriteClip[]>([]);
  const [heardClips, setHeardClips] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [alarmSheetVisible, setAlarmSheetVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn && session) fetchFavorites();
      else setLoading(false);
    }, [isLoggedIn, session])
  );

  const fetchFavorites = async () => {
    setLoading(true);
    const userId = session!.user.id;

    const { data: userData } = await supabase
      .from('users')
      .select('favorite_channels, favorite_samples, heard_audio')
      .eq('user_id', userId)
      .single();

    console.log('[favorites] userData:', JSON.stringify(userData));
    if (!userData) { setLoading(false); return; }

    const favChannelIds: string[] = userData.favorite_channels ?? [];
    console.log('[favorites] favChannelIds:', favChannelIds);
    const favSampleIds: string[] = userData.favorite_samples ?? [];
    setHeardClips((userData.heard_audio as string[]) ?? []);

    const [channelsResult, audioResult] = await Promise.all([
      favChannelIds.length > 0
        ? supabase.from('channels').select('channel_id, name, genre, bio, cover_photo, listening_order').in('channel_id', favChannelIds)
        : Promise.resolve({ data: [], error: null }),
      favChannelIds.length > 0
        ? supabase.from('audio_files').select('*').in('channel_id', favChannelIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    console.log('[favorites] channels result:', JSON.stringify(channelsResult));
    const { data: favChannels } = channelsResult;
    const { data: audioFiles } = audioResult;

    const now = new Date();
    const mappedChannels: Channel[] = (favChannels ?? []).map((ch) => {
      const uploads: AudioClip[] = (audioFiles ?? [])
        .filter((f) => f.channel_id === ch.channel_id && (!f.release_at || new Date(f.release_at) <= now))
        .map((f) => ({
          id: f.audio_id,
          title: f.title,
          date: new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          duration: f.duration_seconds ?? 0,
          audioUrl: f.audio_file,
          imageUrl: f.cover_photo,
        }));
      return {
        id: ch.channel_id,
        name: ch.name,
        genre: ch.genre ?? '',
        listeners: 0,
        bio: (ch as any).bio ?? '',
        imageUrl: ch.cover_photo ?? undefined,
        uploads,
        listeningOrder: (ch.listening_order as 'newest' | 'oldest' | 'shuffle') ?? 'newest',
      };
    });

    let mappedClips: FavoriteClip[] = [];
    if (favSampleIds.length > 0) {
      const { data: favAudio } = await supabase
        .from('audio_files')
        .select('*')
        .in('audio_id', favSampleIds);

      mappedClips = (favAudio ?? []).filter((f) => !f.release_at || new Date(f.release_at) <= now).map((f) => {
        const channel = mappedChannels.find((c) => c.id === f.channel_id);
        return {
          id: f.audio_id,
          title: f.title,
          date: new Date(f.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          duration: f.duration_seconds ?? 0,
          audioUrl: f.audio_file,
          imageUrl: f.cover_photo,
          channelName: channel?.name ?? '',
          channelId: f.channel_id,
        };
      });
    }

    setChannels(mappedChannels);
    setClips(mappedClips);
    setLoading(false);
  };

  const handleUnfavoriteClip = (id: string) => {
    showAlert('Remove Favorite', 'Remove this clip from your favorites?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setClips((prev) => prev.filter((c) => c.id !== id));
          const userId = session!.user.id;
          const { data } = await supabase.from('users').select('favorite_samples').eq('user_id', userId).single();
          const updated = (data?.favorite_samples ?? []).filter((s: string) => s !== id);
          await supabase.from('users').update({ favorite_samples: updated }).eq('user_id', userId);
        },
      },
    ]);
  };

  if (!isLoggedIn) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: bg }}>
        <Text className="text-text-secondary text-[15px] text-center mb-8">
          {t('favorites.login_prompt')}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
          className="rounded-full px-8 py-3.5"
          style={{ backgroundColor: Colors.primary }}
        >
          <Text className="font-bold text-[16px] text-text-primary">{t('common.log_in')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: bg }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: bg }}>
      <AppAlert {...alertProps} />
      <View className="mx-4 mt-4 mb-2 bg-surface rounded-2xl p-1 flex-row">
        {(['channels', 'clips'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 py-2.5 rounded-xl items-center"
            style={{
              backgroundColor: activeTab === tab ? Colors.primary : 'transparent',
              elevation: activeTab === tab ? 2 : 0,
            }}
          >
            <Text
              className="font-semibold text-[15px] capitalize"
              style={{ color: activeTab === tab ? Colors.textPrimary : Colors.textSecondary }}
            >
              {tab === 'clips' ? t('favorites.tab_alarms') : t('favorites.tab_channels')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'channels' ? (
        channels.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-text-secondary text-[15px]">{t('favorites.no_channels')}</Text>
          </View>
        ) : (
          <FlatList
            key="channels"
            data={channels}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={{ padding: 16, gap: 16 }}
            columnWrapperStyle={{ gap: 16, justifyContent: 'flex-start' }}
            renderItem={({ item }) => (
              <TouchableOpacity style={{ width: itemWidth, alignItems: 'center' }} onPress={() => { setSelectedChannel(item); setSheetVisible(true); }}>
                <ChannelAvatar id={item.id} name={item.name} size="carousel" imageUrl={item.imageUrl} />
                <Text className="text-[12px] text-text-secondary mt-2 text-center" numberOfLines={2}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        clips.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-text-secondary text-[15px]">{t('favorites.no_alarms')}</Text>
          </View>
        ) : (
          <FlatList
            key="clips"
            data={clips}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <AudioListRow
                id={item.id}
                title={item.title}
                channelName={item.channelName}
                channelId={item.channelId}
                date={item.date}
                duration={item.duration}
                isPlaying={playingId === item.id}
                isFavorited
                isHeard={heardClips.includes(item.id)}
                imageUrl={item.imageUrl}
                onPress={() => setPreviewClip({
                  audioUrl: item.audioUrl ?? '',
                  duration: item.duration,
                  title: item.title,
                  audioId: item.id,
                  channelId: item.channelId,
                  channelName: item.channelName,
                  channelImageUrl: item.imageUrl,
                })}
                onFavorite={() => handleUnfavoriteClip(item.id)}
              />
            )}
          />
        )
      )}
      <ChannelSheet
        channel={selectedChannel}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSetAlarm={(channel) => {
          setSelectedChannel(channel);
          setSheetVisible(false);
          setAlarmSheetVisible(true);
        }}
      />

      <AlarmSheet
        visible={alarmSheetVisible}
        onClose={() => setAlarmSheetVisible(false)}
        onSave={(alarm) => { addAlarm(alarm); setAlarmSheetVisible(false); }}
        preselectedChannel={selectedChannel ?? undefined}
      />

      {previewClip && (
        <AlarmRingingModal
          visible={!!previewClip}
          channelId={previewClip.channelId}
          channelName={previewClip.channelName}
          channelImageUrl={previewClip.channelImageUrl}
          previewClip={previewClip}
          onDismiss={() => setPreviewClip(null)}
        />
      )}
    </View>
  );
}
