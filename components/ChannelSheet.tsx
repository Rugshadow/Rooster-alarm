import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import ChannelAvatar from './ChannelAvatar';
import AudioListRow from './AudioListRow';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTheme } from '../hooks/useTheme';

export type Channel = {
  id: string;
  name: string;
  genre: string;
  listeners: number;
  bio: string;
  uploads: AudioClip[];
  imageUrl?: string;
};

export type AudioClip = {
  id: string;
  title: string;
  date: string;
  duration: number;
  audioUrl: string;
  isScheduled?: boolean;
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
  const { playingId, play, stop } = useAudioPlayer();
  const [isFavorited, setIsFavorited] = useState(false);
  const [favoriteClips, setFavoriteClips] = useState<string[]>([]);

  useEffect(() => {
    if (isLoggedIn && session && channel) checkFavoriteStatus();
  }, [channel, isLoggedIn, session]);

  const checkFavoriteStatus = async () => {
    const { data } = await supabase
      .from('users')
      .select('favorite_channels, favorite_samples')
      .eq('user_id', session!.user.id)
      .single();
    setIsFavorited((data?.favorite_channels ?? []).includes(channel!.id));
    setFavoriteClips(data?.favorite_samples ?? []);
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
    setIsFavorited(!isFavorited);
  };

  if (!channel) return null;

  const handleClose = async () => {
    await stop();
    onClose();
  };

  const toggleFavoriteClip = async (clipId: string) => {
    if (!isLoggedIn || !session) return;
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
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['top', 'left', 'right']}>
        <ScrollView>
          <View className="items-center px-6 pt-8 pb-6">
            <ChannelAvatar id={channel.id} name={channel.name} size="large" imageUrl={channel.imageUrl} />
            <Text className="text-[22px] font-bold mt-4" style={{ color: text }}>{channel.name}</Text>
            <Text className="text-[14px] mt-1" style={{ color: textSecondary }}>
              {channel.listeners.toLocaleString()} listeners · {channel.genre}
            </Text>
            <Text className="text-[15px] mt-3 text-center" style={{ color: textSecondary }}>
              {channel.bio}
            </Text>

            <View className="flex-row gap-3 mt-6 w-full">
              <TouchableOpacity
                onPress={() => onSetAlarm(channel)}
                className="flex-1 rounded-full py-3 items-center"
                style={{ backgroundColor: Colors.primary }}
              >
                <Text className="font-bold text-[15px] text-text-primary">Set as Alarm</Text>
              </TouchableOpacity>

              {isLoggedIn && (
                <TouchableOpacity
                  onPress={toggleFavorite}
                  className="flex-1 rounded-full py-3 items-center border"
                  style={{
                    borderColor: Colors.primary,
                    backgroundColor: isFavorited ? Colors.primary : 'transparent',
                  }}
                >
                  <Text className="font-medium text-[15px]" style={{ color: isFavorited ? Colors.textPrimary : text }}>
                    {isFavorited ? '★ Favorite' : '☆ Favorite'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View className="px-4 pb-2">
            <Text className="text-[13px] font-semibold tracking-wider" style={{ color: textSecondary }}>
              ALL UPLOADS ({channel.uploads.length})
            </Text>
          </View>

          {channel.uploads.map((clip) => (
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
              isScheduled={clip.isScheduled}
              imageUrl={clip.imageUrl}
              onPress={() => play(clip.id, clip.audioUrl)}
              onFavorite={() => toggleFavoriteClip(clip.id)}
            />
          ))}
        </ScrollView>

        <View style={{ backgroundColor: Colors.primary }}>
          <TouchableOpacity
            onPress={handleClose}
            className="flex-row items-center justify-center gap-1 py-4"
            style={{ paddingBottom: 24 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
