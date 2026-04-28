import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AlarmData } from '../components/AlarmSheet';

export async function setupNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('alarms', {
    name: 'Alarms',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 500, 500, 500],
    enableVibrate: true,
    showBadge: false,
  });
}

// Converts stored alarm.hour + alarm.ampm to a 24h integer
function to24h(hour: number, ampm: 'AM' | 'PM'): number {
  if (ampm === 'AM') return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour > 12 ? hour : hour + 12;
}

export async function scheduleAlarmNotifications(
  alarm: AlarmData & { id: string }
): Promise<string[]> {
  const ids: string[] = [];
  const hour24 = to24h(alarm.hour, alarm.ampm);
  const { minute } = alarm;

  const content: Notifications.NotificationContentInput = {
    title: `⏰ ${alarm.channelName}`,
    body: 'Time to wake up! Tap to play.',
    data: {
      alarmId: alarm.id,
      channelId: alarm.channelId,
      channelName: alarm.channelName,
      channelImageUrl: alarm.channelImageUrl ?? null,
    },
    sound: 'default',
  };

  if (alarm.repeatDays.length === 0) {
    // One-time: next occurrence of this time
    const now = new Date();
    const target = new Date();
    target.setHours(hour24, minute, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target,
      },
    });
    ids.push(id);
  } else {
    // Weekly repeating: one notification per selected weekday
    for (const day of alarm.repeatDays) {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo: 1=Sun…7=Sat; JS: 0=Sun…6=Sat
          hour: hour24,
          minute,
        },
      });
      ids.push(id);
    }
  }

  return ids;
}

export async function cancelAlarmNotifications(notificationIds: string[]) {
  await Promise.all(
    notificationIds.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
}
