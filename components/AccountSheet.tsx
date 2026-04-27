import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AccountSheet({ visible, onClose }: Props) {
  const { signOut, username, session, timeFormat, setTimeFormat, colorScheme, setColorScheme } = useAuth();
  const [uploadCount, setUploadCount] = useState(0);
  const [alarmCount, setAlarmCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              {username ?? 'Account'}
            </Text>
          </View>
        </SafeAreaView>

        <View className="flex-1 px-4 pt-4">
          <View className="flex-row mt-0 bg-surface rounded-2xl overflow-hidden">
            {[
              { label: 'Uploads', value: uploadCount },
              { label: 'Alarms', value: alarmCount },
              { label: 'Favorites', value: savedCount },
            ].map(({ label, value }, i) => (
              <View
                key={label}
                className={`flex-1 items-center py-4 ${i < 2 ? 'border-r border-gray-200' : ''}`}
              >
                <Text className="text-[20px] font-bold text-text-primary">{value}</Text>
                <Text className="text-[13px] text-text-secondary mt-0.5">{label}</Text>
              </View>
            ))}
          </View>

          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-3">
            SETTINGS
          </Text>

          <View className="bg-surface rounded-2xl p-1 flex-row mb-4">
            {(['standard', 'military'] as const).map((fmt) => (
              <TouchableOpacity
                key={fmt}
                onPress={() => setTimeFormat(fmt)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: timeFormat === fmt ? Colors.background : 'transparent',
                  shadowColor: timeFormat === fmt ? '#000' : 'transparent',
                  shadowOpacity: timeFormat === fmt ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: timeFormat === fmt ? 2 : 0,
                }}
              >
                <Text
                  className="font-medium text-[15px]"
                  style={{ color: timeFormat === fmt ? Colors.textPrimary : Colors.textSecondary }}
                >
                  {fmt === 'standard' ? 'Standard' : 'Military'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="bg-surface rounded-2xl p-1 flex-row mt-4 mb-6">
            {(['light', 'dark'] as const).map((scheme) => (
              <TouchableOpacity
                key={scheme}
                onPress={() => setColorScheme(scheme)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: colorScheme === scheme ? Colors.background : 'transparent',
                  shadowColor: colorScheme === scheme ? '#000' : 'transparent',
                  shadowOpacity: colorScheme === scheme ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: colorScheme === scheme ? 2 : 0,
                }}
              >
                <Text
                  className="font-medium text-[15px]"
                  style={{ color: colorScheme === scheme ? Colors.textPrimary : Colors.textSecondary }}
                >
                  {scheme === 'light' ? 'Light' : 'Dark'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => { signOut(); onClose(); }}
            className="bg-surface rounded-full py-3.5 items-center mb-3"
          >
            <Text className="font-semibold text-[15px] text-text-primary">Log Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDeleteAccount}
            className="rounded-full py-3.5 items-center"
            style={{ backgroundColor: Colors.destructiveLight }}
          >
            <Text className="font-semibold text-[15px]" style={{ color: Colors.destructive }}>
              Delete Account
            </Text>
          </TouchableOpacity>
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
