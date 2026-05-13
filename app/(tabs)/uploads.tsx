import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, Modal } from 'react-native';
import AppAlert from '../../components/AppAlert';
import { useAppAlert } from '../../hooks/useAppAlert';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { decode } from 'base64-arraybuffer';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../lib/supabase';
import AudioListRow from '../../components/AudioListRow';
import RecordSheet from '../../components/RecordSheet';
import CreateChannelSheet from '../../components/CreateChannelSheet';
import MyChannelsSheet from '../../components/MyChannelsSheet';
import ChannelSettingsSheet from '../../components/ChannelSettingsSheet';
import AlarmRingingModal from '../../components/AlarmRingingModal';
import { useTheme } from '../../hooks/useTheme';

type Upload = {
  id: string;
  title: string;
  date: string;
  duration: number;
  plays: number;
  coverPhoto?: string | null;
  audioUrl?: string;
  releaseDate?: Date;
  createdAt?: Date;
  uploading?: boolean;
};

export default function UploadsScreen() {
  const { isLoggedIn, session, language } = useAuth();
  const { bg, surface, text, textSecondary } = useTheme();
  const { t } = useTranslation();
  const { showAlert, alertProps } = useAppAlert();
  const router = useRouter();
  const [recordVisible, setRecordVisible] = useState(false);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewClip, setPreviewClip] = useState<{ audioUrl: string; duration: number; title: string; audioId: string } | null>(null);
  const [hasChannels, setHasChannels] = useState<boolean | null>(null);
  const [createChannelVisible, setCreateChannelVisible] = useState(false);
  const [myChannelsVisible, setMyChannelsVisible] = useState(false);
  const [channelRefreshTrigger, setChannelRefreshTrigger] = useState(0);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string>('Your Channel');
  const [channelCover, setChannelCover] = useState<string | null>(null);
  const [channelGenre, setChannelGenre] = useState<string>('');
  const [channelBio, setChannelBio] = useState<string>('');
  const [channelListeningOrder, setChannelListeningOrder] = useState<'newest' | 'oldest'>('newest');
  const [channelListeners, setChannelListeners] = useState(0);
  const [channelSettingsVisible, setChannelSettingsVisible] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [wavPending, setWavPending] = useState<{ uri: string; duration: number } | null>(null);
  const [wavLoading, setWavLoading] = useState(false);
  const [editingUpload, setEditingUpload] = useState<Upload | null>(null);
  const player = useAudioPlayer(playingUrl ? { uri: playingUrl } : null);
  const playerStatus = useAudioPlayerStatus(player);

  const playingUrlRef = useRef<string | null>(null);
  const playerRef = useRef(player);
  useEffect(() => { playingUrlRef.current = playingUrl; }, [playingUrl]);
  useEffect(() => { playerRef.current = player; }, [player]);

  const stopAudio = useCallback(() => {
    if (playingUrlRef.current) {
      try { playerRef.current.pause(); } catch {}
      setPlayingId(null);
      setPlayingUrl(null);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    return () => stopAudio();
  }, []));

  useEffect(() => {
    if (playingUrl) player.play();
  }, [playingUrl]);

  useEffect(() => {
    if (playerStatus.didJustFinish) setPlayingId(null);
  }, [playerStatus.didJustFinish]);

  const handleRowPress = (item: Upload) => {
    stopAudio();
    setPreviewClip({ audioUrl: item.audioUrl ?? '', duration: item.duration, title: item.title, audioId: item.id });
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

    const { data: channels } = await supabase
      .from('channels')
      .select('channel_id, name, cover_photo, genre, bio')
      .in('channel_id', channelIds);
    if (!channels || channels.length === 0) { setHasChannels(false); return; }

    const savedChannelId = await AsyncStorage.getItem('selected_channel_id');
    const preferred = (savedChannelId && channels.find((c: any) => c.channel_id === savedChannelId)) || channels[0];
    const preferredId = (preferred as any).channel_id;

    setChannelId(preferredId);
    setChannelName((preferred as any).name);
    setChannelCover((preferred as any).cover_photo ?? null);
    setChannelGenre((preferred as any).genre ?? '');
    setChannelBio((preferred as any).bio ?? '');
    setHasChannels(true);

    // Fetch extra fields separately so a missing column never breaks the main load
    const { data: extra } = await supabase
      .from('channels')
      .select('listening_order, listeners')
      .eq('channel_id', preferredId)
      .maybeSingle();
    if (extra) {
      setChannelListeningOrder((extra as any).listening_order ?? 'newest');
      setChannelListeners((extra as any).listeners ?? 0);
    }
  };

  const sortUploads = (list: Upload[]) => {
    const now = new Date();
    return [...list].sort((a, b) => {
      const aScheduled = !!a.releaseDate && a.releaseDate > now;
      const bScheduled = !!b.releaseDate && b.releaseDate > now;
      if (aScheduled !== bScheduled) return aScheduled ? -1 : 1;
      if (aScheduled && bScheduled) return a.releaseDate!.getTime() - b.releaseDate!.getTime();
      return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
    });
  };

  const fetchUploads = async (chId: string) => {
    setUploadsLoading(true);
    const { data } = await supabase
      .from('audio_files')
      .select('audio_id, title, created_at, duration_seconds, num_of_plays, release_at, cover_photo, audio_file')
      .eq('channel_id', chId)
      .order('created_at', { ascending: false });
    if (data) {
      const now = new Date();
      const mapped = data.map((row: any) => ({
        id: row.audio_id,
        title: row.title,
        date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        duration: row.duration_seconds ?? 0,
        plays: row.num_of_plays ?? 0,
        coverPhoto: row.cover_photo ?? null,
        audioUrl: row.audio_file ?? undefined,
        releaseDate: row.release_at ? new Date(row.release_at) : undefined,
        createdAt: new Date(row.created_at),
      }));
      setUploads(sortUploads(mapped));
    }
    setUploadsLoading(false);
  };

  const getWavDuration = async (uri: string, fileSize: number): Promise<number> => {
    try {
      if (fileSize <= 44) return 0;
      const response = await fetch(uri);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 32) return 0;
      const view = new DataView(buffer);
      const byteRate = view.getUint32(28, true);
      const computed = byteRate > 0 ? Math.round((fileSize - 44) / byteRate) : 0;
      console.log('[wav] fileSize:', fileSize, 'byteRate:', byteRate, 'computed:', computed, 's');
      return computed;
    } catch (e) {
      console.error('[wav] getWavDuration error:', e);
      return 0;
    }
  };

  const handleWavUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/wav', 'audio/x-wav', 'audio/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const ext = (asset.name ?? asset.uri).split('.').pop()?.toLowerCase();
    if (ext !== 'wav') {
      showAlert(t('uploads.invalid_file'), t('uploads.must_be_wav'));
      return;
    }
    if ((asset.size ?? 0) > 60 * 1024 * 1024) {
      showAlert(t('uploads.file_too_long'), t('uploads.too_long_msg'));
      return;
    }
    setWavLoading(true);
    const duration = await getWavDuration(asset.uri, asset.size ?? 0);
    setWavLoading(false);
    console.log('[wav] parsed duration:', duration, 'seconds');
    if (duration < 60) {
      showAlert(t('uploads.file_too_short'), t('uploads.too_short_msg'));
      return;
    }
    if (duration > 300) {
      showAlert(t('uploads.file_too_long'), t('uploads.too_long_msg'));
      return;
    }
    setWavPending({ uri: asset.uri, duration });
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
    const placeholderId = `uploading-${Date.now()}`;
    setUploads((prev) => [{
      id: placeholderId,
      title: data.title,
      date: '',
      duration: data.durationSeconds,
      plays: 0,
      uploading: true,
    }, ...prev]);
    try {
      // Upload audio file — stream via XHR FormData to avoid loading large files into JS heap
      const audioExt = data.uri.split('.').pop()?.toLowerCase() ?? 'm4a';
      const audioFileName = `${session.user.id}-${Date.now()}.${audioExt}`;
      console.log('[upload] streaming audio to storage:', audioFileName);
      const audioOk = await new Promise<boolean>((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', { uri: data.uri, name: audioFileName, type: `audio/${audioExt}` } as any);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/audio-files/${audioFileName}`);
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(true);
          else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error('Network error during audio upload'));
        xhr.send(formData);
      });
      if (!audioOk) return;
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
          language,
          num_of_plays: 0,
          duration_seconds: data.durationSeconds,
          channel_id: channelId,
        } as any)
        .select('audio_id')
        .single();
      if (insertError || !audioFile) {
        showAlert(t('uploads.save_failed'), insertError?.message ?? t('common.error'));
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

      // Update channel's language array
      if (language) {
        const { data: chData } = await supabase
          .from('channels')
          .select('language')
          .eq('channel_id', channelId)
          .maybeSingle();
        const currentLangs: string[] = (chData as any)?.language ?? [];
        if (!currentLangs.includes(language)) {
          await supabase
            .from('channels')
            .update({ language: [...currentLangs, language] } as any)
            .eq('channel_id', channelId);
        }
      }

      // Replace placeholder with the real item, then re-sort so release order is preserved
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setUploads((prev) => sortUploads(prev.map((u) => u.id === placeholderId ? {
        id: (audioFile as any).audio_id,
        title: data.title,
        date: dateStr,
        duration: data.durationSeconds,
        plays: 0,
        coverPhoto: thumbnailUrl,
        audioUrl: audioUrlData.publicUrl,
        releaseDate: data.releaseDate,
        createdAt: new Date(),
      } : u)));
      console.log('[upload] done');
    } catch (e: any) {
      console.error('[upload] caught error:', e);
      setUploads((prev) => prev.filter((u) => u.id !== placeholderId));
      showAlert(t('common.error'), e.message ?? t('common.something_went_wrong'));
    }
  };

  const saveEdit = async (
    uploadId: string,
    data: { uri: string; title: string; thumbnailUri?: string; thumbnailBase64?: string; releaseDate?: Date; durationSeconds: number },
  ) => {
    if (!session) return;
    try {
      const isNewAudio = !data.uri.startsWith('http');
      let audioUrl: string | undefined;
      let durationSeconds = data.durationSeconds;

      if (isNewAudio) {
        const audioExt = data.uri.split('.').pop()?.toLowerCase() ?? 'm4a';
        const audioFileName = `${session.user.id}-${Date.now()}.${audioExt}`;
        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', { uri: data.uri, name: audioFileName, type: `audio/${audioExt}` } as any);
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/audio-files/${audioFileName}`);
          xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
          xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(formData);
        });
        const { data: urlData } = supabase.storage.from('audio-files').getPublicUrl(audioFileName);
        audioUrl = urlData.publicUrl;
      }

      let thumbnailUrl: string | null | undefined;
      if (data.thumbnailBase64 && data.thumbnailUri) {
        const thumbExt = data.thumbnailUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const thumbFileName = `${session.user.id}-${Date.now()}-thumb.${thumbExt}`;
        const thumbArrayBuffer = decode(data.thumbnailBase64);
        const { error: thumbError } = await supabase.storage
          .from('audio-thumbnails')
          .upload(thumbFileName, thumbArrayBuffer, { contentType: `image/${thumbExt}` });
        if (!thumbError) {
          const { data: thumbUrlData } = supabase.storage.from('audio-thumbnails').getPublicUrl(thumbFileName);
          thumbnailUrl = thumbUrlData.publicUrl;
        }
      }

      const updates: Record<string, any> = {
        title: data.title,
        release_at: data.releaseDate?.toISOString() ?? null,
      };
      if (audioUrl) { updates.audio_file = audioUrl; updates.duration_seconds = durationSeconds; }
      if (thumbnailUrl !== undefined) updates.cover_photo = thumbnailUrl;

      const { error } = await supabase.from('audio_files').update(updates).eq('audio_id', uploadId);
      if (error) { showAlert(t('uploads.save_failed'), error.message); return; }

      setUploads((prev) => prev.map((u) => u.id === uploadId ? {
        ...u,
        title: data.title,
        releaseDate: data.releaseDate,
        audioUrl: audioUrl ?? u.audioUrl,
        duration: isNewAudio ? durationSeconds : u.duration,
        coverPhoto: thumbnailUrl !== undefined ? thumbnailUrl : u.coverPhoto,
      } : u));
    } catch (e: any) {
      showAlert(t('common.error'), e.message ?? t('common.something_went_wrong'));
    }
  };

  const saveCreateChannel = async (
    { name, genre, description, coverPhotoUri, coverPhotoBase64 }: { name: string; genre: string; description: string; coverPhotoUri?: string; coverPhotoBase64?: string },
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
      if (uploadError) { showAlert('Upload failed', uploadError.message); return; }
      const { data: urlData } = supabase.storage.from('channel-covers').getPublicUrl(fileName);
      coverUrl = urlData.publicUrl;
    }
    const { data: channel, error } = await supabase
      .from('channels')
      .insert({ owner_id: session.user.id, name, genre, bio: description || null, cover_photo: coverUrl })
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
        <Ionicons name="mic" size={64} color="#DFFF00" />
        <Text className="text-[22px] font-bold text-text-primary mt-4 mb-2">{t('uploads.become_creator')}</Text>
        <Text className="text-text-secondary text-[15px] text-center mb-8">
          {t('uploads.creator_subtitle')}
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/auth/login')}
          className="rounded-full px-8 py-3.5"
          style={{ backgroundColor: Colors.primary }}
        >
          <Text className="font-bold text-[16px] text-text-primary">{t('uploads.log_in_to_upload')}</Text>
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
        <AppAlert {...alertProps} />
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: bg }}>
          <Ionicons name="radio-outline" size={64} color={Colors.primary} />
          <Text className="text-[20px] font-bold mt-4 mb-2 text-center" style={{ color: text }}>{t('uploads.no_channels')}</Text>
          <Text className="text-[15px] text-center mb-8" style={{ color: textSecondary }}>
            {t('uploads.no_channels_subtitle')}
          </Text>
          <TouchableOpacity
            onPress={() => { stopAudio(); setCreateChannelVisible(true); }}
            className="rounded-full px-8 py-3.5"
            style={{ backgroundColor: Colors.primary }}
          >
            <Text className="font-bold text-[16px] text-text-primary">{t('uploads.create_channel_button')}</Text>
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
    showAlert('Delete Audio?', 'This clip will be permanently removed from your channel.', [
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
      <AppAlert {...alertProps} />
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
                onPress={() => { stopAudio(); setMyChannelsVisible(true); }}
                className="flex-row items-center gap-1 mt-4 rounded-full px-4 py-2"
                style={{ backgroundColor: Colors.primary }}
              >
                <Text className="text-[16px] font-bold text-text-primary">{channelName}</Text>
                <Ionicons name="chevron-down" size={16} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text className="text-text-secondary text-[13px] mt-1">
                {t('uploads.upload', { count: uploads.length })} · {t('uploads.listener', { count: channelListeners })} · {channelGenre}
              </Text>
            </View>

            {!!channelBio && (
              <Text className="text-text-secondary text-[14px] text-center px-6 mb-4">
                {channelBio}
              </Text>
            )}

            <View className="flex-row gap-3 px-4 mb-4">
              <TouchableOpacity
                onPress={() => { stopAudio(); setRecordVisible(true); }}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3"
                style={{ backgroundColor: '#FF3B30' }}
              >
                <Ionicons name="mic" size={18} color="white" />
                <Text className="font-semibold text-[15px]" style={{ color: 'white' }}>{t('uploads.record')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleWavUpload}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full py-3"
                style={{ backgroundColor: Colors.primary }}
              >
                <Ionicons name="cloud-upload" size={18} color={Colors.textPrimary} />
                <Text className="font-semibold text-[15px] text-text-primary">{t('uploads.upload_wav')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => { stopAudio(); setChannelSettingsVisible(true); }}
              className="mx-4 mb-4 flex-row items-center justify-center gap-2 rounded-full py-3"
              style={{ backgroundColor: Colors.primary }}
            >
              <Ionicons name="settings-outline" size={16} color={Colors.textPrimary} />
              <Text className="font-semibold text-[15px] text-text-primary">{t('uploads.channel_settings')}</Text>
            </TouchableOpacity>

            <Text className="text-[12px] font-semibold text-text-secondary tracking-wider px-4 mb-2">
              {t('uploads.your_uploads')}
            </Text>
            {uploadsLoading && <ActivityIndicator color={Colors.primary} style={{ marginVertical: 16 }} />}
          </View>
        }
        ListEmptyComponent={
          !uploadsLoading ? (
            <Text className="text-text-secondary text-[14px] text-center mt-4 px-6">
              {t('uploads.no_uploads')}
            </Text>
          ) : null
        }
        renderItem={({ item }) => item.uploading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: surface, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: text, fontSize: 15, fontWeight: '600' }}>{item.title}</Text>
              <Text style={{ color: textSecondary, fontSize: 13, marginTop: 2 }}>{t('uploads.uploading')}</Text>
            </View>
          </View>
        ) : (
          <AudioListRow
            id={item.id}
            title={item.title}
            channelName={channelName}
            channelId={channelId ?? 'my-channel'}
            date={item.date}
            duration={item.duration}
            imageUrl={item.coverPhoto ?? undefined}
            isPlaying={playingId === item.id}
            releaseDate={item.releaseDate}
            onPress={() => handleRowPress(item)}
            onEdit={() => { stopAudio(); setEditingUpload(item); setRecordVisible(true); }}
            onDelete={() => deleteUpload(item.id)}
          />
        )}
      />

      <RecordSheet
        visible={recordVisible || !!wavPending}
        onClose={() => { setRecordVisible(false); setEditingUpload(null); setWavPending(null); }}
        scheduledDates={uploads.filter(u => u.releaseDate && u.releaseDate > new Date()).map(u => ({ date: u.releaseDate!, title: u.title }))}
        editAudio={editingUpload ? {
          url: editingUpload.audioUrl ?? '',
          duration: editingUpload.duration,
          title: editingUpload.title,
          thumbnailUri: editingUpload.coverPhoto ?? undefined,
          releaseDate: editingUpload.releaseDate,
        } : wavPending ? {
          url: wavPending.uri,
          duration: wavPending.duration,
          title: '',
        } : undefined}
        onSave={(data) => {
          if (editingUpload) {
            saveEdit(editingUpload.id, data);
            setEditingUpload(null);
          } else {
            saveRecording(data);
            setWavPending(null);
          }
        }}
      />

      <MyChannelsSheet
        visible={myChannelsVisible}
        onClose={() => setMyChannelsVisible(false)}
        onAddNew={() => {
          stopAudio();
          setMyChannelsVisible(false);
          setCreateChannelVisible(true);
        }}
        onSelect={(ch) => {
          const id = (ch as any).channel_id;
          setChannelId(id);
          setChannelName(ch.name);
          setChannelCover(ch.cover_photo);
          setChannelGenre((ch as any).genre ?? '');
          setChannelBio((ch as any).bio ?? '');
          AsyncStorage.setItem('selected_channel_id', id);
        }}
        refreshTrigger={channelRefreshTrigger}
      />

      <CreateChannelSheet
        visible={createChannelVisible}
        onClose={() => setCreateChannelVisible(false)}
        onSave={(data) => saveCreateChannel(data, () => setCreateChannelVisible(false))}
      />

      <Modal visible={wavLoading} transparent animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 32, alignItems: 'center', gap: 16, width: 220 }}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={{ color: Colors.textPrimary, fontSize: 15, fontWeight: '600' }}>{t('uploads.loading_audio')}</Text>
          </View>
        </View>
      </Modal>

      {previewClip && channelId && (
        <AlarmRingingModal
          visible={!!previewClip}
          channelId={channelId}
          channelName={channelName}
          channelImageUrl={channelCover ?? undefined}
          previewClip={previewClip}
          onDismiss={() => setPreviewClip(null)}
        />
      )}

      {channelId && (
        <ChannelSettingsSheet
          visible={channelSettingsVisible}
          onClose={() => setChannelSettingsVisible(false)}
          channelId={channelId}
          currentCoverUrl={channelCover}
          currentBio={channelBio}
          listeningOrder={channelListeningOrder}
          onCoverUpdated={(newUrl) => {
            setChannelCover(newUrl);
            setChannelSettingsVisible(false);
          }}
          onOrderChanged={setChannelListeningOrder}
          onBioUpdated={setChannelBio}
        />
      )}
    </>
  );
}
