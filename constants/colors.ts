export const Colors = {
  primary: '#BFDE30',
  primaryDark: '#8FA800',
  primaryLight: '#EEF5C0',
  background: '#FFFFFF',
  surface: '#F5F5F0',
  textPrimary: '#111111',
  textSecondary: '#888888',
  destructive: '#E53935',
  destructiveLight: '#FDECEA',
} as const;

export const CHANNEL_COLORS = [
  '#6C63FF', '#FF6584', '#43C6AC', '#F7971E',
  '#A18CD1', '#FF9A9E', '#38EF7D', '#667EEA',
  '#F093FB', '#4FACFE', '#43E97B', '#FA709A',
];

export function getChannelColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHANNEL_COLORS[Math.abs(hash) % CHANNEL_COLORS.length];
}
