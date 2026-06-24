import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { ThemeContext } from './ThemeContext';
import { themes, defaultTheme } from './themes';
import type { ThemeName, ThemeColors } from './types';

const THEME_STORAGE_KEY = 'vibeloop-theme';

function applyThemeToDOM(themeName: ThemeName) {
  const theme = themes[themeName];
  if (!theme) return;

  const root = document.documentElement;

  // Apply each color as a CSS variable
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });

  root.style.setProperty('--radius', theme.radius);
  root.style.setProperty('--font-family', theme.fontFamily);

  // Set data attribute for theme-aware Tailwind classes
  root.setAttribute('data-theme', themeName);

  // Remove all theme classes and add current
  root.classList.remove('light', 'dark', 'ocean', 'forest', 'sunset');
  root.classList.add(themeName === 'light' ? 'light' : 'dark');
}

function getStoredTheme(): ThemeName {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && stored in themes) {
      return stored as ThemeName;
    }
  } catch {
    // localStorage not available
  }
  return defaultTheme;
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeName;
}

export function ThemeProvider({ children, defaultTheme: propDefault }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return getStoredTheme() || propDefault || defaultTheme;
  });

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // localStorage not available
    }
    applyThemeToDOM(newTheme);
  }, []);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
