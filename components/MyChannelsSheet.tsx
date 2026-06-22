import React, { useEffect, useState } from 'react';
import {
  View,
  Modal,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Text } from './Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset } from '../hooks/useTopInset';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

type Channel = {
  channel_id: string;
  name: string;
  cover_photo: string | null;
  genre: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddNew: () => void;
  onSelect: (channel: Channel) => void;
  refreshTrigger?: number;
};

export default function MyChannelsSheet({ visible, onClose, onAddNew, onSelect, refreshTrigger }: Props) {
  const { session } = useAuth();
  const { t } = useTranslation();
  const topPad = useTopInset();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && session) fetchChannels();
  }, [visible, refreshTrigger]);

  const fetchChannels = async () => {
    setLoading(true);
    const { data: userData } = await supabase
      .from('users')
      .select('channels')
      .eq('user_id', session!.user.id)
      .single();

    const channelIds: string[] = userData?.channels ?? [];
    if (channelIds.length === 0) { setChannels([]); setLoading(false); return; }

    const { data } = await supabase
      .from('channels')
      .select('channel_id, name, cover_photo, genre, bio')
      .in('channel_id', channelIds);

    setChannels(data ?? []);
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <SafeAreaView edges={[]} style={{ backgroundColor: Colors.primary, paddingTop: topPad }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              {t('my_channels.title')}
            </Text>
          </View>
        </SafeAreaView>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : channels.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-text-secondary text-[15px] text-center">{t('my_channels.no_channels')}</Text>
          </View>
        ) : (
          <FlatList
            data={channels}
            keyExtractor={(item) => item.channel_id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { onSelect(item); onClose(); }}
                className="flex-row items-center gap-4 bg-surface rounded-2xl overflow-hidden"
              >
                {item.cover_photo ? (
                  <Image
                    source={{ uri: item.cover_photo }}
                    style={{ width: 72, height: 72 }}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={{ width: 72, height: 72, backgroundColor: Colors.primaryLight }} className="items-center justify-center">
                    <Ionicons name="radio-outline" size={28} color={Colors.primary} />
                  </View>
                )}
                <View className="flex-1 pr-4">
                  <Text className="text-[16px] font-semibold text-text-primary">{item.name}</Text>
                  <Text className="text-text-secondary text-[13px] mt-0.5 capitalize">{item.genre}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} style={{ marginRight: 16 }} />
              </TouchableOpacity>
            )}
          />
        )}

        <View className="px-4 py-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={onAddNew}
            className="rounded-full py-3 items-center"
            style={{ backgroundColor: Colors.primary }}
          >
            <Text className="font-bold text-[15px] text-text-primary">{t('my_channels.add_new')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: Colors.primary }}>
          <TouchableOpacity
            onPress={onClose}
            className="flex-row items-center justify-center gap-1 py-4"
            style={{ paddingBottom: 24 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
