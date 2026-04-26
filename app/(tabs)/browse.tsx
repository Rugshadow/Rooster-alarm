import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import ChannelAvatar from '../../components/ChannelAvatar';
import ChannelSheet, { type Channel } from '../../components/ChannelSheet';
import AlarmSheet from '../../components/AlarmSheet';

const GENRES = [
  'health', 'music', 'education', 'news', 'uplifting',
  'religious', 'comedy', 'ambient', 'puzzle', 'alternative',
] as const;

const MOCK_CHANNELS: Channel[] = [
  {
    id: '1', name: 'Morning Mindset', genre: 'health', listeners: 12400,
    bio: 'Start your day with powerful mindset shifts and positive affirmations.',
    uploads: [
      { id: 'u1', title: 'Rise & Shine', date: 'Apr 24', duration: 95, audioUrl: '' },
      { id: 'u2', title: 'Monday Energy', date: 'Apr 21', duration: 112, audioUrl: '' },
    ],
  },
  {
    id: '2', name: 'Daily Jazz', genre: 'music', listeners: 8900,
    bio: 'Smooth jazz to ease you into your morning.',
    uploads: [
      { id: 'u3', title: 'Blue Morning', date: 'Apr 23', duration: 180, audioUrl: '' },
    ],
  },
  {
    id: '3', name: 'News Brief', genre: 'news', listeners: 34000,
    bio: 'Two-minute daily news summary — everything you need before coffee.',
    uploads: [
      { id: 'u4', title: 'Apr 25 Update', date: 'Apr 25', duration: 120, audioUrl: '' },
      { id: 'u5', title: 'Apr 24 Update', date: 'Apr 24', duration: 118, audioUrl: '', isScheduled: true },
    ],
  },
  {
    id: '4', name: 'Laugh Start', genre: 'comedy', listeners: 5600,
    bio: 'A daily joke to kickstart your morning with a smile.',
    uploads: [
      { id: 'u6', title: "Friday's Joke", date: 'Apr 25', duration: 45, audioUrl: '' },
    ],
  },
  {
    id: '5', name: 'Zen Morning', genre: 'ambient', listeners: 21000,
    bio: 'Calming nature sounds and gentle meditation guidance.',
    uploads: [
      { id: 'u7', title: 'Forest Rain', date: 'Apr 22', duration: 240, audioUrl: '' },
    ],
  },
  {
    id: '6', name: 'Word of Day', genre: 'education', listeners: 7800,
    bio: 'Expand your vocabulary one morning at a time.',
    uploads: [
      { id: 'u8', title: 'Ephemeral', date: 'Apr 25', duration: 60, audioUrl: '' },
    ],
  },
];

const SECTIONS = [
  { title: 'Staff Favorites', channels: MOCK_CHANNELS.slice(0, 4) },
  { title: 'Trending Now', channels: MOCK_CHANNELS.slice(2, 6) },
  { title: 'New Arrivals', channels: MOCK_CHANNELS.slice(1, 5) },
];

function CarouselSection({
  title,
  channels,
  onPress,
}: {
  title: string;
  channels: Channel[];
  onPress: (ch: Channel) => void;
}) {
  return (
    <View className="mb-6">
      <Text className="text-[18px] font-bold text-text-primary px-4 mb-3">{title}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={channels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onPress(item)}
            className="items-center"
            style={{ width: 90 }}
          >
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
    </View>
  );
}

export default function BrowseScreen() {
  const [searchText, setSearchText] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [alarmSheetVisible, setAlarmSheetVisible] = useState(false);
  const [savedChannels, setSavedChannels] = useState<string[]>([]);

  const openChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setSheetVisible(true);
  };

  const toggleSave = (id: string) => {
    setSavedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const genreSections = GENRES.map((genre) => ({
    title: genre.charAt(0).toUpperCase() + genre.slice(1),
    channels: MOCK_CHANNELS.filter((c) => c.genre === genre),
  })).filter((s) => s.channels.length > 0);

  return (
    <>
      <ScrollView className="flex-1 bg-white" showsVerticalScrollIndicator={false}>
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center bg-surface rounded-2xl px-4 py-3 gap-2">
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search & filter alarms..."
              placeholderTextColor={Colors.textSecondary}
              className="flex-1 text-[15px] text-text-primary"
            />
          </View>
        </View>

        <View className="pt-4">
          {SECTIONS.map((section) => (
            <CarouselSection
              key={section.title}
              title={section.title}
              channels={section.channels}
              onPress={openChannel}
            />
          ))}

          {genreSections.map((section) => (
            <CarouselSection
              key={section.title}
              title={section.title}
              channels={section.channels}
              onPress={openChannel}
            />
          ))}
        </View>
      </ScrollView>

      <ChannelSheet
        channel={selectedChannel}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        savedChannels={savedChannels}
        onToggleSave={toggleSave}
        onSetAlarm={() => {
          setSheetVisible(false);
          setAlarmSheetVisible(true);
        }}
      />

      <AlarmSheet
        visible={alarmSheetVisible}
        onClose={() => setAlarmSheetVisible(false)}
        onSave={() => setAlarmSheetVisible(false)}
        channels={MOCK_CHANNELS}
      />
    </>
  );
}
