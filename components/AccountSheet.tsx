import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AccountSheet({ visible, onClose }: Props) {
  const { signOut, username, session, timeFormat, setTimeFormat, colorScheme, setColorScheme } = useAuth();
  const { bg, surface, text, textSecondary } = useTheme();
  const [uploadCount, setUploadCount] = useState(0);
  const [alarmCount, setAlarmCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible && session) fetchStats();
  }, [visible]);

  const fetchStats = async () => {
    const { data } = await supabase
      .from('users')
      .select('uploads, set_alarms, favorite_channels')
      .eq('user_id', session!.user.id)
      .single();
    if (data) {
      setUploadCount((data.uploads as string[] | null)?.length ?? 0);
      setAlarmCount(Object.keys((data.set_alarms as object | null) ?? {}).length);
      setSavedCount((data.favorite_channels as string[] | null)?.length ?? 0);
    }
  };

  const extractStoragePath = (url: string, bucket: string) => {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : null;
  };

  const performDeleteAccount = async () => {
    if (!session) return;
    setDeleting(true);
    const userId = session.user.id;
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('channels')
        .eq('user_id', userId)
        .single();

      const channelIds: string[] = (userData as any)?.channels ?? [];

      const [audioResult, channelResult] = await Promise.all([
        channelIds.length > 0
          ? supabase.from('audio_files').select('audio_file, cover_photo').in('channel_id', channelIds)
          : Promise.resolve({ data: [] }),
        channelIds.length > 0
          ? supabase.from('channels').select('cover_photo').in('channel_id', channelIds)
          : Promise.resolve({ data: [] }),
      ]);

      const audioFiles = audioResult.data ?? [];
      const channels = channelResult.data ?? [];

      const audioPaths = audioFiles
        .map((f: any) => f.audio_file ? extractStoragePath(f.audio_file, 'audio-files') : null)
        .filter(Boolean) as string[];
      const thumbPaths = audioFiles
        .map((f: any) => f.cover_photo ? extractStoragePath(f.cover_photo, 'audio-thumbnails') : null)
        .filter(Boolean) as string[];
      const coverPaths = channels
        .map((c: any) => c.cover_photo ? extractStoragePath(c.cover_photo, 'channel-covers') : null)
        .filter(Boolean) as string[];

      await Promise.all([
        audioPaths.length > 0 ? supabase.storage.from('audio-files').remove(audioPaths) : Promise.resolve(),
        thumbPaths.length > 0 ? supabase.storage.from('audio-thumbnails').remove(thumbPaths) : Promise.resolve(),
        coverPaths.length > 0 ? supabase.storage.from('channel-covers').remove(coverPaths) : Promise.resolve(),
      ]);

      if (channelIds.length > 0) {
        await supabase.from('audio_files').delete().in('channel_id', channelIds);
        await supabase.from('channels').delete().in('channel_id', channelIds);
      }

      await supabase.from('users').delete().eq('user_id', userId);
      await supabase.rpc('delete_own_account');

      signOut();
      onClose();
    } catch (e: any) {
      setDeleting(false);
      Alert.alert('Error', e.message ?? 'Failed to delete account. Please try again.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all channels, and all uploaded audio. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDeleteAccount },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              {username ?? 'Account'}
            </Text>
          </View>
        </SafeAreaView>

        <View className="flex-1 px-4 pt-4">
          <View className="flex-row mt-0 rounded-2xl overflow-hidden" style={{ backgroundColor: surface }}>
            {[
              { label: 'Uploads', value: uploadCount },
              { label: 'Alarms', value: alarmCount },
              { label: 'Favorites', value: savedCount },
            ].map(({ label, value }, i) => (
              <View
                key={label}
                className={`flex-1 items-center py-4 ${i < 2 ? 'border-r border-gray-200' : ''}`}
              >
                <Text className="text-[20px] font-bold" style={{ color: text }}>{value}</Text>
                <Text className="text-[13px] mt-0.5" style={{ color: textSecondary }}>{label}</Text>
              </View>
            ))}
          </View>

          <Text className="text-[12px] font-semibold tracking-wider mt-6 mb-3" style={{ color: textSecondary }}>
            SETTINGS
          </Text>

          <View className="rounded-2xl p-1 flex-row mb-4" style={{ backgroundColor: surface }}>
            {(['standard', 'military'] as const).map((fmt) => (
              <TouchableOpacity
                key={fmt}
                onPress={() => setTimeFormat(fmt)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: timeFormat === fmt ? bg : 'transparent',
                  shadowColor: timeFormat === fmt ? '#000' : 'transparent',
                  shadowOpacity: timeFormat === fmt ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: timeFormat === fmt ? 2 : 0,
                }}
              >
                <Text
                  className="font-medium text-[15px]"
                  style={{ color: timeFormat === fmt ? text : textSecondary }}
                >
                  {fmt === 'standard' ? 'Standard' : 'Military'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="rounded-2xl p-1 flex-row mt-4 mb-6" style={{ backgroundColor: surface }}>
            {(['light', 'dark'] as const).map((scheme) => (
              <TouchableOpacity
                key={scheme}
                onPress={() => setColorScheme(scheme)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: colorScheme === scheme ? bg : 'transparent',
                  shadowColor: colorScheme === scheme ? '#000' : 'transparent',
                  shadowOpacity: colorScheme === scheme ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: colorScheme === scheme ? 2 : 0,
                }}
              >
                <Text
                  className="font-medium text-[15px]"
                  style={{ color: colorScheme === scheme ? text : textSecondary }}
                >
                  {scheme === 'light' ? 'Light' : 'Dark'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => { signOut(); onClose(); }}
            className="rounded-full py-3.5 items-center mb-3"
            style={{ backgroundColor: surface }}
          >
            <Text className="font-semibold text-[15px]" style={{ color: text }}>Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={deleting}
            className="rounded-full py-3.5 items-center"
            style={{ backgroundColor: colorScheme === 'dark' ? '#4A1010' : Colors.destructiveLight }}
          >
            {deleting
              ? <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#FF6B6B' : Colors.destructive} />
              : <Text className="font-semibold text-[15px]" style={{ color: colorScheme === 'dark' ? '#FF6B6B' : Colors.destructive }}>Delete Account</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: Colors.primary }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
