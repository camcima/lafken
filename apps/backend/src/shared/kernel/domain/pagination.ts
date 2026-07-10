const MIN_PAGE_COUNT = 1;

/**
 * Computes the last page number for a paginated result.
 *
 * Guards against `limit <= 0`, which would otherwise yield
 * `Math.ceil(total / 0) === Infinity` (or a NaN for `0/0`), by clamping the
 * divisor to 1. DTO validation enforces `limit >= 1` at the HTTP boundary
 * (see `@shared/backend-api` pagination factory); this is defense in depth
 * for programmatic repository callers (implementation review F-D3).
 */
export function computeLastPage(total: number, limit: number): number {
  const safeLimit: number = Math.max(MIN_PAGE_COUNT, limit);
  return Math.max(MIN_PAGE_COUNT, Math.ceil(total / safeLimit));
}
