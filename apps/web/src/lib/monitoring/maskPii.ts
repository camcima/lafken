export function maskEmail(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const at = value.indexOf("@");
  if (at < 1 || at === value.length - 1) return undefined;
  return `${value[0]}***${value.slice(at)}`;
}
