import { useEffect, useState } from 'react';
import * as api from '../services/api';
import type { UserPreferences } from '../services/api';

function applyTheme(theme: UserPreferences['theme']): void {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = theme === 'dark' || (theme !== 'light' && prefersDark);
  root.classList.toggle('dark', shouldBeDark);
}

// Fetches the persisted user preferences (server/services/MemoryService.ts) once on mount, applies
// the theme immediately, and re-applies it if the OS-level scheme changes while theme is 'system'.
// Exposed via ResearchSessionContext so SettingsDialog, and the research pipeline's reflectionEnabled
// default, can both read/write the same state without prop-drilling.
export function usePreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    api.fetchPreferences()
      .then(({ preferences: loaded }) => {
        setPreferences(loaded);
        applyTheme(loaded.theme);
      })
      .catch(err => console.error('Failed to load preferences:', err))
      .finally(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    if (preferences.theme !== 'system' && preferences.theme !== undefined) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(preferences.theme);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preferences.theme]);

  const updatePreferences = async (patch: UserPreferences) => {
    const { preferences: saved } = await api.savePreferences(patch);
    setPreferences(saved);
    if (patch.theme !== undefined) applyTheme(saved.theme);
    return saved;
  };

  return { preferences, isPreferencesLoaded: isLoaded, updatePreferences };
}
