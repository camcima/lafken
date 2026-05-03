import { Link } from "@tanstack/react-router";
import React from "react";

import logoEmanttoAvif from "@/assets/logo-emantto.avif";
import logoEmantto from "@/assets/logo-emantto.png";
import { Toaster } from "@/components/feedback/Success/Sonner";
import { LanguageSwitcher } from "@/components/navigation/LanguageSwitcher";

interface MainLayoutProps {
  children: Readonly<React.ReactNode>;
}

/**
 * Main layout for authenticated users
 * Includes header with navigation and user menu
 */
export function MainLayout({ children }: Readonly<MainLayoutProps>) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-900 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2">
                <picture>
                  <source srcSet={logoEmanttoAvif} type="image/avif" />
                  <img
                    src={logoEmantto}
                    width={507}
                    height={75}
                    className="h-6 w-auto"
                    alt="eMantto - Latam"
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                  />
                </picture>
              </Link>

              <nav className="hidden space-x-6 md:flex"></nav>
            </div>

            <div className="flex items-center space-x-4">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <Toaster />
    </div>
  );
}
