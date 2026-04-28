import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../constants/colors';

type ReleaseMode = 'immediate' | 'scheduled';

type Props = {
  visible: boolean;
  onBack: () => void;
  onComplete: (data: {
    title: string;
    thumbnailUri?: string;
    thumbnailBase64?: string;
    releaseDate?: Date;
  }) => void;
};

export default function FinalizeAudioSheet({ visible, onBack, onComplete }: Props) {
  const [title, setTitle] = useState('');
  const [thumbnailUri, setThumbnailUri] = useState<string | undefined>();
  const [thumbnailBase64, setThumbnailBase64] = useState<string | undefined>();
  const [releaseMode, setReleaseMode] = useState<ReleaseMode>('immediate');
  const [releaseDate, setReleaseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const isComplete = title.trim().length > 0;

  const pickThumbnail = async () => {
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
      setThumbnailUri(result.assets[0].uri);
      setThumbnailBase64(result.assets[0].base64 ?? undefined);
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const handleComplete = () => {
    if (!isComplete) return;
    onComplete({
      title: title.trim(),
      thumbnailUri,
      thumbnailBase64,
      releaseDate: releaseMode === 'scheduled' ? releaseDate : undefined,
    });
    setTitle('');
    setThumbnailUri(undefined);
    setThumbnailBase64(undefined);
    setReleaseMode('immediate');
    setReleaseDate(new Date());
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              Finalize Audio
            </Text>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1 px-6 pt-6">
          {/* Thumbnail */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mb-3">
            THUMBNAIL
          </Text>
          <TouchableOpacity
            onPress={pickThumbnail}
            className="self-center items-center justify-center rounded-lg overflow-hidden"
            style={{
              width: 160,
              height: 160,
              borderWidth: thumbnailUri ? 0 : 2,
              borderStyle: 'dashed',
              borderColor: '#D1D5DB',
            }}
          >
            {thumbnailUri ? (
              <Image source={{ uri: thumbnailUri }} style={{ width: 160, height: 160 }} resizeMode="cover" />
            ) : (
              <>
                <Ionicons name="image-outline" size={32} color={Colors.textSecondary} />
                <Text className="text-text-secondary text-[13px] mt-2">Upload Thumbnail</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Title */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-2">
            TITLE
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter audio title..."
            placeholderTextColor={Colors.textSecondary}
            className="bg-surface rounded-2xl px-4 py-3.5 text-[15px] text-text-primary"
            autoCapitalize="sentences"
            autoCorrect={false}
            autoComplete="off"
          />

          {/* Release toggle */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-3">
            RELEASE
          </Text>
          <View className="bg-surface rounded-2xl p-1 flex-row">
            {(['immediate', 'scheduled'] as ReleaseMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setReleaseMode(mode)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: releaseMode === mode ? Colors.primary : 'transparent',
                }}
              >
                <Text
                  className="font-semibold text-[14px]"
                  style={{ color: releaseMode === mode ? Colors.textPrimary : Colors.textSecondary }}
                >
                  {mode === 'immediate' ? 'Available Immediately' : 'Set Release'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date/time pickers */}
          {releaseMode === 'scheduled' && (
            <View className="mt-4 gap-3">
              <TouchableOpacity
                onPress={() => { setShowDatePicker(true); setShowTimePicker(false); }}
                className="flex-row items-center bg-surface rounded-2xl px-4 py-3.5 gap-3"
              >
                <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
                <Text className="text-[15px] text-text-primary">{formatDate(releaseDate)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setShowTimePicker(true); setShowDatePicker(false); }}
                className="flex-row items-center bg-surface rounded-2xl px-4 py-3.5 gap-3"
              >
                <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                <Text className="text-[15px] text-text-primary">{formatTime(releaseDate)}</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={releaseDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setReleaseDate((prev) => {
                      const next = new Date(date);
                      next.setHours(prev.getHours(), prev.getMinutes());
                      return next;
                    });
                  }}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={releaseDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    setShowTimePicker(false);
                    if (date) setReleaseDate((prev) => {
                      const next = new Date(prev);
                      next.setHours(date.getHours(), date.getMinutes());
                      return next;
                    });
                  }}
                />
              )}
            </View>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={{ backgroundColor: Colors.primary, paddingBottom: 24 }} className="flex-row">
          <TouchableOpacity
            onPress={onBack}
            className="flex-1 flex-row items-center justify-center gap-1 py-4"
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">Back</Text>
          </TouchableOpacity>
          <View style={{ width: 1, backgroundColor: Colors.primaryDark, marginVertical: 8 }} />
          <TouchableOpacity
            onPress={handleComplete}
            className="flex-1 flex-row items-center justify-center gap-1 py-4"
            style={{ opacity: isComplete ? 1 : 0.4 }}
          >
            <Text className="font-medium text-[15px] text-text-primary">Complete</Text>
            <Ionicons name="checkmark" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
