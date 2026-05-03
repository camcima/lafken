import type { StateCreator } from "zustand";

import { defaultUserPreferences } from "@/stores/default-state";
import type { Store, StoreActions, UserPreferencesActions } from "@/stores/types";

export const createUserPreferencesSlice: StateCreator<
  Store & StoreActions,
  [["zustand/immer", never]],
  [],
  Pick<Store, "userPreferences"> & UserPreferencesActions
> = (set) => ({
  userPreferences: defaultUserPreferences,

  setTheme: (theme) => {
    set((state) => {
      state.userPreferences.theme = theme;
    });
  },

  setLanguage: (language) => {
    set((state) => {
      state.userPreferences.language = language;
    });
  },

  setDateFormat: (dateFormat) => {
    set((state) => {
      state.userPreferences.dateFormat = dateFormat;
    });
  },
});
