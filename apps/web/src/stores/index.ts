/**
 * Main store implementation using slices pattern
 */
import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { defaultUserPreferences } from "./default-state";
import {
  devtoolsConfig,
  userPreferencesChangeListener,
  userPreferencesPersistence,
} from "./middleware";
import { createUserPreferencesSlice } from "./slices/user-preferences-slice";
import type { Store, StoreActions } from "./types";

export const useStore = create<Store & StoreActions>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer(
          userPreferencesChangeListener((set, get, store) => ({
            ...createUserPreferencesSlice(set, get, store),
            resetStore() {
              set((state) => {
                state.userPreferences = defaultUserPreferences;
              });
            },
          })),
        ),
      ),
      userPreferencesPersistence,
    ),
    devtoolsConfig,
  ),
);
