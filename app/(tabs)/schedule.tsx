import React, { useState, useCallback } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import AlarmSheet from '../../components/AlarmSheet';
import { useAlarmsContext, type SetAlarm } from '../../contexts/AlarmsContext';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ScheduleScreen() {
  const { timeFormat, isLoggedIn } = useAuth();
  const { bg, text, textSecondary } = useTheme();
  const { t } = useTranslation();
  const { alarms, addAlarm, editAlarm, removeAlarmDirect, toggleAlarm, refetch } = useAlarmsContext();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<SetAlarm | null>(null);

  useFocusEffect(useCallback(() => { refetch(); }, []));

  const formatTime = (alarm: SetAlarm) => {
    const m = String(alarm.minute).padStart(2, '0');
    if (timeFormat === 'military') {
      const h = alarm.ampm === 'PM' && alarm.hour !== 12 && alarm.hour <= 12
        ? alarm.hour + 12
        : alarm.ampm === 'AM' && alarm.hour === 12
        ? 0
        : alarm.hour;
      return `${String(h).padStart(2, '0')}:${m}`;
    }
    const h = alarm.hour % 12 || 12;
    return `${h}:${m} ${alarm.ampm}`;
  };

  const handleCloseSheet = () => {
    setSheetVisible(false);
    setEditingAlarm(null);
  };

  const handleSave = (data: any) => {
    if (editingAlarm) {
      editAlarm(editingAlarm.id, data);
    } else {
      addAlarm(data);
    }
    handleCloseSheet();
  };

  const handleDelete = async () => {
    if (!editingAlarm) return;
    await removeAlarmDirect(editingAlarm.id);
    handleCloseSheet();
  };

  const alarmSheet = (
    <AlarmSheet
      visible={sheetVisible || editingAlarm !== null}
      onClose={handleCloseSheet}
      onSave={handleSave}
      initialAlarm={editingAlarm ?? undefined}
      onDelete={editingAlarm ? handleDelete : undefined}
    />
  );

  if (alarms.length === 0) {
    return (
      <>
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: bg }}>
          <Image
            source={require('../../assets/icon.png')}
            style={{ width: 96, height: 96, borderRadius: 24, marginBottom: 24 }}
            resizeMode="cover"
          />
          <Text className="text-[20px] font-bold mb-2" style={{ color: text }}>{t('schedule.no_alarms')}</Text>
          <Text className="text-[15px] text-center mb-6" style={{ color: textSecondary }}>
            {t('schedule.no_alarms_subtext')}
          </Text>
          {!isLoggedIn && (
            <Text className="text-[15px] text-center mb-8" style={{ color: textSecondary }}>
              {t('schedule.login_prompt')}
            </Text>
          )}
          {isLoggedIn && (
            <TouchableOpacity
              onPress={() => setSheetVisible(true)}
              className="rounded-full px-8 py-3.5"
              style={{ backgroundColor: Colors.primary }}
            >
              <Text className="font-bold text-[16px] text-text-primary">{t('schedule.add_alarm')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {alarmSheet}
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
            <View className="bg-surface rounded-2xl overflow-hidden flex-row items-start">
              {item.channelImageUrl ? (
                <Image
                  source={{ uri: item.channelImageUrl }}
                  style={{ alignSelf: 'stretch', aspectRatio: 1, opacity: item.active === false ? 0.45 : 1 }}
                  resizeMode="cover"
                />
              ) : (
                <View style={{ alignSelf: 'stretch', aspectRatio: 1, backgroundColor: Colors.primaryLight, opacity: item.active === false ? 0.45 : 1 }} />
              )}
              <View className="flex-1 px-4 py-3" style={{ opacity: item.active === false ? 0.45 : 1 }}>
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
              <View className="flex-row items-center pr-3 pt-3 gap-2">
                <Switch
                  value={item.active !== false}
                  onValueChange={() => toggleAlarm(item.id)}
                  trackColor={{ false: '#ccc', true: Colors.primary }}
                  thumbColor="#fff"
                />
                <TouchableOpacity onPress={() => setEditingAlarm(item)}>
                  <Ionicons name="create-outline" size={24} color={text} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListFooterComponent={
            <TouchableOpacity
              onPress={() => setSheetVisible(true)}
              className="rounded-full py-3.5 items-center mt-2"
              style={{ backgroundColor: Colors.primary }}
            >
              <Text className="font-bold text-[16px] text-text-primary">{t('schedule.add_alarm')}</Text>
            </TouchableOpacity>
          }
        />
      </View>
      {alarmSheet}
    </>
  );
}
