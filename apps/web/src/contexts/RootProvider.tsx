import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/contexts/AuthContext";
import { queryClient } from "@/lib/api/query-client";
import "@/lib/i18n";

export function getContext() {
  return {
    queryClient,
  };
}

export function Provider({
  children,
  queryClient,
}: Readonly<{
  children: React.ReactNode;
  queryClient: QueryClient;
}>) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
