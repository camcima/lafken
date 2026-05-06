export const PROCESSING_JOB_STATES = ["released", "claimed", "completed", "failed"] as const;
export type ProcessingJobState = (typeof PROCESSING_JOB_STATES)[number];
