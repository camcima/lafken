import i18n from "i18next";
import type { ReactNode } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";

import en from "./locales/en.json";

const testInstance = i18n.createInstance();
void testInstance.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  // Mirror the production config: an empty translation must behave the same in
  // tests, or tests stay blind to keys that render as the raw key string.
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});

export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={testInstance}>{children}</I18nextProvider>;
}
