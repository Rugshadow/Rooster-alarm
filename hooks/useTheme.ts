import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/colors';

export function useTheme() {
  const { colorScheme } = useAuth();
  const dark = colorScheme === 'dark';
  return {
    bg: dark ? Colors.darkBackground : Colors.background,
    surface: dark ? Colors.darkSurface : Colors.surface,
    text: dark ? '#E5E5E5' : Colors.textPrimary,
    textSecondary: dark ? '#9E9E9E' : Colors.textSecondary,
    isDark: dark,
  };
}
