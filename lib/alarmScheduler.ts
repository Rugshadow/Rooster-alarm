export type AlarmConfig = {
  id: string;
  channelId: string;
  channelName: string;
  hour: number;
  minute: number;
  repeatDays: number[];
  audioUrl: string;
};

export async function scheduleAlarm(_config: AlarmConfig): Promise<void> {
  // Native alarm scheduling via react-native-alarm-notification
  // Will be implemented when native module is linked
}

export async function cancelAlarm(_alarmId: string): Promise<void> {
  // Cancel alarm via react-native-alarm-notification
}
