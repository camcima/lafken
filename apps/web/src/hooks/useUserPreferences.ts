import { useStore } from "@/stores";

export const useUserPreferencesStore = () => {
  const userPreferences = useStore((state) => state.userPreferences);
  const setTheme = useStore((state) => state.setTheme);
  const setLanguage = useStore((state) => state.setLanguage);
  const setDateFormat = useStore((state) => state.setDateFormat);

  return {
    userPreferences,
    setTheme,
    setLanguage,
    setDateFormat,
  };
};

export const useTheme = () => useStore((state) => state.userPreferences.theme);
export const useLanguage = () => useStore((state) => state.userPreferences.language);
export const useDateFormat = () => useStore((state) => state.userPreferences.dateFormat);
