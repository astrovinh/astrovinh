export const colors = {
  // Core
  black: '#000000',
  white: '#ffffff',

  // PRD brand palette (dark-mode-first)
  coral: '#FF6B6B',
  coralDark: '#E85555',
  amber: '#FFB347',
  lavender: '#B8A9E8',
  warmWhite: '#FFF9F5',
  rose: '#FFB3BA',
  green: '#6EE7B7',
  blue: '#93C5FD',

  // Dark backgrounds
  bg: '#0F0F1A',
  surface: '#1A1A2E',
  card: '#252540',
  cardBorder: '#333355',

  // Grays (light palette, kept for compatibility)
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray900: '#111827',

  // Status
  red400: '#f87171',
  red500: '#ef4444',
  blue500: '#3b82f6',

  // Text on dark backgrounds
  textPrimary: '#FFF9F5',
  textMuted: '#9CA3AF',
  textSubtle: '#6B7280',
} as const;

export const typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;
