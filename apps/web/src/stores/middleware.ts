import { getRuntimeValue } from "@/config/app-config";

import { defaultStoreState } from "./default-state";
import type { Store } from "./types";

export const userPreferencesChangeListener = <T extends object>(config: T) => config;

export const userPreferencesPersistence = {
  name: "user-preferences-storage",
  version: 1,
  partialize: (state: Store) => ({
    userPreferences: state.userPreferences,
  }),
  migrate: (persistedState: unknown, version: number): Store => {
    if (version === 0) {
      return { ...defaultStoreState, ...(persistedState as Store) };
    }
    return persistedState as Store;
  },
};

export const devtoolsConfig = {
  enabled: getRuntimeValue("ENVIRONMENT") !== "prod",
  name: "user-preferences-store",
};
