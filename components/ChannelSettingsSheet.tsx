import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from 'react-native';
import AppAlert from './AppAlert';
import { useAppAlert } from '../hooks/useAppAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

type ListeningOrder = 'newest' | 'oldest';

const LANGUAGE_CODES = ['all', 'en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'bn', 'ru', 'pt', 'id', 'fil', 'vi'] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  channelId: string;
  currentCoverUrl: string | null;
  currentBio: string;
  listeningOrder: ListeningOrder;
  onCoverUpdated: (newUrl: string) => void;
  onOrderChanged: (order: ListeningOrder) => void;
  onBioUpdated: (bio: string) => void;
};

export default function ChannelSettingsSheet({
  visible,
  onClose,
  channelId,
  currentCoverUrl,
  currentBio,
  listeningOrder,
  onCoverUpdated,
  onOrderChanged,
  onBioUpdated,
}: Props) {
  const { session } = useAuth();
  const { bg, surface, text, textSecondary } = useTheme();
  const { showAlert, alertProps } = useAppAlert();
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [order, setOrder] = useState<ListeningOrder>(listeningOrder);
  const [bio, setBio] = useState(currentBio);
  const [savingBio, setSavingBio] = useState(false);
  const [channelLanguage, setChannelLanguage] = useState<string>('en');
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setOrder(listeningOrder);
      setBio(currentBio);
      fetchLanguage();
    }
  }, [visible, channelId]);

  const fetchLanguage = async () => {
    const { data } = await supabase
      .from('channels')
      .select('language')
      .eq('channel_id', channelId)
      .maybeSingle();
    const langs: string[] = (data as any)?.language ?? [];
    setChannelLanguage(langs[0] ?? 'en');
  };

  const handleLanguageChange = async (code: string) => {
    setChannelLanguage(code);
    setLanguagePickerVisible(false);
    await supabase
      .from('channels')
      .update({ language: [code] } as any)
      .eq('channel_id', channelId);
  };

  const handleOrderChange = async (newOrder: ListeningOrder) => {
    setOrder(newOrder);
    onOrderChanged(newOrder);
    const { error } = await supabase
      .from('channels')
      .update({ listening_order: newOrder } as any)
      .eq('channel_id', channelId);
    if (error) console.error('[ChannelSettingsSheet] listening_order update failed:', error.message, error.code);
    else console.log('[ChannelSettingsSheet] listening_order updated to:', newOrder);
  };

  const pickAndUploadCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
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
        showAlert('Upload failed', uploadError.message);
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
      showAlert('Done', 'Cover photo updated.');
    } catch (e: any) {
      showAlert('Error', e.message ?? 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const saveBio = async () => {
    setSavingBio(true);
    const { error } = await supabase
      .from('channels')
      .update({ bio } as any)
      .eq('channel_id', channelId);
    setSavingBio(false);
    if (error) showAlert('Error', error.message);
    else { onBioUpdated(bio); showAlert('Done', 'Description updated.'); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <AppAlert {...alertProps} />
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              {t('channel_settings.title')}
            </Text>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1 px-6 pt-8">
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
                  {t('channel_settings.upload_cover')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Channel description */}
          <Text style={{ color: textSecondary }} className="text-[12px] font-semibold tracking-wider mt-8 mb-2">
            {t('channel_settings.description_label')}
          </Text>
          <TextInput
            value={bio}
            onChangeText={(v) => setBio(v.slice(0, 150))}
            placeholder={t('channel_settings.description_placeholder')}
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
            maxLength={150}
            autoCapitalize="sentences"
            style={{
              backgroundColor: surface,
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 15,
              color: text,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
          />
          <View className="flex-row justify-between items-center mt-2 mb-2">
            <Text style={{ color: bio.length > 130 ? (bio.length >= 150 ? '#E53935' : '#F59E0B') : textSecondary }} className="text-[12px]">
              {bio.length}/150
            </Text>
            <TouchableOpacity
              onPress={saveBio}
              disabled={savingBio}
              className="rounded-full px-5 py-2"
              style={{ backgroundColor: Colors.primary, opacity: savingBio ? 0.6 : 1 }}
            >
              {savingBio
                ? <ActivityIndicator size="small" color={Colors.textPrimary} />
                : <Text className="font-semibold text-[14px] text-text-primary">{t('common.save')}</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Channel language */}
          <Text style={{ color: textSecondary }} className="text-[12px] font-semibold tracking-wider mt-6 mb-2">
            {t('channel_settings.language_label')}
          </Text>
          <TouchableOpacity
            onPress={() => setLanguagePickerVisible(true)}
            style={{ backgroundColor: surface, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: 15, color: text }}>{t(`languages.${channelLanguage}`)}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Listening order */}
          <Text style={{ color: textSecondary }} className="text-[12px] font-semibold tracking-wider mt-6 mb-3">
            {t('channel_settings.order_label')}
          </Text>
          <View style={{ backgroundColor: surface }} className="rounded-2xl p-1 flex-row">
            {(['newest', 'oldest'] as ListeningOrder[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => handleOrderChange(mode)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{ backgroundColor: order === mode ? Colors.primary : 'transparent' }}
              >
                <Text
                  className="font-semibold text-[14px]"
                  style={{ color: order === mode ? Colors.textPrimary : textSecondary }}
                >
                  {mode === 'newest' ? t('channel_settings.order_newest') : t('channel_settings.order_oldest')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={{ color: textSecondary }} className="text-[13px] mt-3 mb-8 leading-5">
            {t('channel_settings.order_explanation')}
          </Text>
        </ScrollView>

        <View style={{ backgroundColor: Colors.primary, height: 56 }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={languagePickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLanguagePickerVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['left', 'right']}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
            <View className="px-6 pt-2 pb-3">
              <Text className="text-[17px] font-semibold text-text-primary text-center">
                {t('channel_settings.language_label')}
              </Text>
            </View>
          </SafeAreaView>
          <FlatList
            data={LANGUAGE_CODES}
            keyExtractor={(item) => item}
            renderItem={({ item: code }) => (
              <TouchableOpacity
                onPress={() => handleLanguageChange(code)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 24,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F0F0F0',
                }}
              >
                <Text style={{ fontSize: 16, color: channelLanguage === code ? Colors.primary : text }}>
                  {t(`languages.${code}`)}
                </Text>
                {channelLanguage === code && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
              </TouchableOpacity>
            )}
          />
          <View style={{ backgroundColor: Colors.primary, height: 56 }}>
            <TouchableOpacity
              onPress={() => setLanguagePickerVisible(false)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
              <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}
