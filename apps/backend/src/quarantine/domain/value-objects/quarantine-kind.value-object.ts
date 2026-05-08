export const QUARANTINE_KINDS = ["virus", "moderation", "invalid_format"] as const;
export type QuarantineKind = (typeof QUARANTINE_KINDS)[number];
