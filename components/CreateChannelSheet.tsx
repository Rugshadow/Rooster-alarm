import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';

const GENRES = [
  'Music', 'News', 'Comedy', 'Ambient', 'Motivational',
  'Religious', 'Education', 'Storytelling', 'Fitness', 'Alternative',
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { name: string; genre: string; coverPhotoUri?: string; coverPhotoBase64?: string }) => void;
};

export default function CreateChannelSheet({ visible, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [coverUri, setCoverUri] = useState<string | undefined>();
  const [coverBase64, setCoverBase64] = useState<string | undefined>();

  const isComplete = name.trim().length > 0 && genre.length > 0;

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
    setCoverUri(undefined);
    setCoverBase64(undefined);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = () => {
    if (!isComplete) return;
    onSave({ name: name.trim(), genre, coverPhotoUri: coverUri, coverPhotoBase64: coverBase64 });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              Create a Channel
            </Text>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1 px-6 pt-6">
          {/* Cover photo */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mb-3">
            COVER PHOTO
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
                <Text className="text-text-secondary text-[13px] mt-2">Upload Cover Photo</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Channel name */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-2">
            CHANNEL NAME
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter channel name..."
            placeholderTextColor={Colors.textSecondary}
            className="bg-surface rounded-2xl px-4 py-3.5 text-[15px] text-text-primary"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />

          {/* Genre */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-3">
            GENRE
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
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        <View className="flex-row gap-3 px-6 py-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={handleClose}
            className="flex-1 rounded-full py-3 items-center bg-surface"
          >
            <Text className="font-semibold text-[15px] text-text-primary">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            className="flex-1 rounded-full py-3 items-center"
            style={{ backgroundColor: isComplete ? Colors.primary : Colors.surface }}
          >
            <Text
              className="font-bold text-[15px]"
              style={{ color: isComplete ? Colors.textPrimary : Colors.textSecondary }}
            >
              Create Channel
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
