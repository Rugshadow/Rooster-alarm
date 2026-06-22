import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  FlatList,
  NativeModules,
} from 'react-native';
import { Text } from './Text';
import AppAlert from './AppAlert';
import PrivacyPolicySheet from './PrivacyPolicySheet';
import TermsSheet from './TermsSheet';
import { useAppAlert } from '../hooks/useAppAlert';

const { IntentData } = NativeModules;

const FALLBACK_SOUNDS = [
  { id: 'alarm',         label: 'Classic'  },
  { id: 'alarm_beep',    label: 'Beep'     },
  { id: 'alarm_bells',   label: 'Battleship' },
  { id: 'alarm_chime',   label: 'Chime'    },
  { id: 'alarm_digital', label: 'Cricket'  },
  { id: 'alarm_gentle',  label: 'Arcade'   },
  { id: 'alarm_morning', label: 'Morning'  },
  { id: 'alarm_radar',   label: 'Radar'    },
  { id: 'alarm_ring',    label: 'Ring'     },
  { id: 'alarm_soft',    label: 'Trill'    },
];
import Slider from '@react-native-community/slider';
import { useAudioPlayer } from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTopInset } from '../hooks/useTopInset';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { useAlarmsContext } from '../contexts/AlarmsContext';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AccountSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const { signOut, username, session, isLoggedIn, timeFormat, setTimeFormat, colorScheme, setColorScheme, alarmVolume, setAlarmVolume, creatorMode, setCreatorMode, language, setLanguage } = useAuth();
  const { bg, surface, text, textSecondary } = useTheme();
  const { t } = useTranslation();
  const topPad = useTopInset();
  const { alarms, clearAllAlarms } = useAlarmsContext();
  const previewPlayer = useAudioPlayer(require('../assets/bell_chime.mp3'));
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sliderVolume, setSliderVolume] = useState(alarmVolume);
  const [uploadCount, setUploadCount] = useState(0);
  const [alarmCount, setAlarmCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const { showAlert, alertProps } = useAppAlert();
  const [selectedFallback, setSelectedFallback] = useState('alarm');
  const [previewingSound, setPreviewingSound] = useState<string | null>(null);
  const [fallbackExpanded, setFallbackExpanded] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);

  const LANGUAGE_CODES = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'bn', 'ru', 'pt', 'id', 'fil', 'vi'] as const;

  useEffect(() => {
    if (visible) {
      setSliderVolume(alarmVolume);
      if (session) fetchStats();
      IntentData?.getFallbackSound?.().then((s: string) => setSelectedFallback(s)).catch(() => {});
    } else {
      IntentData?.stopFallbackPreview?.().catch(() => {});
      setPreviewingSound(null);
      setFallbackExpanded(false);
    }
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

  const extractStoragePath = (url: string, bucket: string) => {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    return idx >= 0 ? decodeURIComponent(url.slice(idx + marker.length)) : null;
  };

  const performDeleteAccount = async () => {
    if (!session) return;
    setDeleting(true);
    const userId = session.user.id;
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('channels')
        .eq('user_id', userId)
        .single();

      const channelIds: string[] = (userData as any)?.channels ?? [];

      const [audioResult, channelResult] = await Promise.all([
        channelIds.length > 0
          ? supabase.from('audio_files').select('audio_file, cover_photo').in('channel_id', channelIds)
          : Promise.resolve({ data: [] }),
        channelIds.length > 0
          ? supabase.from('channels').select('cover_photo').in('channel_id', channelIds)
          : Promise.resolve({ data: [] }),
      ]);

      const audioFiles = audioResult.data ?? [];
      const channels = channelResult.data ?? [];

      const audioPaths = audioFiles
        .map((f: any) => f.audio_file ? extractStoragePath(f.audio_file, 'audio-files') : null)
        .filter(Boolean) as string[];
      const thumbPaths = audioFiles
        .map((f: any) => f.cover_photo ? extractStoragePath(f.cover_photo, 'audio-thumbnails') : null)
        .filter(Boolean) as string[];
      const coverPaths = channels
        .map((c: any) => c.cover_photo ? extractStoragePath(c.cover_photo, 'channel-covers') : null)
        .filter(Boolean) as string[];

      await Promise.all([
        audioPaths.length > 0 ? supabase.storage.from('audio-files').remove(audioPaths) : Promise.resolve(),
        thumbPaths.length > 0 ? supabase.storage.from('audio-thumbnails').remove(thumbPaths) : Promise.resolve(),
        coverPaths.length > 0 ? supabase.storage.from('channel-covers').remove(coverPaths) : Promise.resolve(),
      ]);

      if (channelIds.length > 0) {
        await supabase.from('audio_files').delete().in('channel_id', channelIds);
        await supabase.from('channels').delete().in('channel_id', channelIds);
      }

      await supabase.from('users').delete().eq('user_id', userId);
      await supabase.rpc('delete_own_account');

      signOut();
      onClose();
    } catch (e: any) {
      setDeleting(false);
      showAlert(t('common.error'), e.message ?? t('account.failed_delete'));
    }
  };

  const handleDeleteAllAlarms = () => {
    if (alarms.length === 0) {
      showAlert(t('account.no_alarms_title'), t('account.no_alarms_msg'));
      return;
    }
    showAlert(
      t('account.delete_alarms_title'),
      t('account.delete_alarms_msg', { count: alarms.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('account.delete_all'), style: 'destructive', onPress: clearAllAlarms },
      ]
    );
  };

  const handleDeleteAccount = () => {
    showAlert(
      t('account.delete_account_title'),
      t('account.delete_account_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: performDeleteAccount },
      ]
    );
  };

  const handleSelectFallback = async (id: string) => {
    setSelectedFallback(id);
    setPreviewingSound(id);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    await IntentData?.setFallbackSound?.(id).catch(() => {});
    await IntentData?.previewFallbackSound?.(id).catch(() => {});
    fallbackTimerRef.current = setTimeout(async () => {
      await IntentData?.stopFallbackPreview?.().catch(() => {});
      setPreviewingSound(null);
    }, 3000);
  };

  return (
    <>
    <PrivacyPolicySheet visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />
    <TermsSheet visible={termsVisible} onClose={() => setTermsVisible(false)} />
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <AppAlert {...alertProps} />
      <SafeAreaView className="flex-1" style={{ backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={[]} style={{ backgroundColor: Colors.primary, paddingTop: topPad }}>
          <View className="px-6 pt-2 pb-3">
            <Text className="text-[17px] font-semibold text-text-primary text-center">
              {username ? `${username}'s Settings` : t('account.title')}
            </Text>
          </View>
        </SafeAreaView>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>

          {!isLoggedIn && (
            <View style={{ gap: 12, marginTop: 8, marginBottom: 8 }}>
              <TouchableOpacity
                onPress={() => { onClose(); router.push('/auth/login'); }}
                style={{ backgroundColor: Colors.primary, borderRadius: 100, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.textPrimary }}>{t('common.log_in')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { onClose(); router.push('/auth/signup'); }}
                style={{ backgroundColor: surface, borderRadius: 100, paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: text }}>{t('auth.create_account')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {isLoggedIn && (
          <View className="flex-row mt-0 rounded-2xl overflow-hidden" style={{ backgroundColor: surface }}>
            {[
              { label: t('account.uploads'), value: uploadCount },
              { label: t('account.alarms'), value: alarmCount },
              { label: t('account.favorites'), value: savedCount },
            ].map(({ label, value }, i) => (
              <View
                key={label}
                className={`flex-1 items-center py-4 ${i < 2 ? 'border-r border-gray-200' : ''}`}
              >
                <Text className="text-[20px] font-bold" style={{ color: text }}>{value}</Text>
                <Text className="text-[13px] mt-0.5" style={{ color: textSecondary }}>{label}</Text>
              </View>
            ))}
          </View>
          )}

          <Text className="text-[12px] font-semibold tracking-wider mt-6 mb-3" style={{ color: textSecondary }}>
            {t('account.settings_label')}
          </Text>

          <View className="rounded-2xl px-4 pt-3 pb-2 mb-4" style={{ backgroundColor: surface }}>
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-[13px] font-medium" style={{ color: textSecondary }}>{t('account.alarm_volume')}</Text>
              <Text className="text-[13px] font-semibold" style={{ color: text }}>{Math.round(sliderVolume * 100)}%</Text>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={1}
              value={sliderVolume}
              onValueChange={setSliderVolume}
              onSlidingComplete={(vol) => {
                setAlarmVolume(vol);
                if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
                previewPlayer.volume = vol;
                previewPlayer.seekTo(0);
                previewPlayer.play();
                previewTimerRef.current = setTimeout(() => previewPlayer.pause(), 2000);
              }}
              minimumTrackTintColor={Colors.primary}
              maximumTrackTintColor={textSecondary}
              thumbTintColor={Colors.primary}
              style={{ height: 36 }}
            />
          </View>

          <View className="rounded-2xl p-1 flex-row mb-4" style={{ backgroundColor: surface }}>
            {(['standard', 'military'] as const).map((fmt) => (
              <TouchableOpacity
                key={fmt}
                onPress={() => setTimeFormat(fmt)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: timeFormat === fmt ? bg : 'transparent',
                  shadowColor: timeFormat === fmt ? '#000' : 'transparent',
                  shadowOpacity: timeFormat === fmt ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: timeFormat === fmt ? 2 : 0,
                }}
              >
                <Text
                  className="font-medium text-[15px]"
                  style={{ color: timeFormat === fmt ? text : textSecondary }}
                >
                  {fmt === 'standard' ? t('account.hour_12') : t('account.hour_24')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="rounded-2xl p-1 flex-row mt-4 mb-6" style={{ backgroundColor: surface }}>
            {(['light', 'dark'] as const).map((scheme) => (
              <TouchableOpacity
                key={scheme}
                onPress={() => setColorScheme(scheme)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: colorScheme === scheme ? bg : 'transparent',
                  shadowColor: colorScheme === scheme ? '#000' : 'transparent',
                  shadowOpacity: colorScheme === scheme ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: colorScheme === scheme ? 2 : 0,
                }}
              >
                <Text
                  className="font-medium text-[15px]"
                  style={{ color: colorScheme === scheme ? text : textSecondary }}
                >
                  {scheme === 'light' ? t('account.light') : t('account.dark')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isLoggedIn && <Text className="text-[12px] font-semibold tracking-wider mt-6 mb-3" style={{ color: textSecondary }}>
            {t('account.creator_mode')}
          </Text>}
          {isLoggedIn && <View className="rounded-2xl p-1 flex-row mb-6" style={{ backgroundColor: surface }}>
            {([false, true] as const).map((on) => (
              <TouchableOpacity
                key={String(on)}
                onPress={() => setCreatorMode(on)}
                className="flex-1 py-2.5 rounded-xl items-center"
                style={{
                  backgroundColor: creatorMode === on ? bg : 'transparent',
                  shadowColor: creatorMode === on ? '#000' : 'transparent',
                  shadowOpacity: creatorMode === on ? 0.08 : 0,
                  shadowRadius: 4,
                  elevation: creatorMode === on ? 2 : 0,
                }}
              >
                <Text className="font-medium text-[15px]" style={{ color: creatorMode === on ? text : textSecondary }}>
                  {on ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>}

          <Text className="text-[12px] font-semibold tracking-wider mt-6 mb-2" style={{ color: textSecondary }}>
            {t('account.language_label')}
          </Text>
          <TouchableOpacity
            onPress={() => setLanguagePickerVisible(true)}
            className="rounded-2xl px-4 mb-6"
            style={{ backgroundColor: surface, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text style={{ fontSize: 15, color: text }}>{t(`languages.${language}`)}</Text>
            <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          <Text className="text-[12px] font-semibold tracking-wider mt-2 mb-1" style={{ color: textSecondary }}>
            {t('account.fallback_alarm')}
          </Text>
          <Text className="text-[12px] mb-3" style={{ color: textSecondary }}>
            {t('account.fallback_subtitle')}
          </Text>
          <View className="rounded-2xl overflow-hidden mb-12" style={{ backgroundColor: surface }}>
            {/* Selected row — always visible, toggles expand */}
            <TouchableOpacity
              onPress={() => setFallbackExpanded(e => !e)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 }}
            >
              <Ionicons name="radio-button-on" size={20} color={Colors.primary} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, color: text, fontSize: 15 }}>
                {FALLBACK_SOUNDS.find(s => s.id === selectedFallback)?.label ?? 'Classic'}
              </Text>
              <Ionicons name={fallbackExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={textSecondary} />
            </TouchableOpacity>

            {/* Expanded list */}
            {fallbackExpanded && FALLBACK_SOUNDS.map((sound, i) => (
              <TouchableOpacity
                key={sound.id}
                onPress={() => handleSelectFallback(sound.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderTopWidth: 1,
                  borderTopColor: bg,
                }}
              >
                <Ionicons
                  name={selectedFallback === sound.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedFallback === sound.id ? Colors.primary : textSecondary}
                  style={{ marginRight: 12 }}
                />
                <Text style={{ flex: 1, color: text, fontSize: 15 }}>{sound.label}</Text>
                {previewingSound === sound.id && (
                  <Ionicons name="volume-high-outline" size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => setPrivacyVisible(true)}
            className="rounded-full py-3.5 items-center mb-3"
            style={{ backgroundColor: surface }}
          >
            <Text className="font-semibold text-[15px]" style={{ color: textSecondary }}>{t('common.privacy_policy')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setTermsVisible(true)}
            className="rounded-full py-3.5 items-center mb-3"
            style={{ backgroundColor: surface }}
          >
            <Text className="font-semibold text-[15px]" style={{ color: textSecondary }}>Terms & Conditions</Text>
          </TouchableOpacity>

          {isLoggedIn && (
            <TouchableOpacity
              onPress={() => setAccountExpanded(e => !e)}
              className="rounded-full py-3.5 items-center mb-3 flex-row justify-center gap-2"
              style={{ backgroundColor: surface }}
            >
              <Text className="font-semibold text-[15px]" style={{ color: textSecondary }}>{t('account.account_section')}</Text>
              <Ionicons name={accountExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={textSecondary} />
            </TouchableOpacity>
          )}

          {isLoggedIn && accountExpanded && (
            <View className="rounded-2xl overflow-hidden mb-3" style={{ backgroundColor: surface }}>
              <TouchableOpacity
                onPress={() => { setAccountExpanded(false); signOut(); onClose(); }}
                style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: bg }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: text, textAlign: 'center' }}>{t('account.log_out')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setAccountExpanded(false); handleDeleteAllAlarms(); }}
                style={{ paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: bg }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: colorScheme === 'dark' ? '#FF6B6B' : Colors.destructive, textAlign: 'center' }}>{t('account.delete_alarms')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setAccountExpanded(false); handleDeleteAccount(); }}
                disabled={deleting}
                style={{ paddingHorizontal: 24, paddingVertical: 16 }}
              >
                {deleting
                  ? <ActivityIndicator size="small" color={colorScheme === 'dark' ? '#FF6B6B' : Colors.destructive} />
                  : <Text style={{ fontSize: 15, fontWeight: '600', color: colorScheme === 'dark' ? '#FF6B6B' : Colors.destructive, textAlign: 'center' }}>{t('account.delete_account')}</Text>
                }
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>

        <View style={{ backgroundColor: Colors.primary }}>
          <TouchableOpacity
            onPress={onClose}
            style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text className="font-medium text-[15px] text-text-primary">{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>

    <Modal visible={languagePickerVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLanguagePickerVisible(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['left', 'right']}>
        <SafeAreaView edges={[]} style={{ backgroundColor: Colors.primary, paddingTop: topPad }}>
          <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' }}>
              {t('account.language_label')}
            </Text>
          </View>
        </SafeAreaView>
        <FlatList
          data={LANGUAGE_CODES}
          keyExtractor={(item) => item}
          renderItem={({ item: code }) => (
            <TouchableOpacity
              onPress={() => { setLanguage(code); setLanguagePickerVisible(false); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 24,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: surface,
              }}
            >
              <Text style={{ fontSize: 16, color: language === code ? Colors.primary : text }}>
                {t(`languages.${code}`)}
              </Text>
              {language === code && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
            </TouchableOpacity>
          )}
        />
        <View style={{ backgroundColor: Colors.primary, height: 56 }}>
          <TouchableOpacity
            onPress={() => setLanguagePickerVisible(false)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            <Text style={{ fontWeight: '500', fontSize: 15, color: Colors.textPrimary }}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
    </>
  );
}
