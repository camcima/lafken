import { Navigate } from "@tanstack/react-router";

import Spinner from "@/components/common/Spinner";
import { useAuth } from "@/hooks/useAuth";
import { buildRedirectTarget } from "@/lib/auth/validateRedirect";

export default function NotFound() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50">
        <Spinner />
      </div>
    );
  }

  // Private by default: send unauthenticated visitors through the auth gate
  // even on unmatched routes, so route existence isn't enumerable. We read
  // globalThis.location directly because TanStack Router's useLocation()
  // inside notFoundComponent returns the matched-route location (root "/"),
  // not the actual unmatched URL the browser is on.
  if (!isAuthenticated) {
    const pathname = globalThis.location.pathname;
    const search = globalThis.location.search;
    return (
      <Navigate
        to="/auth/login"
        search={{ redirect: buildRedirectTarget(pathname, search) }}
        replace
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-4 text-6xl font-bold text-gray-900">404</h1>
        <h2 className="mb-4 text-2xl font-semibold text-gray-700">Página no encontrada</h2>
        <p className="mb-8 text-gray-600">La página que buscas no existe o ha sido movida.</p>
        <a
          href="/"
          className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
