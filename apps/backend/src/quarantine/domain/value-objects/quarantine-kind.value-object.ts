export const QUARANTINE_KINDS = ["virus", "moderation"] as const;
export type QuarantineKind = (typeof QUARANTINE_KINDS)[number];
