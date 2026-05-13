import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ITEM_HEIGHT = 72;
const LOOP_REPS = 5;

function TimeScroller({ items, selected, onChange }: {
  items: string[];
  selected: string;
  onChange: (val: string) => void;
}) {
  const { textSecondary } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const looped = useMemo(() => Array.from({ length: LOOP_REPS }, () => items).flat(), [items]);
  const centerStart = Math.floor(LOOP_REPS / 2) * items.length;
  const scrollIndexRef = useRef(centerStart + items.indexOf(selected));
  const suppressExternalRef = useRef(false);
  const prevSelectedRef = useRef(selected);
  const isSnappingRef = useRef(false);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ y: scrollIndexRef.current * ITEM_HEIGHT, animated: false });
  }, []);

  React.useEffect(() => {
    if (selected !== prevSelectedRef.current) {
      if (suppressExternalRef.current) { suppressExternalRef.current = false; }
      else {
        const idx = centerStart + items.indexOf(selected);
        scrollIndexRef.current = idx;
        scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
      }
    }
    prevSelectedRef.current = selected;
  }, [selected]);

  const resolveItem = (rawIndex: number) => {
    const itemIndex = ((rawIndex % items.length) + items.length) % items.length;
    if (items[itemIndex] !== selected) onChange(items[itemIndex]);
    scrollIndexRef.current = rawIndex;
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSnappingRef.current) return;
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    resolveItem(idx);
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSnappingRef.current) return;
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    resolveItem(idx);
    isSnappingRef.current = true;
    scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
    setTimeout(() => { isSnappingRef.current = false; }, 400);
  };

  const handleAdjust = (delta: number) => {
    suppressExternalRef.current = true;
    const newIdx = scrollIndexRef.current + delta;
    scrollIndexRef.current = newIdx;
    scrollRef.current?.scrollTo({ y: newIdx * ITEM_HEIGHT, animated: true });
    const itemIndex = ((newIdx % items.length) + items.length) % items.length;
    onChange(items[itemIndex]);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <TouchableOpacity onPress={() => handleAdjust(1)} style={{ padding: 8 }}>
        <Ionicons name="chevron-up" size={20} color={textSecondary} />
      </TouchableOpacity>
      <View style={{ height: ITEM_HEIGHT, overflow: 'hidden', backgroundColor: Colors.primaryLight, borderRadius: 12, paddingHorizontal: 28, justifyContent: 'center' }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          decelerationRate={0.999}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScrollEndDrag={handleScrollEndDrag}
          style={{ height: ITEM_HEIGHT }}
        >
          {looped.map((item, idx) => (
            <View key={idx} style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 40, fontWeight: 'bold', color: Colors.textPrimary }}>{item}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
      <TouchableOpacity onPress={() => handleAdjust(-1)} style={{ padding: 8 }}>
        <Ionicons name="chevron-down" size={20} color={textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

function TimePickerModal({ visible, value, onCancel, onConfirm }: {
  visible: boolean;
  value: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}) {
  const { bg, surface, text, textSecondary } = useTheme();
  const { t } = useTranslation();
  const h = value.getHours();
  const [hour, setHour] = useState(String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0'));
  const [minute, setMinute] = useState(String(value.getMinutes()).padStart(2, '0'));
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(h < 12 ? 'AM' : 'PM');

  React.useEffect(() => {
    if (visible) {
      const hh = value.getHours();
      setHour(String(hh % 12 === 0 ? 12 : hh % 12).padStart(2, '0'));
      setMinute(String(value.getMinutes()).padStart(2, '0'));
      setAmpm(hh < 12 ? 'AM' : 'PM');
    }
  }, [visible]);

  const handleConfirm = () => {
    const raw = parseInt(hour);
    const h24 = ampm === 'AM' ? (raw === 12 ? 0 : raw) : (raw === 12 ? 12 : raw + 12);
    const next = new Date(value);
    next.setHours(h24, parseInt(minute));
    onConfirm(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ backgroundColor: bg, borderRadius: 24, padding: 24 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: text, textAlign: 'center', marginBottom: 20 }}>
            {t('finalize_audio.set_release_time')}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <TimeScroller items={HOURS_12} selected={hour} onChange={setHour} />
            <Text style={{ fontSize: 40, fontWeight: 'bold', color: text, marginBottom: 8 }}>:</Text>
            <TimeScroller items={MINUTES} selected={minute} onChange={setMinute} />
            <View style={{ gap: 8, marginLeft: 8 }}>
              {(['AM', 'PM'] as const).map((period) => (
                <TouchableOpacity
                  key={period}
                  onPress={() => setAmpm(period)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12,
                    backgroundColor: ampm === period ? Colors.primaryLight : surface,
                  }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 15, color: ampm === period ? Colors.textPrimary : textSecondary }}>
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 100, alignItems: 'center', backgroundColor: surface }}
            >
              <Text style={{ fontWeight: '600', fontSize: 15, color: text }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 100, alignItems: 'center', backgroundColor: Colors.primary }}
            >
              <Text style={{ fontWeight: '700', fontSize: 15, color: Colors.textPrimary }}>{t('finalize_audio.set_release_time')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type ScheduledRelease = { date: Date; title: string };

function InlineCalendar({ value, minDate, onChange, scheduledDates = [] }: {
  value: Date;
  minDate: Date;
  onChange: (date: Date) => void;
  scheduledDates?: ScheduledRelease[];
}) {
  const { surface, text, textSecondary } = useTheme();
  const { t } = useTranslation();
  const MONTHS = t('finalize_audio.months', { returnObjects: true }) as string[];
  const DAY_LABELS = t('finalize_audio.day_labels', { returnObjects: true }) as string[];
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1);

  const selectedDayReleases = scheduledDates
    .filter(({ date: d }) =>
      d.getFullYear() === value.getFullYear() &&
      d.getMonth() === value.getMonth() &&
      d.getDate() === value.getDate()
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <View style={{ backgroundColor: surface, borderRadius: 20, padding: 16, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={20} color={text} />
        </TouchableOpacity>
        {selectedDayReleases.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginHorizontal: 8 }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: text }} numberOfLines={1}>
              {selectedDayReleases.map(r => r.title).join(', ')}
            </Text>
          </ScrollView>
        ) : (
          <Text style={{ fontSize: 16, fontWeight: '700', color: text }}>
            {MONTHS[viewMonth]} {viewYear}
          </Text>
        )}
        <TouchableOpacity onPress={nextMonth} style={{ padding: 4 }}>
          <Ionicons name="chevron-forward" size={20} color={text} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: textSecondary }}>
            {d}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={{ width: '14.28%', aspectRatio: 1 }} />;
          const cellDate = new Date(viewYear, viewMonth, day);
          cellDate.setHours(0, 0, 0, 0);
          const isSelected = value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === day;
          const isPast = cellDate < minDate;
          const isToday = cellDate.getTime() === today.getTime();
          const hasRelease = scheduledDates.some(({ date: d }) =>
            d.getFullYear() === viewYear && d.getMonth() === viewMonth && d.getDate() === day
          );
          return (
            <TouchableOpacity
              key={day}
              onPress={() => {
                if (isPast) return;
                const next = new Date(value);
                next.setFullYear(viewYear, viewMonth, day);
                onChange(next);
              }}
              style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={isPast ? 1 : 0.7}
            >
              <View style={{
                width: 34, height: 34,
                borderRadius: isSelected ? 17 : hasRelease ? 8 : 17,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSelected ? Colors.primary : hasRelease ? Colors.primary + '40' : 'transparent',
                borderWidth: isToday && !isSelected ? 1.5 : 0,
                borderColor: Colors.primary,
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: isSelected || isToday ? '700' : '400',
                  color: isSelected
                    ? Colors.textPrimary
                    : isPast
                    ? textSecondary + '55'
                    : text,
                }}>
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

type ReleaseMode = 'immediate' | 'scheduled';

type Props = {
  visible: boolean;
  onBack: () => void;
  scheduledDates?: ScheduledRelease[];
  initialTitle?: string;
  initialThumbnailUri?: string;
  initialReleaseDate?: Date;
  releaseDateLocked?: boolean;
  onComplete: (data: {
    title: string;
    thumbnailUri?: string;
    thumbnailBase64?: string;
    releaseDate?: Date;
  }) => void;
};

export default function FinalizeAudioSheet({ visible, onBack, onComplete, scheduledDates, initialTitle, initialThumbnailUri, initialReleaseDate, releaseDateLocked }: Props) {
  const { bg } = useTheme();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [thumbnailUri, setThumbnailUri] = useState<string | undefined>(initialThumbnailUri);
  const [thumbnailBase64, setThumbnailBase64] = useState<string | undefined>();
  const [releaseMode, setReleaseMode] = useState<ReleaseMode>('immediate');
  const [releaseDate, setReleaseDate] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setTitle(initialTitle ?? '');
      setThumbnailUri(initialThumbnailUri);
      setThumbnailBase64(undefined);
      if (initialReleaseDate) {
        setReleaseMode('scheduled');
        setReleaseDate(initialReleaseDate);
      } else {
        setReleaseMode('immediate');
        setReleaseDate(new Date());
      }
    }
  }, [visible]);

  const isComplete = title.trim().length > 0 && !!thumbnailUri;

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
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: Colors.primary }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              {t('finalize_audio.title')}
            </Text>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1 px-6 pt-6">
          {/* Thumbnail */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mb-3">
            {t('finalize_audio.thumbnail_label')}
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
                <Text className="text-text-secondary text-[13px] mt-2">{t('finalize_audio.upload_thumbnail')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Title */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-2">
            {t('finalize_audio.title_label')}
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('finalize_audio.title_placeholder')}
            placeholderTextColor={Colors.textSecondary}
            className="bg-surface rounded-2xl px-4 py-3.5 text-[15px] text-text-primary"
            autoCapitalize="sentences"
            autoCorrect={false}
            autoComplete="off"
          />

          {/* Release toggle */}
          <Text className="text-[12px] font-semibold text-text-secondary tracking-wider mt-6 mb-3">
            {t('finalize_audio.release_label')}
          </Text>
          {releaseDateLocked ? (
            <View className="bg-surface rounded-2xl px-4 py-3.5 flex-row items-center gap-3">
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
              <Text className="text-[14px] text-text-secondary">
                {t('finalize_audio.release_locked')}
              </Text>
            </View>
          ) : (
            <>
              <View className="bg-surface rounded-2xl p-1 flex-row">
                {(['immediate', 'scheduled'] as ReleaseMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => setReleaseMode(mode)}
                    className="flex-1 py-2.5 rounded-xl items-center"
                    style={{ backgroundColor: releaseMode === mode ? Colors.primary : 'transparent' }}
                  >
                    <Text
                      className="font-semibold text-[14px]"
                      style={{ color: releaseMode === mode ? Colors.textPrimary : Colors.textSecondary }}
                    >
                      {mode === 'immediate' ? t('finalize_audio.release_immediate') : t('finalize_audio.set_release')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {releaseMode === 'scheduled' && (
                <View className="mt-4 gap-3">
                  <InlineCalendar
                    value={releaseDate}
                    minDate={(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })()}
                    onChange={(date) => setReleaseDate(date)}
                    scheduledDates={scheduledDates}
                  />
                  <TouchableOpacity
                    onPress={() => setShowTimePicker(true)}
                    className="flex-row items-center bg-surface rounded-2xl px-4 py-3.5 gap-3"
                  >
                    <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                    <Text className="text-[15px] text-text-primary">{formatTime(releaseDate)}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          <View style={{ height: 80 }} />
        </ScrollView>

        <View style={{ backgroundColor: Colors.primary, flexDirection: 'row', height: 56 }}>
          <TouchableOpacity
            onPress={onBack}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
          </TouchableOpacity>
          <View style={{ width: 1, backgroundColor: Colors.primaryDark, marginVertical: 8 }} />
          <TouchableOpacity
            onPress={handleComplete}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: isComplete ? 1 : 0.4 }}
          >
            <Text className="font-medium text-[15px] text-text-primary">{t('finalize_audio.complete')}</Text>
            <Ionicons name="checkmark" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <TimePickerModal
        visible={showTimePicker}
        value={releaseDate}
        onCancel={() => setShowTimePicker(false)}
        onConfirm={(date) => { setReleaseDate(date); setShowTimePicker(false); }}
      />
    </Modal>
  );
}
