import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { decode } from 'base64-arraybuffer';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import AudioListRow from '../../components/AudioListRow';
import RecordSheet from '../../components/RecordSheet';
import CreateChannelSheet from '../../components/CreateChannelSheet';
import MyChannelsSheet from '../../components/MyChannelsSheet';
import ChannelSettingsSheet from '../../components/ChannelSettingsSheet';
import { useTheme } from '../../hooks/useTheme';

type Upload = {
  id: string;
  title: string;
  date: string;
  duration: number;
  plays: number;
  coverPhoto?: string | null;
  audioUrl?: string;
  isScheduled?: boolean;
};

export default function UploadsScreen() {
  const { isLoggedIn, session } = useAuth();
  const { bg } = useTheme();
  const router = useRouter();
  const [recordVisible, setRecordVisible] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [hasChannels, setHasChannels] = useState<boolean | null>(null);
  const [createChannelVisible, setCreateChannelVisible] = useState(false);
  const [myChannelsVisible, setMyChannelsVisible] = useState(false);
  const [channelRefreshTrigger, setChannelRefreshTrigger] = useState(0);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string>('Your Channel');
  const [channelCover, setChannelCover] = useState<string | null>(null);
  const [channelGenre, setChannelGenre] = useState<string>('');
  const [channelListeningOrder, setChannelListeningOrder] = useState<'newest' | 'oldest'>('newest');
  const [channelSettingsVisible, setChannelSettingsVisible] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const player = useAudioPlayer(playingUrl ? { uri: playingUrl } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (playingUrl) player.play();
  }, [playingUrl]);

  useEffect(() => {
    if (playerStatus.didJustFinish) setPlayingId(null);
  }, [playerStatus.didJustFinish]);

  const handleRowPress = (item: Upload) => {
    if (playingId === item.id) {
      player.pause();
      setPlayingId(null);
      setPlayingUrl(null);
    } else {
      setPlayingId(item.id);
      setPlayingUrl(item.audioUrl ?? null);
    }
  };

  useEffect(() => {
    if (isLoggedIn && session) fetchChannelData();
  }, [isLoggedIn, session]);

  useEffect(() => {
    if (channelId) fetchUploads(channelId);
  }, [channelId]);

  const fetchChannelData = async () => {
    const { data: userData } = await supabase
      .from('users')
      .select('channels')
      .eq('user_id', session!.user.id)
      .single();
    const channelIds: string[] = (userData as any)?.channels ?? [];
    if (channelIds.length === 0) { setHasChannels(false); return; }
    const { data: channel } = await supabase
      .from('channels')
      .select('channel_id, name, cover_photo, genre, listening_order')
      .eq('channel_id', channelIds[0])
      .single();
    if (channel) {
      setChannelId((channel as any).channel_id);
      setChannelName((channel as any).name);
      setChannelCover((channel as any).cover_photo ?? null);
      setChannelGenre((channel as any).genre ?? '');
      setChannelListeningOrder((channel as any).listening_order ?? 'newest');
    }
    setHasChannels(true);
  };

  const fetchUploads = async (chId: string) => {
    setUploadsLoading(true);
    const { data } = await supabase
      .from('audio_files')
      .select('audio_id, title, created_at, duration_seconds, num_of_plays, release_at, cover_photo, audio_file')
      .eq('channel_id', chId)
      .order('created_at', { ascending: false });
    if (data) {
      setUploads(data.map((row: any) => ({
        id: row.audio_id,
        title: row.title,
        date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        duration: row.duration_seconds ?? 0,
        plays: row.num_of_plays ?? 0,
        coverPhoto: row.cover_photo ?? null,
        audioUrl: row.audio_file ?? undefined,
        isScheduled: row.release_at ? new Date(row.release_at) > new Date() : false,
      })));
    }
    setUploadsLoading(false);
  };

  const saveRecording = async (data: {
    uri: string;
    title: string;
    thumbnailUri?: string;
    thumbnailBase64?: string;
    releaseDate?: Date;
    durationSeconds: number;
  }) => {
    if (!session || !channelId) return;
    try {
      // Upload audio file
      const audioExt = data.uri.split('.').pop()?.toLowerCase() ?? 'm4a';
      const audioFileName = `${session.user.id}-${Date.now()}.${audioExt}`;
      console.log('[upload] reading audio from URI:', data.uri);
      const audioResponse = await fetch(data.uri);
      const audioArrayBuffer = await audioResponse.arrayBuffer();
      console.log('[upload] arrayBuffer byteLength:', audioArrayBuffer.byteLength);
      console.log('[upload] uploading to storage bucket audio-files...');
      const { error: audioError } = await supabase.storage
        .from('audio-files')
        .upload(audioFileName, audioArrayBuffer, { contentType: `audio/${audioExt}` });
      if (audioError) { Alert.alert('Audio upload failed', audioError.message); return; }
      console.log('[upload] audio uploaded successfully');
      const { data: audioUrlData } = supabase.storage.from('audio-files').getPublicUrl(audioFileName);

      // Upload thumbnail if provided
      let thumbnailUrl: string | null = null;
      if (data.thumbnailUri && data.thumbnailBase64) {
        const thumbExt = data.thumbnailUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const thumbFileName = `${session.user.id}-${Date.now()}-thumb.${thumbExt}`;
        const thumbArrayBuffer = decode(data.thumbnailBase64);
        const { error: thumbError } = await supabase.storage
          .from('audio-thumbnails')
          .upload(thumbFileName, thumbArrayBuffer, { contentType: `image/${thumbExt}` });
        if (thumbError) console.warn('[upload] thumbnail upload failed:', thumbError.message);
        else {
          const { data: thumbUrlData } = supabase.storage.from('audio-thumbnails').getPublicUrl(thumbFileName);
          thumbnailUrl = thumbUrlData.publicUrl;
        }
      }

      // Insert audio_files row
      console.log('[upload] inserting audio_files row, channel_id:', channelId);
      const { data: audioFile, error: insertError } = await supabase
        .from('audio_files')
        .insert({
          title: data.title,
          cover_photo: thumbnailUrl,
          uploaded_by: session.user.id,
          audio_file: audioUrlData.publicUrl,
          release_at: data.releaseDate?.toISOString() ?? null,
          genre: channelGenre,
          num_of_plays: 0,
          duration_seconds: data.durationSeconds,
          channel_id: channelId,
        } as any)
        .select('audio_id')
        .single();
      if (insertError || !audioFile) {
        Alert.alert('Save failed', insertError?.message ?? 'Unknown error');
        console.error('[upload] insert error:', insertError);
        return;
      }
      console.log('[upload] row inserted, audio_id:', (audioFile as any).audio_id);

      // Append to user's uploads array
      const { data: userData } = await supabase
        .from('users')
        .select('uploads')
        .eq('user_id', session.user.id)
        .single();
      const updatedUploads = [...((userData?.uploads as string[]) ?? []), (audioFile as any).audio_id];
      await supabase.from('users').update({ uploads: updatedUploads }).eq('user_id', session.user.id);

      // Prepend to local list
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setUploads((prev) => [{
        id: (audioFile as any).audio_id,
        title: data.title,
        date: dateStr,
        duration: data.durationSeconds,
        plays: 0,
        coverPhoto: thumbnailUrl,
        audioUrl: audioUrlData.publicUrl,
        isScheduled: !!data.releaseDate && data.releaseDate > new Date(),
      }, ...prev]);
      console.log('[upload] done');
    } catch (e: any) {
      console.error('[upload] caught error:', e);
      Alert.alert('Error', e.message ?? 'Something went wrong');
    }
  };

  const saveCreateChannel = async (
    { name, genre, coverPhotoUri, coverPhotoBase64 }: { name: string; genre: string; coverPhotoUri?: string; coverPhotoBase64?: string },
    onDone?: () => void,
  ) => {
    if (!session) return;
    let coverUrl: string | null = null;
    if (coverPhotoUri && coverPhotoBase64) {
      const ext = coverPhotoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${session.user.id}-${Date.now()}.${ext}`;
      const arrayBuffer = decode(coverPhotoBase64);
      const { error: uploadError } = await supabase.storage
        .from('channel-covers')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}` });
      if (uploadError) { Alert.alert('Upload failed', uploadError.message); return; }
      const { data: urlData } = supabase.storage.from('channel-covers').getPublicUrl(fileName);
      coverUrl = urlData.publicUrl;
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
    const updated = [...((userData as any)?.channels ?? []), (channel as any).channel_id];
    await supabase.from('users').update({ channels: updated } as any).eq('user_id', session.user.id);
    setChannelId((channel as any).channel_id);
    setChannelName(name);
    setChannelCover(coverUrl);
    setChannelGenre(genre);
    setHasChannels(true);
    setChannelRefreshTrigger((n) => n + 1);
    onDone?.();
  };

  if (!isLoggedIn) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: bg }}>
        <Text style={{ fontSize: 64 }}>🎙️</Text>
        <Text className="text-[22px] font-bold text-text-primary mt-4 mb-2">Become a Creator</Text>
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
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: bg }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (hasChannels === false) {
    return (
      <>
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: bg }}>
          <Ionicons name="radio-outline" size={64} color={Colors.primary} />
          <Text className="text-[20px] font-bold text-text-primary mt-4 mb-2 text-center">No channels yet</Text>
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
          onSave={(data) => saveCreateChannel(data, () => setCreateChannelVisible(false))}
        />
      </>
    );
  }

  const deleteUpload = (id: string) => {
    Alert.alert('Delete Audio?', 'This clip will be permanently removed from your channel.', [
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
        className="flex-1"
        style={{ backgroundColor: bg }}
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
              onPress={() => setChannelSettingsVisible(true)}
              className="mx-4 mb-4 flex-row items-center justify-center gap-2 rounded-full py-3"
              style={{ backgroundColor: Colors.primary }}
            >
              <Ionicons name="settings-outline" size={16} color={Colors.textPrimary} />
              <Text className="font-semibold text-[15px] text-text-primary">Channel Settings</Text>
            </TouchableOpacity>

            <Text className="text-[12px] font-semibold text-text-secondary tracking-wider px-4 mb-2">
              YOUR UPLOADS
            </Text>
            {uploadsLoading && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />}
          </View>
        }
        ListEmptyComponent={
          !uploadsLoading ? (
            <Text className="text-text-secondary text-[14px] text-center mt-4 px-6">
              No uploads yet. Hit Record to get started!
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <AudioListRow
            id={item.id}
            title={item.title}
            channelName={channelName}
            channelId={channelId ?? 'my-channel'}
            date={item.date}
            duration={item.duration}
            imageUrl={item.coverPhoto ?? undefined}
            isPlaying={playingId === item.id}
            isScheduled={item.isScheduled}
            onPress={() => handleRowPress(item)}
            onDelete={() => deleteUpload(item.id)}
          />
        )}
      />

      <RecordSheet
        visible={recordVisible}
        onClose={() => setRecordVisible(false)}
        onSave={saveRecording}
      />

      <MyChannelsSheet
        visible={myChannelsVisible}
        onClose={() => setMyChannelsVisible(false)}
        onAddNew={() => {
          setMyChannelsVisible(false);
          setCreateChannelVisible(true);
        }}
        onSelect={(ch) => {
          setChannelId((ch as any).channel_id);
          setChannelName(ch.name);
          setChannelCover(ch.cover_photo);
          setChannelGenre((ch as any).genre ?? '');
        }}
        refreshTrigger={channelRefreshTrigger}
      />

      <CreateChannelSheet
        visible={createChannelVisible}
        onClose={() => setCreateChannelVisible(false)}
        onSave={(data) => saveCreateChannel(data, () => setCreateChannelVisible(false))}
      />

      {channelId && (
        <ChannelSettingsSheet
          visible={channelSettingsVisible}
          onClose={() => setChannelSettingsVisible(false)}
          channelId={channelId}
          currentCoverUrl={channelCover}
          listeningOrder={channelListeningOrder}
          onCoverUpdated={(newUrl) => {
            setChannelCover(newUrl);
            setChannelSettingsVisible(false);
          }}
          onOrderChanged={setChannelListeningOrder}
        />
      )}
    </>
  );
}
