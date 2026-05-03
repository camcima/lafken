import type { ISystemHealthSnapshot } from "@/system/domain/services/system-health-reader.service.port";
import { SystemHealthReader } from "@/system/domain/services/system-health-reader.service.port";

const DEFAULT_SNAPSHOT: ISystemHealthSnapshot = {
  overall: "ok",
  indicators: [{ name: "database", status: "ok", detail: null }],
  integrations: [],
};

export class StaticSystemHealthReaderAdapter extends SystemHealthReader {
  private snapshot: ISystemHealthSnapshot = DEFAULT_SNAPSHOT;

  seed(snapshot: ISystemHealthSnapshot): void {
    this.snapshot = snapshot;
  }

  read(): Promise<ISystemHealthSnapshot> {
    return Promise.resolve(this.snapshot);
  }
}
