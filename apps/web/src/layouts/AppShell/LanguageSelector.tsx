import { Check, ChevronDown, Globe } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

interface ILanguage {
  code: "en" | "es" | "pt";
  short: string;
  labelKey: string;
  regionKey: string;
}

const LANGUAGES: ILanguage[] = [
  {
    code: "en",
    short: "EN",
    labelKey: "languages.en",
    regionKey: "languages.region.en",
  },
  {
    code: "es",
    short: "ES",
    labelKey: "languages.es",
    regionKey: "languages.region.es",
  },
  {
    code: "pt",
    short: "PT",
    labelKey: "languages.pt",
    regionKey: "languages.region.pt",
  },
];

export function LanguageSelector(): React.JSX.Element {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const currentCode = i18n.language as "en" | "es" | "pt";
  const current = LANGUAGES.find((lang) => lang.code === currentCode) ?? LANGUAGES[0];

  const selectLanguage = (code: "en" | "es" | "pt"): void => {
    void i18n.changeLanguage(code);
    try {
      localStorage.setItem("lafken.lang", code);
    } catch {
      // ignore storage errors
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent): void => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        title={t("languages.label")}
        aria-label={t("languages.label")}
        aria-expanded={open}
        className={cn(
          "bg-card text-muted-foreground hover:border-latam-indigo/30 hover:bg-secondary hover:text-latam-indigo inline-flex h-8 items-center gap-1.5 rounded border px-2 text-[12px] font-medium",
          open ? "border-latam-indigo/40 bg-secondary text-latam-indigo" : "border-border",
        )}
      >
        <Globe size={13} />
        <span className="font-mono tabular-nums">{current?.short ?? "EN"}</span>
        <ChevronDown size={10} className="opacity-60" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="border-border bg-card absolute top-10 right-0 z-50 w-[240px] overflow-hidden rounded-lg border shadow-2xl"
          style={{
            boxShadow: "0 20px 60px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.06)",
          }}
        >
          <div className="border-border bg-secondary/30 text-muted-foreground border-b px-3 py-2 text-[10.5px] font-medium tracking-wider uppercase">
            {t("languages.displayLanguage")}
          </div>
          <ul>
            {LANGUAGES.map((lang) => {
              const active = lang.code === currentCode;
              return (
                <li key={lang.code}>
                  <button
                    type="button"
                    onClick={() => {
                      selectLanguage(lang.code);
                    }}
                    className={cn(
                      "hover:bg-secondary/60 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                      active && "bg-latam-indigo/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-7 flex-none place-items-center rounded font-mono text-[10.5px] font-semibold",
                        active
                          ? "bg-latam-indigo text-white"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {lang.short}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-[12.5px]",
                          active ? "text-foreground font-semibold" : "text-foreground/90",
                        )}
                      >
                        {t(lang.labelKey)}
                      </span>
                      <span className="text-muted-foreground block text-[11px]">
                        {t(lang.regionKey)}
                      </span>
                    </span>
                    {active && <Check size={13} className="text-latam-indigo" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-border bg-secondary/30 text-muted-foreground border-t px-3 py-2 text-[10.5px]">
            {t("languages.perUserAuditLogged")}
          </div>
        </div>
      )}
    </div>
  );
}
