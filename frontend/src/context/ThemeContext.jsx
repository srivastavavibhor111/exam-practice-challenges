import { createContext, useContext, useState, useEffect } from 'react';

/* ─── ThemeContext ───────────────────────────────────────────────────────────
   Central theme management for the entire application.

   LOGIC:
   1. On first visit  → detect system preference (prefers-color-scheme)
   2. User toggles    → save their choice to localStorage
   3. On return visit → restore their saved choice (overrides system)

   HOW THEME IS APPLIED:
   We set data-theme="light"|"dark" on <html>.
   All CSS tokens in tokens.css react to this attribute automatically.
   No inline styles, no class toggling on every component.
──────────────────────────────────────────────────────────────────────────── */

const ThemeContext = createContext(null);

const STORAGE_KEY = 'epc-theme';

function getInitialTheme() {
  // Check for previously saved preference first
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;

  // Fall back to system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  // Apply the theme attribute to <html> whenever theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for OS-level theme changes (only when user hasn't set a preference)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemChange = (e) => {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Only follow system if the user hasn't manually chosen
      if (!stored) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const value = {
    theme,        // 'light' | 'dark'
    toggleTheme,  // () => void
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook — components use this to access theme state
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
