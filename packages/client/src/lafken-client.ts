import { AssetsClient } from "./sub-clients/assets-client";
import { AuditClient } from "./sub-clients/audit-client";
import { DashboardClient } from "./sub-clients/dashboard-client";
import { LegalHoldsClient } from "./sub-clients/legal-holds-client";
import { NamespacesClient } from "./sub-clients/namespaces-client";
import { QuarantineClient } from "./sub-clients/quarantine-client";
import { SystemClient } from "./sub-clients/system-client";
import { Transport } from "./transport";
import type { ILafkenClientOptions } from "./types";

export class LafkenClient {
  readonly assets: AssetsClient;
  readonly audit: AuditClient;
  readonly dashboard: DashboardClient;
  readonly legalHolds: LegalHoldsClient;
  readonly namespaces: NamespacesClient;
  readonly quarantine: QuarantineClient;
  readonly system: SystemClient;

  constructor(opts: ILafkenClientOptions) {
    const transport = new Transport(opts);
    this.assets = new AssetsClient(transport);
    this.audit = new AuditClient(transport);
    this.dashboard = new DashboardClient(transport);
    this.legalHolds = new LegalHoldsClient(transport);
    this.namespaces = new NamespacesClient(transport);
    this.quarantine = new QuarantineClient(transport);
    this.system = new SystemClient(transport);
  }
}
