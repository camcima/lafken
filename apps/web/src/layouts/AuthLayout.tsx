import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Layout for authentication pages (login, register, forgot password)
 * Clean, centered design focused on the auth form
 */
export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          {/* LATAM Logo */}
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
              <span className="text-xl font-bold text-white">L</span>
            </div>
            <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Lafken</h2>
          </div>

          {/* Auth Form Content */}
          <div className="rounded-lg bg-white px-6 py-8 shadow-md">{children}</div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500">
            <p>© 2025 LATAM Airlines. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
