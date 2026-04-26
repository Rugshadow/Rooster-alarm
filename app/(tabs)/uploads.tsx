import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import ChannelAvatar from '../../components/ChannelAvatar';
import AudioListRow from '../../components/AudioListRow';
import RecordSheet from '../../components/RecordSheet';

type Upload = {
  id: string;
  title: string;
  date: string;
  duration: number;
  plays: number;
  isScheduled?: boolean;
};

const MOCK_UPLOADS: Upload[] = [
  { id: 'u1', title: 'Morning Vibes Ep. 12', date: 'Apr 25', duration: 95, plays: 234 },
  { id: 'u2', title: 'Weekend Warmup', date: 'Apr 22', duration: 112, plays: 180 },
  { id: 'u3', title: 'Sunday Special', date: 'Apr 20', duration: 75, plays: 0, isScheduled: true },
];

const LOGGED_OUT_ID = 'logged-out-placeholder';

export default function UploadsScreen() {
  const { isLoggedIn } = useAuth();
  const router = useRouter();
  const [recordVisible, setRecordVisible] = useState(false);
  const [contentOrder, setContentOrder] = useState<'newest_first' | 'oldest_first'>('newest_first');
  const [uploads, setUploads] = useState<Upload[]>(MOCK_UPLOADS);
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-8">
        <Text style={{ fontSize: 64 }}>🎙️</Text>
        <Text className="text-[22px] font-bold text-text-primary mt-4 mb-2">
          Become a Creator
        </Text>
        <Text className="text-text-secondary text-[15px] text-center mb-8">
          Upload audio clips and let listeners wake up to your voice every morning
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
          className="rounded-full px-8 py-3.5"
          style={{ backgroundColor: Colors.primary }}
        >
          <Text className="font-bold text-[16px] text-text-primary">Log In to Upload</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const deleteUpload = (id: string) => {
    Alert.alert('Delete Upload', 'Remove this clip from your channel?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setUploads((prev) => prev.filter((u) => u.id !== id)),
      },
    ]);
  };

  const sortedUploads =
    contentOrder === 'newest_first' ? [...uploads] : [...uploads].reverse();

  return (
    <>
      <FlatList
        className="flex-1 bg-white"
        data={sortedUploads}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View className="px-4 pt-4 pb-3 flex-row items-center gap-4">
              <ChannelAvatar id="my-channel" name="My Channel" size="list" />
              <View>
                <Text className="text-[17px] font-bold text-text-primary">Your Channel</Text>
                <Text className="text-text-secondary text-[13px]">
                  {uploads.length} upload{uploads.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3 px-4 mb-4">
              <TouchableOpacity
                onPress={() => setRecordVisible(true)}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3 bg-surface"
              >
                <Text style={{ fontSize: 16 }}>🎤</Text>
                <Text className="font-semibold text-[15px] text-text-primary">Record</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3"
                style={{ backgroundColor: Colors.primary }}
              >
                <Ionicons name="cloud-upload" size={18} color={Colors.textPrimary} />
                <Text className="font-semibold text-[15px] text-text-primary">Upload .wav</Text>
              </TouchableOpacity>
            </View>

            <View className="mx-4 mb-4 bg-surface rounded-2xl p-1 flex-row">
              {(['newest_first', 'oldest_first'] as const).map((order) => (
                <TouchableOpacity
                  key={order}
                  onPress={() => setContentOrder(order)}
                  className="flex-1 py-2.5 rounded-xl items-center"
                  style={{
                    backgroundColor: contentOrder === order ? Colors.background : 'transparent',
                    elevation: contentOrder === order ? 2 : 0,
                  }}
                >
                  <Text
                    className="font-medium text-[14px]"
                    style={{
                      color: contentOrder === order ? Colors.textPrimary : Colors.textSecondary,
                    }}
                  >
                    {order === 'newest_first' ? 'Newest First' : 'Oldest First'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-[12px] font-semibold text-text-secondary tracking-wider px-4 mb-2">
              YOUR UPLOADS
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AudioListRow
            id={item.id}
            title={item.title}
            channelName="Your Channel"
            channelId="my-channel"
            date={item.date}
            duration={item.duration}
            isPlaying={playingId === item.id}
            isScheduled={item.isScheduled}
            onPress={() => setPlayingId(playingId === item.id ? null : item.id)}
            onDelete={() => deleteUpload(item.id)}
          />
        )}
      />

      <RecordSheet
        visible={recordVisible}
        onClose={() => setRecordVisible(false)}
        onSave={() => {}}
      />
    </>
  );
}
