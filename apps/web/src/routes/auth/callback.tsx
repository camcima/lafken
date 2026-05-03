import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { getAuthProvider } from "@/lib/auth";

function AuthCallbackPage(): React.JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      const provider = await getAuthProvider();
      try {
        await provider.handleRedirectCallback();
        await navigate({ to: "/" });
      } catch {
        await navigate({ to: "/auth/login", search: { redirect: "/" } });
      }
    })();
  }, [navigate]);

  return <div className="p-6 text-sm text-neutral-500">Completing sign-in…</div>;
}

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});
