import { Injectable } from "@nestjs/common";

import type { IIntegrationStatus } from "@/system/domain/services/integration-status-reader.service.port";
import { IntegrationStatusReader } from "@/system/domain/services/integration-status-reader.service.port";

const KNOWN_INTEGRATION_PORTS = [
  "storage",
  "authorization",
  "virus_scan",
  "content_moderation",
  "transformer",
  "event_publisher",
  "secrets",
] as const;

/**
 * Slice 0 stub: every port reports not_configured.
 *
 * Once the env-driven wiring lands in a later slice, this adapter will inspect
 * `environmentConfiguration` and report which adapters are bound for each port.
 * For now it always returns the same seven canonical integration ports with
 * status `not_configured` regardless of what is set in environment variables.
 */
@Injectable()
export class EnvironmentIntegrationStatusAdapter extends IntegrationStatusReader {
  read(): Promise<IIntegrationStatus[]> {
    return Promise.resolve(
      KNOWN_INTEGRATION_PORTS.map((port) => ({
        port,
        adapter: "not_configured",
        status: "not_configured" as const,
        detail: null,
      })),
    );
  }
}
