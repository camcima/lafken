import { useState } from "react";
import { useTranslation } from "react-i18next";

import logoAvif from "@/assets/logo-latam-dark.avif";
import logo from "@/assets/logo-latam-dark.png";
import { BrandedScreen } from "@/components/common/BrandedScreen";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/hooks/useAuth";

interface LoginWelcomeProps {
  redirectPath?: string;
}

export function LoginWelcome({ redirectPath }: Readonly<LoginWelcomeProps>) {
  const { t } = useTranslation();
  const { login, isLoading } = useAuth();
  const [hasLoginError, setHasLoginError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setIsSubmitting(true);
    setHasLoginError(false);
    try {
      await login(redirectPath);
    } catch {
      setHasLoginError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BrandedScreen>
      <picture>
        <source srcSet={logoAvif} type="image/avif" />
        <img
          src={logo}
          width={3301}
          height={1009}
          className="mb-8 h-10 w-auto"
          alt="LATAM"
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
      </picture>
      <h1 className="mb-5 text-3xl font-semibold tracking-tight">{t("auth.welcomeToLatam")}</h1>
      <h2 className="mb-5 text-xl font-semibold tracking-tight">{t("auth.toAccess")}</h2>

      {hasLoginError && (
        <div
          role="alert"
          className="mb-4 w-full rounded-md border border-red-200 bg-red-50 p-3 text-left"
        >
          <h3 className="text-sm font-medium text-red-800">{t("auth.errorTitle")}</h3>
          <p className="mt-1 text-sm text-red-700">{t("auth.loginFailed")}</p>
        </div>
      )}

      <Button
        type="button"
        variant="brand"
        onClick={() => {
          void handleLogin();
        }}
        disabled={isLoading || isSubmitting}
        className="h-12 w-full"
        aria-busy={isSubmitting || undefined}
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent motion-reduce:animate-none"
            />
            <span>{t("auth.loading")}</span>
          </>
        ) : (
          <span>{t("auth.login")}</span>
        )}
      </Button>

      <p className="mt-4 text-xs text-gray-500">{t("auth.terms")}</p>
    </BrandedScreen>
  );
}
