/**
 * Stubbed dashboard overview hook for Slice 0. Task 16 wires this to the
 * real backend service via TanStack Query. Returning undefined data is safe
 * because consumers use optional chaining for the count badges.
 */
export function useDashboardOverview(): { data: undefined; isLoading: boolean } {
  return { data: undefined, isLoading: false };
}
