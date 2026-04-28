import React, { useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import AlarmSheet from '../../components/AlarmSheet';
import { useAlarms } from '../../hooks/useAlarms';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleScreen() {
  const { timeFormat } = useAuth();
  const { bg } = useTheme();
  const { alarms, addAlarm, removeAlarm } = useAlarms();
  const [sheetVisible, setSheetVisible] = useState(false);

  const formatTime = (alarm: SetAlarm) => {
    const m = String(alarm.minute).padStart(2, '0');
    if (timeFormat === 'military') {
      const h = alarm.ampm === 'PM' && alarm.hour !== 12
        ? alarm.hour + 12
        : alarm.ampm === 'AM' && alarm.hour === 12
        ? 0
        : alarm.hour;
      return `${String(h).padStart(2, '0')}:${m}`;
    }
    const h = alarm.hour % 12 || 12;
    return `${h}:${m} ${alarm.ampm}`;
  };

  if (alarms.length === 0) {
    return (
      <>
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: bg }}>
          <Image
            source={require('../../assets/icon.png')}
            style={{ width: 96, height: 96, borderRadius: 24, marginBottom: 24 }}
            resizeMode="cover"
          />
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
        />
      </>
    );
  }

  return (
    <>
      <View className="flex-1" style={{ backgroundColor: bg }}>
        <FlatList
          data={alarms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => (
            <View className="bg-surface rounded-2xl overflow-hidden flex-row items-center">
              {item.channelImageUrl ? (
                <Image
                  source={{ uri: item.channelImageUrl }}
                  style={{ alignSelf: 'stretch', aspectRatio: 1 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ alignSelf: 'stretch', aspectRatio: 1, backgroundColor: Colors.primaryLight }} />
              )}
              <View className="flex-1 px-4 py-3">
                <Text className="text-[26px] font-bold text-text-primary mb-0.5">
                  {formatTime(item)}
                </Text>
                <Text className="text-text-secondary text-[13px] mb-2">{item.channelName}</Text>
                <View className="flex-row gap-1">
                  {DAY_LABELS.map((day, idx) => {
                    const active = item.repeatDays.includes(idx);
                    return (
                      <View
                        key={day}
                        className="w-7 h-7 rounded-full items-center justify-center"
                        style={{
                          backgroundColor: active ? Colors.primary : Colors.background,
                          borderWidth: 1,
                          borderColor: active ? Colors.primary : Colors.textSecondary,
                        }}
                      >
                        <Text
                          className="text-[10px] font-semibold"
                          style={{ color: active ? Colors.textPrimary : Colors.textSecondary }}
                        >
                          {day[0]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <TouchableOpacity onPress={() => removeAlarm(item.id)} className="pr-4">
                <Ionicons name="trash-outline" size={22} color={Colors.destructive} />
              </TouchableOpacity>
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
      />
    </>
  );
}
