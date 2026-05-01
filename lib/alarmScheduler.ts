import { NativeModules, Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';
import type { AlarmData } from '../components/AlarmSheet';

const { AlarmClock } = NativeModules;

export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await notifee.deleteChannel('alarms').catch(() => {});
  await notifee.createChannel({
    id: 'alarm_clock',
    name: 'Alarm Clock',
    importance: AndroidImportance.HIGH,
    sound: 'alarm',
    vibration: true,
    vibrationPattern: [500, 500],
    bypassDnd: true,
  });
}

function nextOccurrence(dayOfWeek: number, hour24: number, minute: number): Date {
  const now = new Date();
  const target = new Date();
  target.setHours(hour24, minute, 0, 0);
  const daysUntil = (dayOfWeek - now.getDay() + 7) % 7;
  target.setDate(target.getDate() + (daysUntil === 0 && target <= now ? 7 : daysUntil));
  return target;
}

export async function scheduleAlarmNotifications(
  alarm: AlarmData & { id: string }
): Promise<string[]> {
  console.log('[alarm] AlarmClock module:', AlarmClock ? 'AVAILABLE' : 'MISSING');
  if (Platform.OS !== 'android' || !AlarmClock) {
    console.warn('[alarm] AlarmClock native module not available');
    return [];
  }

  const ids: string[] = [];
  const hour24 = alarm.hour; // already 24-hour from AlarmSheet.handleSave
  const data = {
    channelId: alarm.channelId,
    channelName: alarm.channelName,
    channelImageUrl: alarm.channelImageUrl ?? '',
  };

  if (alarm.repeatDays.length === 0) {
    const now = new Date();
    const target = new Date();
    target.setHours(hour24, alarm.minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    console.log('[alarm] scheduling via setAlarmClock for:', target.toISOString());
    const id = await AlarmClock.scheduleAlarm(alarm.id, target.getTime(), data);
    console.log('[alarm] scheduled id:', id);
    ids.push(id);
  } else {
    for (const day of alarm.repeatDays) {
      const target = nextOccurrence(day, hour24, alarm.minute);
      const alarmId = `${alarm.id}_${day}`;
      console.log('[alarm] scheduling repeat day', day, 'for:', target.toISOString());
      const id = await AlarmClock.scheduleAlarm(alarmId, target.getTime(), data);
      ids.push(id);
    }
  }

  return ids;
}

export async function cancelAlarmNotifications(notificationIds: string[]) {
  if (!AlarmClock) return;
  await Promise.all(
    notificationIds.map((id) => AlarmClock.cancelAlarm(id).catch(() => {}))
  );
}
