import { createFileRoute } from "@tanstack/react-router";

import { sanitizeRedirectPath } from "@/lib/auth/validateRedirect";
import LoginPage from "@/pages/LoginPage";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: sanitizeRedirectPath(search.redirect),
    };
  },
});
