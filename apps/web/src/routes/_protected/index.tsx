import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/hooks/useAuth";
import {
  useDateFormat,
  useLanguage,
  useTheme,
  useUserPreferencesStore,
} from "@/hooks/useUserPreferences";

export const Route = createFileRoute("/_protected/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const theme = useTheme();
  const language = useLanguage();
  const dateFormat = useDateFormat();
  const { setTheme } = useUserPreferencesStore();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
          {t("dashboard.title")}
        </h1>
      </header>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-xl font-medium text-gray-900">
          {t("navigation.greeting")}
          {user?.name ? `, ${user.name}` : ""}
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-gray-500">Theme</dt>
            <dd className="text-base text-gray-900">{theme}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Language</dt>
            <dd className="text-base text-gray-900">{language}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Date format</dt>
            <dd className="text-base text-gray-900">{dateFormat}</dd>
          </div>
        </dl>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTheme(theme === "dark" ? "light" : "dark");
            }}
            className="rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800 hover:bg-gray-200"
          >
            Toggle theme
          </button>
        </div>
      </section>
    </div>
  );
}
