import i18n from "i18next";
import type { ReactNode } from "react";
import { I18nextProvider, initReactI18next } from "react-i18next";

import en from "@/lib/i18n/locales/en.json";

const testInstance = i18n.createInstance();
void testInstance.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={testInstance}>{children}</I18nextProvider>;
}
