export const PROBLEM_TYPE_PREFIX = "https://lafken.dev/problems/";

export function extractProblemTypeSuffix(typeUri: string | undefined | null): string | null {
  if (!typeUri) return null;
  return typeUri.startsWith(PROBLEM_TYPE_PREFIX) ? typeUri.slice(PROBLEM_TYPE_PREFIX.length) : null;
}
