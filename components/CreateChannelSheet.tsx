import React, { useState } from 'react';
import {
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  FlatList,
} from 'react-native';
import { Text } from './Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset } from '../hooks/useTopInset';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const GENRES = [
  'Music', 'News', 'Comedy', 'Ambient', 'Motivational',
  'Religious', 'Education', 'Storytelling', 'Fitness', 'Alternative',
];

const LANGUAGE_CODES = ['all', 'en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'bn', 'ru', 'pt', 'id', 'fil', 'vi'] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { name: string; genre: string; description: string; coverPhotoUri?: string; coverPhotoBase64?: string; language: string }) => void;
};

export default function CreateChannelSheet({ visible, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const { language: deviceLanguage } = useAuth();
  const topPad = useTopInset();
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(deviceLanguage ?? 'en');
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [coverUri, setCoverUri] = useState<string | undefined>();
  const [coverBase64, setCoverBase64] = useState<string | undefined>();

  const isComplete = name.trim().length > 0 && genre.length > 0 && !!coverUri;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setCoverUri(result.assets[0].uri);
      setCoverBase64(result.assets[0].base64 ?? undefined);
    }
  };

  const reset = () => {
    setName('');
    setGenre('');
    setDescription('');
    setSelectedLanguage(deviceLanguage ?? 'en');
    setCoverUri(undefined);
    setCoverBase64(undefined);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    if (!isComplete) return;
    onSave({ name: name.trim(), genre, description: description.trim(), coverPhotoUri: coverUri, coverPhotoBase64: coverBase64, language: selectedLanguage });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <SafeAreaView edges={[]} style={{ backgroundColor: Colors.primary, paddingTop: topPad }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              {t('create_channel.title')}
            </Text>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1 px-6 pt-6">
          {/* Cover photo */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mb-3">
            {t('create_channel.cover_photo_label')}
          </Text>
          <TouchableOpacity
            onPress={pickImage}
            className="self-center items-center justify-center rounded-lg overflow-hidden"
            style={{
              width: 180,
              height: 180,
              borderWidth: coverUri ? 0 : 2,
              borderStyle: 'dashed',
              borderColor: '#D1D5DB',
            }}
          >
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={{ width: 180, height: 180 }} resizeMode="cover" />
            ) : (
              <>
                <Ionicons name="image-outline" size={32} color={Colors.textSecondary} />
                <Text className="text-text-secondary text-[13px] mt-2">{t('create_channel.upload_cover')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Channel name */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-2">
            {t('create_channel.name_label')}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('create_channel.name_placeholder')}
            placeholderTextColor={Colors.textSecondary}
            className="bg-surface rounded-2xl px-4 py-3.5 text-[15px] text-text-primary"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />

          {/* Description */}
          <View className="flex-row justify-between items-baseline mt-6 mb-2">
            <Text className="text-[12px] font-semibold text-text-secondary tracking-wider">{t('create_channel.description_label')}</Text>
            <Text className="text-[12px]" style={{ color: description.length > 130 ? (description.length >= 150 ? '#E53935' : '#F59E0B') : Colors.textSecondary }}>
              {description.length}/150
            </Text>
          </View>
          <TextInput
            value={description}
            onChangeText={(v) => setDescription(v.slice(0, 150))}
            placeholder={t('create_channel.description_placeholder')}
            placeholderTextColor={Colors.textSecondary}
            className="bg-surface rounded-2xl px-4 py-3.5 text-[15px] text-text-primary"
            multiline
            numberOfLines={3}
            maxLength={150}
            autoCapitalize="sentences"
            autoCorrect
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          {/* Genre */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-3">
            {t('create_channel.genre_label')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {GENRES.map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setGenre(g)}
                className="px-4 py-2 rounded-full border"
                style={{
                  backgroundColor: genre === g ? Colors.primary : 'transparent',
                  borderColor: genre === g ? Colors.primary : '#D1D5DB',
                }}
              >
                <Text
                  className="text-[14px] font-medium"
                  style={{ color: genre === g ? Colors.textPrimary : Colors.textSecondary }}
                >
                  {t(`genres.${g.toLowerCase()}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Language */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-2">
            {t('create_channel.language_label')}
          </Text>
          <TouchableOpacity
            onPress={() => setLanguagePickerVisible(true)}
            className="bg-surface rounded-2xl px-4 py-3.5 flex-row items-center justify-between"
          >
            <Text className="text-[15px] text-text-primary">{t(`languages.${selectedLanguage}`)}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSave}
            disabled={!isComplete}
            className="rounded-full py-4 items-center mt-6 mb-8"
            style={{ backgroundColor: isComplete ? Colors.primary : Colors.surface }}
          >
            <Text
              className="font-bold text-[16px]"
              style={{ color: isComplete ? Colors.textPrimary : Colors.textSecondary }}
            >
              {t('create_channel.create_button')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={{ backgroundColor: Colors.primary, height: 56 }}>
          <TouchableOpacity
            onPress={handleClose}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal visible={languagePickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLanguagePickerVisible(false)}>
        <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
          <SafeAreaView edges={[]} style={{ backgroundColor: Colors.primary, paddingTop: topPad }}>
            <View className="px-6 pt-2 pb-3">
              <Text className="text-[17px] font-semibold text-text-primary text-center">
                {t('create_channel.language_label')}
              </Text>
            </View>
          </SafeAreaView>
          <FlatList
            data={LANGUAGE_CODES}
            keyExtractor={(item) => item}
            renderItem={({ item: code }) => (
              <TouchableOpacity
                onPress={() => { setSelectedLanguage(code); setLanguagePickerVisible(false); }}
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
                <Text style={{ fontSize: 16, color: selectedLanguage === code ? Colors.primary : '#1A1A1A' }}>
                  {t(`languages.${code}`)}
                </Text>
                {selectedLanguage === code && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
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
