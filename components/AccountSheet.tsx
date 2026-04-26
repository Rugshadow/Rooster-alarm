import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AccountSheet({ visible, onClose }: Props) {
  const { signOut } = useAuth();
  const [timeFormat, setTimeFormat] = useState<'standard' | 'military'>('standard');

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
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <View className="w-8" />
          <Text className="text-[17px] font-semibold text-text-primary">Account</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View className="px-4 pt-4">
          <View className="bg-surface rounded-2xl p-4 flex-row items-center gap-4">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: Colors.primary }}
            >
              <Ionicons name="person" size={32} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-[17px] font-bold text-text-primary">Username</Text>
            </View>
            <TouchableOpacity
              className="border rounded-full px-4 py-1.5"
              style={{ borderColor: Colors.primaryDark }}
            >
              <Text className="text-[14px] font-medium text-text-primary">Edit</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row mt-4 bg-surface rounded-2xl overflow-hidden">
            {[
              { label: 'Uploads', value: '0' },
              { label: 'Alarms', value: '0' },
              { label: 'Saved', value: '0' },
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
      </SafeAreaView>
    </Modal>
  );
}
