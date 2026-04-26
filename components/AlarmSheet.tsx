import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import type { Channel } from './ChannelSheet';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (alarm: AlarmData) => void;
  channels: Channel[];
};

export type AlarmData = {
  channelId: string;
  channelName: string;
  hour: number;
  minute: number;
  ampm: 'AM' | 'PM';
  repeatDays: number[];
};

export default function AlarmSheet({ visible, onClose, onSave, channels }: Props) {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [hour, setHour] = useState('07');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [pickingChannel, setPickingChannel] = useState(false);

  const isComplete = selectedChannel !== null;

  const toggleDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const adjustHour = (delta: number) => {
    const idx = HOURS.indexOf(hour);
    const next = (idx + delta + HOURS.length) % HOURS.length;
    setHour(HOURS[next]);
  };

  const adjustMinute = (delta: number) => {
    const idx = MINUTES.indexOf(minute);
    const next = (idx + delta + MINUTES.length) % MINUTES.length;
    setMinute(MINUTES[next]);
  };

  const handleSave = () => {
    if (!selectedChannel) return;
    const h = parseInt(hour) + (ampm === 'PM' && parseInt(hour) !== 12 ? 12 : 0);
    onSave({
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      hour: h,
      minute: parseInt(minute),
      ampm,
      repeatDays,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white">
        <View className="px-6 pt-4 pb-2 border-b border-gray-100">
          <Text className="text-[17px] font-semibold text-text-primary text-center">
            New Alarm
          </Text>
        </View>

        <ScrollView className="flex-1 px-6 pt-6">
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mb-2">
            CHANNEL
          </Text>
          <TouchableOpacity
            onPress={() => setPickingChannel(!pickingChannel)}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-4 flex-row items-center gap-3"
          >
            <Ionicons name="add-circle-outline" size={24} color={Colors.textSecondary} />
            <Text className="text-text-secondary text-[15px]">
              {selectedChannel ? selectedChannel.name : 'Pick a channel'}
            </Text>
          </TouchableOpacity>

          {pickingChannel && (
            <View className="mt-2 border border-gray-200 rounded-2xl overflow-hidden">
              {channels.map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  onPress={() => {
                    setSelectedChannel(ch);
                    setPickingChannel(false);
                  }}
                  className="px-4 py-3 border-b border-gray-100"
                >
                  <Text className="text-text-primary text-[15px]">{ch.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-2">
            WAKE TIME
          </Text>
          <View className="flex-row items-center justify-center gap-2">
            <View className="items-center">
              <TouchableOpacity onPress={() => adjustHour(1)} className="p-2">
                <Ionicons name="chevron-up" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View className="bg-primary-light rounded-xl px-5 py-3">
                <Text className="text-[28px] font-bold text-text-primary">{hour}</Text>
              </View>
              <TouchableOpacity onPress={() => adjustHour(-1)} className="p-2">
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text className="text-[28px] font-bold text-text-primary mb-2">:</Text>

            <View className="items-center">
              <TouchableOpacity onPress={() => adjustMinute(1)} className="p-2">
                <Ionicons name="chevron-up" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
              <View className="bg-primary-light rounded-xl px-5 py-3">
                <Text className="text-[28px] font-bold text-text-primary">{minute}</Text>
              </View>
              <TouchableOpacity onPress={() => adjustMinute(-1)} className="p-2">
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View className="items-center gap-2 ml-2">
              {(['AM', 'PM'] as const).map((period) => (
                <TouchableOpacity
                  key={period}
                  onPress={() => setAmpm(period)}
                  className="px-3 py-2 rounded-xl"
                  style={{
                    backgroundColor: ampm === period ? Colors.primaryLight : Colors.surface,
                  }}
                >
                  <Text
                    className="font-semibold text-[15px]"
                    style={{
                      color: ampm === period ? Colors.textPrimary : Colors.textSecondary,
                    }}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-3">
            REPEAT
          </Text>
          <View className="flex-row gap-2">
            {DAYS.map((day, idx) => {
              const active = repeatDays.includes(idx);
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => toggleDay(idx)}
                  className="w-10 h-10 rounded-full items-center justify-center border"
                  style={{
                    backgroundColor: active ? Colors.primary : 'transparent',
                    borderColor: active ? Colors.primary : Colors.textSecondary,
                  }}
                >
                  <Text
                    className="font-semibold text-[14px]"
                    style={{ color: active ? Colors.textPrimary : Colors.textSecondary }}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View className="flex-row gap-3 px-6 py-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={onClose}
            className="flex-1 rounded-full py-3 items-center bg-surface"
          >
            <Text className="font-semibold text-[15px] text-text-primary">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            className="flex-1 rounded-full py-3 items-center"
            style={{ backgroundColor: isComplete ? Colors.primaryDark : Colors.surface }}
          >
            <Text
              className="font-bold text-[15px]"
              style={{ color: isComplete ? Colors.textPrimary : Colors.textSecondary }}
            >
              Save Alarm
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
