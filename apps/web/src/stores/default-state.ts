import type { UserPreferences } from "./types";

export const defaultUserPreferences: UserPreferences = {
  theme: "system",
  language: "en",
  dateFormat: "DD/MM/YYYY",
};

export const defaultStoreState = {
  userPreferences: defaultUserPreferences,
};
