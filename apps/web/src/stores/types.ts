export interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: "en" | "es" | "pt";
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY";
}

export interface UserPreferencesActions {
  setTheme: (theme: UserPreferences["theme"]) => void;
  setLanguage: (language: UserPreferences["language"]) => void;
  setDateFormat: (dateFormat: UserPreferences["dateFormat"]) => void;
}

export interface Store {
  userPreferences: UserPreferences;
  resetStore: () => void;
}

export type StoreActions = UserPreferencesActions;
