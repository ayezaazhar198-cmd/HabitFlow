import React, { createContext, useContext, useMemo } from 'react';
import { useHabitStore } from './data/habit-store';
import type { ThemePreference } from './data/models';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const radii = {
  sm: 14,
  md: 20,
  lg: 26,
  xl: 32,
  pill: 999,
} as const;

export const typography = {
  caption: 12,
  footnote: 14,
  body: 16,
  title: 20,
  heading: 28,
  display: 34,
} as const;

const palettes = {
  light: {
    mode: 'light',
    colors: {
      background: '#F7FBFA',
      surface: '#FFFFFF',
      surfaceMuted: '#E8F6F1',
      text: '#172033',
      textSecondary: '#526477',
      textTertiary: '#526477',
      border: '#DDECE6',
      accent: '#16B879',
      accentStrong: '#087F5B',
      accentSoft: '#E4F6EF',
      accentOn: '#052E16',
      secondary: '#A78BFA',
      secondarySoft: '#EDE9FE',
      peach: '#FDBA9A',
      peachSoft: '#FFF0E8',
      highlight: '#FDE68A',
      highlightSoft: '#FEF9E7',
      success: '#15803D',
      danger: '#B42332',
      overlay: 'rgba(12, 15, 11, 0.56)',
    },
  },
  dark: {
    mode: 'dark',
    colors: {
      background: '#0D171D',
      surface: '#14232A',
      surfaceMuted: '#1A3034',
      text: '#F8FAFC',
      textSecondary: '#B4C7CC',
      textTertiary: '#AFC2C7',
      border: '#244047',
      accent: '#34D399',
      accentStrong: '#6EE7B7',
      accentSoft: '#173B39',
      accentOn: '#052E16',
      secondary: '#A78BFA',
      secondarySoft: '#242B3C',
      peach: '#FDBA9A',
      peachSoft: '#3B302C',
      highlight: '#FDE68A',
      highlightSoft: '#473D21',
      success: '#4ADE80',
      danger: '#FF777A',
      overlay: 'rgba(0, 0, 0, 0.72)',
    },
  },
} as const;

export type Theme = (typeof palettes)[keyof typeof palettes];
export type ThemeMode = keyof typeof palettes;

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  preference: ThemePreference;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const { data } = useHabitStore();
  const preference = data.settings.theme;
  const mode: ThemeMode = preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: palettes[mode],
      mode,
      preference,
    }),
    [mode, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }
  return context;
}
