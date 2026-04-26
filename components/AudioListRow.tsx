import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
  onPress,
  onFavorite,
  onDelete,
}: Props) {
  return (
    <View className="flex-row items-center py-3 px-4 bg-white border-b border-gray-100">
      <TouchableOpacity onPress={onPress} className="mr-3">
        <View
          style={{ width: 50, height: 50, borderRadius: 10 }}
          className={`items-center justify-center ${isScheduled ? 'bg-surface' : ''}`}
        >
          {isScheduled ? (
            <Ionicons name="moon" size={24} color={Colors.textSecondary} />
          ) : (
            <ChannelAvatar id={channelId} name={channelName} size="list" />
          )}
          {isPlaying && (
            <View className="absolute inset-0 items-center justify-center bg-black/30 rounded-[10px]">
              <Ionicons name="pause" size={20} color="white" />
            </View>
          )}
        </View>
      </TouchableOpacity>

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
        <TouchableOpacity onPress={onDelete} className="px-2">
          <Ionicons name="trash-outline" size={20} color={Colors.destructive} />
        </TouchableOpacity>
      )}
    </View>
  );
}
