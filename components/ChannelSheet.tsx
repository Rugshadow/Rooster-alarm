import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import ChannelAvatar from './ChannelAvatar';
import AudioListRow from './AudioListRow';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

export type Channel = {
  id: string;
  name: string;
  genre: string;
  listeners: number;
  bio: string;
  uploads: AudioClip[];
};

export type AudioClip = {
  id: string;
  title: string;
  date: string;
  duration: number;
  audioUrl: string;
  isScheduled?: boolean;
};

type Props = {
  channel: Channel | null;
  visible: boolean;
  onClose: () => void;
  savedChannels: string[];
  onToggleSave: (id: string) => void;
  onSetAlarm: (channel: Channel) => void;
};

export default function ChannelSheet({
  channel,
  visible,
  onClose,
  savedChannels,
  onToggleSave,
  onSetAlarm,
}: Props) {
  const { playingId, play, stop } = useAudioPlayer();
  const [favoriteClips, setFavoriteClips] = useState<string[]>([]);

  if (!channel) return null;

  const isSaved = savedChannels.includes(channel.id);

  const handleClose = async () => {
    await stop();
    onClose();
  };

  const toggleFavoriteClip = (clipId: string) => {
    setFavoriteClips((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <TouchableOpacity onPress={handleClose} className="mr-3">
            <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text className="text-[17px] font-semibold text-text-primary flex-1">Channel</Text>
        </View>

        <ScrollView>
          <View className="items-center px-6 pt-8 pb-6">
            <ChannelAvatar id={channel.id} name={channel.name} size="large" />
            <Text className="text-[22px] font-bold text-text-primary mt-4">{channel.name}</Text>
            <Text className="text-text-secondary text-[14px] mt-1">
              {channel.listeners.toLocaleString()} listeners · {channel.genre}
            </Text>
            <Text className="text-text-secondary text-[15px] mt-3 text-center">
              {channel.bio}
            </Text>

            <View className="flex-row gap-3 mt-6 w-full">
              <TouchableOpacity
                onPress={() => onSetAlarm(channel)}
                className="flex-1 rounded-full py-3 items-center"
                style={{ backgroundColor: Colors.primaryDark }}
              >
                <Text className="font-bold text-[15px]" style={{ color: Colors.textPrimary }}>
                  Set as Alarm
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onToggleSave(channel.id)}
                className="flex-1 rounded-full py-3 items-center border"
                style={{
                  borderColor: Colors.primaryDark,
                  backgroundColor: isSaved ? Colors.primaryLight : Colors.background,
                }}
              >
                <Text className="font-medium text-[15px]" style={{ color: Colors.textPrimary }}>
                  {isSaved ? '★ Saved' : '☆ Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View className="px-4 pb-2">
            <Text className="text-[13px] font-semibold text-text-secondary tracking-wider">
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
              onPress={() => play(clip.id, clip.audioUrl)}
              onFavorite={() => toggleFavoriteClip(clip.id)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
