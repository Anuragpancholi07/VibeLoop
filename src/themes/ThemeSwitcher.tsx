import { useTheme } from './ThemeContext';
import { themes, themeNames } from './themes';
import type { ThemeName } from './types';
import { Palette, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
        aria-label="Switch theme"
      >
        <Palette className="w-5 h-5 text-foreground" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-48 rounded-xl border border-border bg-card p-2 shadow-xl"
          >
            <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Theme
            </p>
            {themeNames.map((name) => (
              <ThemeOption
                key={name}
                name={name}
                isActive={theme === name}
                onClick={() => {
                  setTheme(name);
                  setIsOpen(false);
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThemeOption({
  name,
  isActive,
  onClick,
}: {
  name: ThemeName;
  isActive: boolean;
  onClick: () => void;
}) {
  const themeConfig = themes[name];
  const primaryHSL = `hsl(${themeConfig.colors.primary})`;
  const accentHSL = `hsl(${themeConfig.colors.accent})`;
  const bgHSL = `hsl(${themeConfig.colors.background})`;

  return (
    <button
      onClick={onClick}
      className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isActive ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/50 text-foreground'
      }`}
    >
      <div className="flex items-center gap-1">
        <div
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: bgHSL }}
        />
        <div
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: primaryHSL }}
        />
        <div
          className="w-4 h-4 rounded-full border border-border/50"
          style={{ backgroundColor: accentHSL }}
        />
      </div>
      <span className="text-sm font-medium flex-1 text-left">{themeConfig.label}</span>
      {isActive && <Check className="w-4 h-4 text-primary" />}
    </button>
  );
}
