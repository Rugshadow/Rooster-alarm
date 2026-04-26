import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/colors';
import ChannelAvatar from '../../components/ChannelAvatar';
import AudioListRow from '../../components/AudioListRow';
import type { Channel, AudioClip } from '../../components/ChannelSheet';

type Tab = 'channels' | 'clips';

const MOCK_SAVED_CHANNELS: Channel[] = [
  {
    id: '1', name: 'Morning Mindset', genre: 'health', listeners: 12400,
    bio: 'Start your day with powerful mindset shifts.',
    uploads: [],
  },
  {
    id: '2', name: 'Daily Jazz', genre: 'music', listeners: 8900,
    bio: 'Smooth jazz to ease you into your morning.',
    uploads: [],
  },
  {
    id: '5', name: 'Zen Morning', genre: 'ambient', listeners: 21000,
    bio: 'Calming nature sounds.',
    uploads: [],
  },
];

type FavoriteClip = AudioClip & { channelName: string; channelId: string };

const MOCK_SAVED_CLIPS: FavoriteClip[] = [
  { id: 'u1', title: 'Rise & Shine', date: 'Apr 24', duration: 95, audioUrl: '', channelName: 'Morning Mindset', channelId: '1' },
  { id: 'u3', title: 'Blue Morning', date: 'Apr 23', duration: 180, audioUrl: '', channelName: 'Daily Jazz', channelId: '2' },
  { id: 'u7', title: 'Forest Rain', date: 'Apr 22', duration: 240, audioUrl: '', channelName: 'Zen Morning', channelId: '5' },
];

export default function FavoritesScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('channels');
  const [playingId, setPlayingId] = useState<string | null>(null);

  return (
    <View className="flex-1 bg-white">
      <View className="mx-4 mt-4 mb-2 bg-surface rounded-2xl p-1 flex-row">
        {(['channels', 'clips'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className="flex-1 py-2.5 rounded-xl items-center"
            style={{
              backgroundColor: activeTab === tab ? Colors.background : 'transparent',
              shadowColor: activeTab === tab ? '#000' : 'transparent',
              shadowOpacity: activeTab === tab ? 0.08 : 0,
              shadowRadius: 4,
              elevation: activeTab === tab ? 2 : 0,
            }}
          >
            <Text
              className="font-semibold text-[15px] capitalize"
              style={{
                color: activeTab === tab ? Colors.textPrimary : Colors.textSecondary,
              }}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'channels' ? (
        <FlatList
          data={MOCK_SAVED_CHANNELS}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          columnWrapperStyle={{ gap: 16 }}
          renderItem={({ item }) => (
            <TouchableOpacity className="flex-1 items-center">
              <ChannelAvatar id={item.id} name={item.name} size="carousel" />
              <Text
                className="text-[12px] text-text-secondary mt-2 text-center"
                numberOfLines={2}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={MOCK_SAVED_CLIPS}
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
              onPress={() => setPlayingId(playingId === item.id ? null : item.id)}
            />
          )}
        />
      )}
    </View>
  );
}
