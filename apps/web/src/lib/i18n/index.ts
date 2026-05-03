import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { getRuntimeValue } from "@/config/app-config";

import en from "./locales/en.json";
import es from "./locales/es.json";
import pt from "./locales/pt.json";

const resources = {
  en: { translation: en },
  es: { translation: es },
  pt: { translation: pt },
};

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_YEAR = 365;
const COOKIE_EXPIRY_MINUTES = MINUTES_PER_HOUR * HOURS_PER_DAY * DAYS_PER_YEAR;

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "es",
    supportedLngs: Object.keys(resources),
    detection: {
      order: ["cookie", "navigator", "htmlTag"],
      caches: ["cookie"],
      lookupCookie: "i18nextLng",
      cookieMinutes: COOKIE_EXPIRY_MINUTES,
      cookieOptions: { path: "/", sameSite: "lax", secure: true },
    },
    interpolation: {
      escapeValue: false,
    },
    debug: getRuntimeValue("ENVIRONMENT") === "intg",
    react: {
      useSuspense: false,
    },
  });
