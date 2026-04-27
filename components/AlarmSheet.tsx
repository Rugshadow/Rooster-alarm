import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import ChannelAvatar from './ChannelAvatar';
import type { Channel } from './ChannelSheet';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const ITEM_HEIGHT = 72;

function TimeScroller({
  items,
  selected,
  onChange,
  onAdjust,
}: {
  items: string[];
  selected: string;
  onChange: (val: string) => void;
  onAdjust: (delta: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const currentIndex = items.indexOf(selected);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    if (items[clamped] !== selected) onChange(items[clamped]);
  };

  return (
    <View className="items-center">
      <TouchableOpacity onPress={() => onAdjust(1)} className="p-2">
        <Ionicons name="chevron-up" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
      <View style={{ height: ITEM_HEIGHT, overflow: 'hidden' }} className="bg-primary-light rounded-xl px-8 justify-center">
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          contentOffset={{ x: 0, y: currentIndex * ITEM_HEIGHT }}
          onMomentumScrollEnd={handleScroll}
          style={{ height: ITEM_HEIGHT }}
        >
          {items.map((item) => (
            <View key={item} style={{ height: ITEM_HEIGHT }} className="items-center justify-center">
              <Text className="text-[40px] font-bold text-text-primary">{item}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <TouchableOpacity onPress={() => onAdjust(-1)} className="p-2">
        <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (alarm: AlarmData) => void;
};

export type AlarmData = {
  channelId: string;
  channelName: string;
  channelImageUrl?: string;
  hour: number;
  minute: number;
  ampm: 'AM' | 'PM';
  repeatDays: number[];
};

function ChannelPickerModal({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (ch: Channel) => void;
  onClose: () => void;
}) {
  const { session, isLoggedIn } = useAuth();
  const [search, setSearch] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && isLoggedIn && session) fetchFavoriteChannels();
  }, [visible]);

  const fetchFavoriteChannels = async () => {
    setLoading(true);
    const { data: userData } = await supabase
      .from('users')
      .select('favorite_channels')
      .eq('user_id', session!.user.id)
      .single();

    const favIds: string[] = userData?.favorite_channels ?? [];
    if (favIds.length === 0) { setChannels([]); setLoading(false); return; }

    const [{ data: favUsers }, { data: audioFiles }] = await Promise.all([
      supabase.from('users').select('*').in('user_id', favIds),
      supabase.from('audio_files').select('*').in('uploaded_by', favIds),
    ]);

    const mapped: Channel[] = (favUsers ?? []).map((u) => ({
      id: u.user_id,
      name: u.username,
      genre: (audioFiles ?? []).find((f) => f.uploaded_by === u.user_id)?.genre ?? '',
      listeners: u.num_of_followers ?? 0,
      bio: u.bio ?? '',
      imageUrl: u.profile_photo,
      uploads: [],
    }));

    setChannels(mapped);
    setLoading(false);
  };

  const filtered = search.trim()
    ? channels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : channels;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-4 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              Favorites
            </Text>
          </View>
        </SafeAreaView>

        <View className="px-4 py-3">
          <View className="flex-row items-center bg-surface rounded-2xl px-4 py-3 gap-2">
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search channels..."
              placeholderTextColor={Colors.textSecondary}
              className="flex-1 text-[15px] text-text-primary"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-text-secondary text-[15px] text-center">
              {isLoggedIn ? 'No favorite channels yet. Add some from the Browse tab.' : 'Log in to see your favorites.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={{ padding: 16, gap: 16 }}
            columnWrapperStyle={{ gap: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="flex-1 items-center"
                onPress={() => { onSelect(item); onClose(); }}
              >
                <ChannelAvatar id={item.id} name={item.name} size="carousel" imageUrl={item.imageUrl} />
                <Text className="text-[12px] text-text-secondary mt-2 text-center" numberOfLines={2}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}

        <View style={{ backgroundColor: Colors.primary }}>
          <TouchableOpacity
            onPress={onClose}
            className="flex-row items-center justify-center gap-1 py-4"
            style={{ paddingBottom: 24 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export default function AlarmSheet({ visible, onClose, onSave }: Props) {
  const { timeFormat } = useAuth();
  const HOURS = timeFormat === 'military' ? HOURS_24 : HOURS_12;
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [hour, setHour] = useState(timeFormat === 'military' ? '07' : '07');
  const [minute, setMinute] = useState('00');
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  const isComplete = selectedChannel !== null;

  const toggleDay = (day: number) => {
    setRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const adjustHour = (delta: number) => {
    const idx = HOURS.indexOf(hour);
    setHour(HOURS[(idx + delta + HOURS.length) % HOURS.length]);
  };

  const adjustMinute = (delta: number) => {
    const idx = MINUTES.indexOf(minute);
    setMinute(MINUTES[(idx + delta + MINUTES.length) % MINUTES.length]);
  };

  const reset = () => {
    setSelectedChannel(null);
    setHour('07');
    setMinute('00');
    setAmpm('AM');
    setRepeatDays([]);
  };

  const handleSave = () => {
    if (!selectedChannel) return;
    let h: number;
    let resolvedAmpm: 'AM' | 'PM';
    if (timeFormat === 'military') {
      h = parseInt(hour);
      resolvedAmpm = h >= 12 ? 'PM' : 'AM';
    } else {
      h = parseInt(hour) + (ampm === 'PM' && parseInt(hour) !== 12 ? 12 : 0);
      resolvedAmpm = ampm;
    }
    onSave({
      channelId: selectedChannel.id,
      channelName: selectedChannel.name,
      channelImageUrl: selectedChannel.imageUrl,
      hour: h,
      minute: parseInt(minute),
      ampm: resolvedAmpm,
      repeatDays,
    });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'bottom']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              New Alarm
            </Text>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1 px-6 pt-6">
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mb-2">
            CHANNEL
          </Text>

          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            className="rounded-lg items-center justify-center self-center"
            style={{
              width: 160,
              height: 160,
              overflow: 'hidden',
              borderWidth: selectedChannel ? 0 : 2,
              borderStyle: 'dashed',
              borderColor: '#D1D5DB',
            }}
          >
            {selectedChannel?.imageUrl ? (
              <Image
                source={{ uri: selectedChannel.imageUrl }}
                style={{ width: 160, height: 160 }}
                resizeMode="cover"
              />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={28} color={Colors.textSecondary} />
                <Text className="text-text-secondary text-[13px] mt-2 text-center px-2" numberOfLines={2}>
                  {selectedChannel ? selectedChannel.name : 'Pick a channel'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {selectedChannel && (
            <Text className="text-center text-[14px] font-medium text-text-primary mt-2">
              {selectedChannel.name}
            </Text>
          )}

          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-2">
            WAKE TIME
          </Text>
          <View className="flex-row items-center justify-center gap-3">
            <TimeScroller items={HOURS} selected={hour} onChange={setHour} onAdjust={adjustHour} />
            <Text className="text-[40px] font-bold text-text-primary mb-2">:</Text>
            <TimeScroller items={MINUTES} selected={minute} onChange={setMinute} onAdjust={adjustMinute} />

            {timeFormat !== 'military' && (
              <View className="items-center gap-2 ml-2">
                {(['AM', 'PM'] as const).map((period) => (
                  <TouchableOpacity
                    key={period}
                    onPress={() => setAmpm(period)}
                    className="px-3 py-2 rounded-xl"
                    style={{ backgroundColor: ampm === period ? Colors.primaryLight : Colors.surface }}
                  >
                    <Text
                      className="font-semibold text-[15px]"
                      style={{ color: ampm === period ? Colors.textPrimary : Colors.textSecondary }}
                    >
                      {period}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-3">
            REPEAT
          </Text>
          <View className="flex-row gap-2 justify-center">
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
              Save Alarm
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ChannelPickerModal
        visible={pickerVisible}
        onSelect={setSelectedChannel}
        onClose={() => setPickerVisible(false)}
      />
    </Modal>
  );
}
