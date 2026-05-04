export interface IDashboardCounts {
  totalAssets: number;
  inFlight: number;
  queueDepth: number;
  quarantine: number;
  legalHolds: number;
  failedProcessing: number;
  namespaces: number;
}
