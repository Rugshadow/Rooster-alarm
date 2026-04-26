import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import AlarmSheet, { type AlarmData } from '../../components/AlarmSheet';
import type { Channel } from '../../components/ChannelSheet';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MOCK_CHANNELS: Channel[] = [
  {
    id: '1', name: 'Morning Mindset', genre: 'health', listeners: 12400,
    bio: '', uploads: [],
  },
  {
    id: '2', name: 'Daily Jazz', genre: 'music', listeners: 8900,
    bio: '', uploads: [],
  },
];

type SetAlarm = AlarmData & { id: string };

export default function ScheduleScreen() {
  const [alarms, setAlarms] = useState<SetAlarm[]>([]);
  const [sheetVisible, setSheetVisible] = useState(false);

  const addAlarm = (data: AlarmData) => {
    setAlarms((prev) => [...prev, { ...data, id: Date.now().toString() }]);
  };

  const removeAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const formatTime = (alarm: SetAlarm) => {
    const h = alarm.hour % 12 || 12;
    const m = String(alarm.minute).padStart(2, '0');
    return `${h}:${m} ${alarm.ampm}`;
  };

  if (alarms.length === 0) {
    return (
      <>
        <View className="flex-1 bg-white items-center justify-center px-8">
          <View
            className="w-24 h-24 rounded-3xl items-center justify-center mb-6"
            style={{ backgroundColor: Colors.primaryLight }}
          >
            <Text style={{ fontSize: 44 }}>⏰</Text>
          </View>
          <Text className="text-[20px] font-bold text-text-primary mb-2">No alarms yet</Text>
          <Text className="text-text-secondary text-[15px] text-center mb-8">
            Set your first alarm to wake up to your favorite creator
          </Text>
          <TouchableOpacity
            onPress={() => setSheetVisible(true)}
            className="rounded-full px-8 py-3.5"
            style={{ backgroundColor: Colors.primary }}
          >
            <Text className="font-bold text-[16px] text-text-primary">+ Add Alarm</Text>
          </TouchableOpacity>
        </View>

        <AlarmSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onSave={addAlarm}
          channels={MOCK_CHANNELS}
        />
      </>
    );
  }

  return (
    <>
      <View className="flex-1 bg-white">
        <FlatList
          data={alarms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View className="bg-surface rounded-2xl p-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[28px] font-bold text-text-primary">
                  {formatTime(item)}
                </Text>
                <TouchableOpacity onPress={() => removeAlarm(item.id)}>
                  <Ionicons name="trash-outline" size={22} color={Colors.destructive} />
                </TouchableOpacity>
              </View>
              <Text className="text-text-secondary text-[14px] mb-3">{item.channelName}</Text>
              <View className="flex-row gap-1.5">
                {DAY_LABELS.map((day, idx) => {
                  const active = item.repeatDays.includes(idx);
                  return (
                    <View
                      key={day}
                      className="w-9 h-9 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: active ? Colors.primary : Colors.background,
                        borderWidth: 1,
                        borderColor: active ? Colors.primary : Colors.textSecondary,
                      }}
                    >
                      <Text
                        className="text-[11px] font-semibold"
                        style={{ color: active ? Colors.textPrimary : Colors.textSecondary }}
                      >
                        {day[0]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity
              onPress={() => setSheetVisible(true)}
              className="rounded-full py-3.5 items-center mt-2"
              style={{ backgroundColor: Colors.primary }}
            >
              <Text className="font-bold text-[16px] text-text-primary">+ Add Alarm</Text>
            </TouchableOpacity>
          }
        />
      </View>

      <AlarmSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSave={addAlarm}
        channels={MOCK_CHANNELS}
      />
    </>
  );
}
