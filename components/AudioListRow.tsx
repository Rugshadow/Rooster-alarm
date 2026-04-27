import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import ChannelAvatar from './ChannelAvatar';

type Props = {
  id: string;
  title: string;
  channelName: string;
  channelId: string;
  date: string;
  duration: number;
  isPlaying: boolean;
  isFavorited?: boolean;
  isScheduled?: boolean;
  imageUrl?: string;
  onPress: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioListRow({
  id,
  title,
  channelName,
  channelId,
  date,
  duration,
  isPlaying,
  isFavorited,
  isScheduled,
  imageUrl,
  onPress,
  onFavorite,
  onDelete,
}: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} className="flex-row items-center py-3 px-4 bg-white border-b border-gray-100">
      <View style={{ width: 50, height: 50 }} className="items-center justify-center mr-3">
        {isScheduled ? (
          <View style={{ width: 50, height: 50, borderRadius: 10 }} className="bg-surface items-center justify-center">
            <Ionicons name="moon" size={24} color={Colors.textSecondary} />
          </View>
        ) : imageUrl ? (
          <Image source={{ uri: imageUrl }} style={{ width: 50, height: 50, borderRadius: 0 }} resizeMode="cover" />
        ) : (
          <ChannelAvatar id={channelId} name={channelName} size="list" />
        )}
        {isPlaying && (
          <View className="absolute inset-0 items-center justify-center bg-black/30">
            <Ionicons name="pause" size={20} color="white" />
          </View>
        )}
      </View>

      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-text-primary font-medium text-[15px]" numberOfLines={1}>
            {title}
          </Text>
          {isScheduled && (
            <View className="bg-surface rounded-full px-2 py-0.5">
              <Text className="text-text-secondary text-[11px]">Scheduled</Text>
            </View>
          )}
        </View>
        <Text className="text-text-secondary text-[13px] mt-0.5">
          {date} · {formatDuration(duration)}
        </Text>
      </View>

      {onFavorite && (
        <TouchableOpacity onPress={onFavorite} className="px-2">
          <Ionicons
            name={isFavorited ? 'star' : 'star-outline'}
            size={20}
            color={isFavorited ? Colors.primary : Colors.textSecondary}
          />
        </TouchableOpacity>
      )}

      {onDelete && (
        <TouchableOpacity onPress={onDelete} className="px-2" hitSlop={8}>
          <Ionicons name="trash-outline" size={20} color={Colors.destructive} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
