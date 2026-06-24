export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  success: string;
  warning: string;
  info: string;
  gradient1: string;
  gradient2: string;
  gradient3: string;
}

export interface ThemeConfig {
  name: string;
  label: string;
  colors: ThemeColors;
  radius: string;
  fontFamily: string;
}

export type ThemeName = 'light' | 'dark' | 'ocean' | 'forest' | 'sunset';
