import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { logger } from "@/lib/logger";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const STALE_TIME_MINUTES = 5;
const GC_TIME_MINUTES = 10;
const STALE_TIME_MS = STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
const GC_TIME_MS = GC_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;
const QUERY_MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const RETRY_MAX_DELAY_MS = 30000;
const MUTATION_RETRY_DELAY_MS = 1000;

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logger.error("Query error", error instanceof Error ? error : undefined, {
        queryKey: query.queryKey,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      logger.error("Mutation error", error instanceof Error ? error : undefined);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: GC_TIME_MS,
      retry: (failureCount, error: unknown) => {
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status >= HTTP_CLIENT_ERROR_MIN && status < HTTP_SERVER_ERROR_MIN) {
            return false;
          }
        }

        return failureCount < QUERY_MAX_RETRIES;
      },
      retryDelay: (attemptIndex) =>
        Math.min(RETRY_BASE_DELAY_MS * 2 ** attemptIndex, RETRY_MAX_DELAY_MS),
      refetchOnWindowFocus: import.meta.env.DEV,
      refetchOnReconnect: true,
      refetchOnMount: false,
    },
    mutations: {
      retry: 1,
      retryDelay: MUTATION_RETRY_DELAY_MS,
    },
  },
});
