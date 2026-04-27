import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { decode } from 'base64-arraybuffer';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AudioListRow from '../../components/AudioListRow';
import RecordSheet from '../../components/RecordSheet';
import CreateChannelSheet from '../../components/CreateChannelSheet';
import MyChannelsSheet from '../../components/MyChannelsSheet';

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

export default function UploadsScreen() {
  const { isLoggedIn, session } = useAuth();
  const router = useRouter();
  const [recordVisible, setRecordVisible] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>(MOCK_UPLOADS);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [hasChannels, setHasChannels] = useState<boolean | null>(null);
  const [createChannelVisible, setCreateChannelVisible] = useState(false);
  const [myChannelsVisible, setMyChannelsVisible] = useState(false);
  const [channelRefreshTrigger, setChannelRefreshTrigger] = useState(0);
  const [channelName, setChannelName] = useState<string>('Your Channel');
  const [channelCover, setChannelCover] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn && session) fetchChannelData();
  }, [isLoggedIn, session]);

  const fetchChannelData = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('channels')
      .eq('user_id', session!.user.id)
      .single();
    const channelIds: string[] = userData?.channels ?? [];
    if (channelIds.length === 0) { setHasChannels(false); return; }
    const { data: channel } = await supabase
      .from('channels')
      .select('name, cover_photo')
      .eq('channel_id', channelIds[0])
      .single();
    if (channel) {
      setChannelName(channel.name);
      setChannelCover(channel.cover_photo ?? null);
    }
    setHasChannels(true);
  };

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

  if (hasChannels === null) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (hasChannels === false) {
    return (
      <>
        <View className="flex-1 bg-white items-center justify-center px-8">
          <Ionicons name="radio-outline" size={64} color={Colors.primary} />
          <Text className="text-[20px] font-bold text-text-primary mt-4 mb-2 text-center">
            No channels yet
          </Text>
          <Text className="text-text-secondary text-[15px] text-center mb-8">
            Create a channel to start uploading content for your listeners.
          </Text>
          <TouchableOpacity
            onPress={() => setCreateChannelVisible(true)}
            className="rounded-full px-8 py-3.5"
            style={{ backgroundColor: Colors.primary }}
          >
            <Text className="font-bold text-[16px] text-text-primary">Create a Channel</Text>
          </TouchableOpacity>
        </View>
        <CreateChannelSheet
          visible={createChannelVisible}
          onClose={() => setCreateChannelVisible(false)}
          onSave={async ({ name, genre, coverPhotoUri, coverPhotoBase64 }) => {
            if (!session) return;

            let coverUrl: string | null = null;
            if (coverPhotoUri && coverPhotoBase64) {
              const ext = coverPhotoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
              const fileName = `${session.user.id}-${Date.now()}.${ext}`;
              const arrayBuffer = decode(coverPhotoBase64);
              const { error: uploadError } = await supabase.storage
                .from('channel-covers')
                .upload(fileName, arrayBuffer, { contentType: `image/${ext}` });
              if (uploadError) {
                Alert.alert('Upload failed', uploadError.message);
              } else {
                const { data: urlData } = supabase.storage.from('channel-covers').getPublicUrl(fileName);
                coverUrl = urlData.publicUrl;
              }
            }

            const { data: channel, error } = await supabase
              .from('channels')
              .insert({ owner_id: session.user.id, name, genre, cover_photo: coverUrl })
              .select('channel_id')
              .single();
            if (error || !channel) return;
            const { data: userData } = await supabase
              .from('users')
              .select('channels')
              .eq('user_id', session.user.id)
              .single();
            const updated = [...(userData?.channels ?? []), channel.channel_id];
            await supabase.from('users').update({ channels: updated }).eq('user_id', session.user.id);
            setCreateChannelVisible(false);
            setChannelName(name);
            setChannelCover(coverUrl);
            setHasChannels(true);
            setChannelRefreshTrigger((n) => n + 1);
          }}
        />
      </>
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

  return (
    <>
      <FlatList
        className="flex-1 bg-white"
        data={uploads}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <View className="items-center pt-6 pb-6 px-6">
              <Image
                source={channelCover ? { uri: channelCover } : require('../../assets/icon.png')}
                style={{ width: 320, height: 320 }}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => setMyChannelsVisible(true)}
                className="flex-row items-center gap-1 mt-4 rounded-full px-4 py-2"
                style={{ backgroundColor: Colors.primary }}
              >
                <Text className="text-[16px] font-bold text-text-primary">{channelName}</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text className="text-text-secondary text-[13px] mt-1">
                {uploads.length} upload{uploads.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <View className="flex-row gap-3 px-4 mb-4">
              <TouchableOpacity
                onPress={() => setRecordVisible(true)}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3"
                style={{ backgroundColor: '#FF3B30' }}
              >
                <Ionicons name="mic" size={18} color="white" />
                <Text className="font-semibold text-[15px]" style={{ color: 'white' }}>Record</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3"
                style={{ backgroundColor: Colors.primary }}
              >
                <Ionicons name="cloud-upload" size={18} color={Colors.textPrimary} />
                <Text className="font-semibold text-[15px] text-text-primary">Upload .wav</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="mx-4 mb-4 flex-row items-center justify-center gap-2 rounded-full py-3"
              style={{ backgroundColor: Colors.primary }}
            >
              <Ionicons name="settings-outline" size={16} color={Colors.textPrimary} />
              <Text className="font-semibold text-[15px] text-text-primary">Channel Settings</Text>
            </TouchableOpacity>

            <Text className="text-[12px] font-semibold text-text-secondary tracking-wider px-4 mb-2">
              YOUR UPLOADS
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AudioListRow
            id={item.id}
            title={item.title}
            channelName={channelName}
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
        onSave={(_data) => {
          // TODO: upload recording to Supabase
        }}
      />

      <MyChannelsSheet
        visible={myChannelsVisible}
        onClose={() => setMyChannelsVisible(false)}
        onAddNew={() => {
          setMyChannelsVisible(false);
          setCreateChannelVisible(true);
        }}
        onSelect={(ch) => {
          setChannelName(ch.name);
          setChannelCover(ch.cover_photo);
        }}
        refreshTrigger={channelRefreshTrigger}
      />

      <CreateChannelSheet
        visible={createChannelVisible}
        onClose={() => setCreateChannelVisible(false)}
        onSave={async ({ name, genre, coverPhotoUri, coverPhotoBase64 }) => {
          if (!session) return;
          let coverUrl: string | null = null;
          if (coverPhotoUri && coverPhotoBase64) {
            const ext = coverPhotoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
            const fileName = `${session.user.id}-${Date.now()}.${ext}`;
            const arrayBuffer = decode(coverPhotoBase64);
            const { error: uploadError } = await supabase.storage
              .from('channel-covers')
              .upload(fileName, arrayBuffer, { contentType: `image/${ext}` });
            if (uploadError) {
              Alert.alert('Upload failed', uploadError.message);
            } else {
              const { data: urlData } = supabase.storage.from('channel-covers').getPublicUrl(fileName);
              coverUrl = urlData.publicUrl;
            }
          }
          const { data: channel, error } = await supabase
            .from('channels')
            .insert({ owner_id: session.user.id, name, genre, cover_photo: coverUrl })
            .select('channel_id')
            .single();
          if (error || !channel) return;
          const { data: userData } = await supabase
            .from('users')
            .select('channels')
            .eq('user_id', session.user.id)
            .single();
          const updated = [...(userData?.channels ?? []), channel.channel_id];
          await supabase.from('users').update({ channels: updated }).eq('user_id', session.user.id);
          setCreateChannelVisible(false);
          setChannelName(name);
          setChannelCover(coverUrl);
          setHasChannels(true);
          setChannelRefreshTrigger((n) => n + 1);
        }}
      />
    </>
  );
}
