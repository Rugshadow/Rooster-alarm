import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type ListeningOrder = 'newest' | 'oldest';

type Props = {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  currentCoverUrl: string | null;
  listeningOrder: ListeningOrder;
  onCoverUpdated: (newUrl: string) => void;
  onOrderChanged: (order: ListeningOrder) => void;
};

export default function ChannelSettingsSheet({
  visible,
  onClose,
  channelId,
  currentCoverUrl,
  listeningOrder,
  onCoverUpdated,
  onOrderChanged,
}: Props) {
  const { session } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [order, setOrder] = useState<ListeningOrder>(listeningOrder);

  const handleOrderChange = async (newOrder: ListeningOrder) => {
    setOrder(newOrder);
    onOrderChanged(newOrder);
    await supabase
      .from('channels')
      .update({ listening_order: newOrder } as any)
      .eq('channel_id', channelId);
  };

  const pickAndUploadCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !session) return;

    const asset = result.assets[0];
    if (!asset.base64) return;

    setUploading(true);
    try {
      // Delete old cover from storage if it exists
      if (currentCoverUrl) {
        const oldPath = currentCoverUrl.split('/channel-covers/')[1];
        if (oldPath) {
          await supabase.storage.from('channel-covers').remove([oldPath]);
        }
      }

      // Upload new cover
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const fileName = `${session.user.id}-${Date.now()}.${ext}`;
      const arrayBuffer = decode(asset.base64);
      const { error: uploadError } = await supabase.storage
        .from('channel-covers')
        .upload(fileName, arrayBuffer, { contentType: `image/${ext}` });

      if (uploadError) {
        Alert.alert('Upload failed', uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage.from('channel-covers').getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;

      // Update channel row
      await supabase
        .from('channels')
        .update({ cover_photo: newUrl } as any)
        .eq('channel_id', channelId);

      onCoverUpdated(newUrl);
      Alert.alert('Done', 'Cover photo updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              Channel Settings
            </Text>
          </View>
        </SafeAreaView>

        <View className="flex-1 px-6 pt-8">
          {/* Current cover preview */}
          <View className="items-center mb-8">
            {currentCoverUrl ? (
              <Image
                source={{ uri: currentCoverUrl }}
                style={{ width: 160, height: 160, borderRadius: 12 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{ width: 160, height: 160, borderRadius: 12, backgroundColor: Colors.primaryLight }}
                className="items-center justify-center"
              >
                <Ionicons name="radio-outline" size={48} color={Colors.primary} />
              </View>
            )}
          </View>

          {/* Upload button */}
          <TouchableOpacity
            onPress={pickAndUploadCover}
            disabled={uploading}
            className="flex-row items-center justify-center gap-2 rounded-2xl py-4"
            style={{ backgroundColor: Colors.primary, opacity: uploading ? 0.6 : 1 }}
          >
            {uploading ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <>
                <Ionicons name="image-outline" size={20} color={Colors.textPrimary} />
                <Text className="font-semibold text-[15px] text-text-primary">
                  Upload New Cover Photo
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Listening order */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-8 mb-3">
            LISTENING ORDER
          </Text>
          <View className="bg-surface rounded-2xl p-1 flex-row">
            {(['newest', 'oldest'] as ListeningOrder[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => handleOrderChange(mode)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{ backgroundColor: order === mode ? Colors.primary : 'transparent' }}
              >
                <Text
                  className="font-semibold text-[14px]"
                  style={{ color: order === mode ? Colors.textPrimary : Colors.textSecondary }}
                >
                  {mode === 'newest' ? 'Newest First' : 'Oldest First'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text className="text-text-secondary text-[13px] mt-3 leading-5">
            Choose whether daily listeners receive your newest content first (better for news, comedy), or start from the beginning (better for stories, music).
          </Text>
        </View>

        <View style={{ backgroundColor: Colors.primary, paddingBottom: 24 }}>
          <TouchableOpacity
            onPress={onClose}
            className="flex-row items-center justify-center gap-1 py-4"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
