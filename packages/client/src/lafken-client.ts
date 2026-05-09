import type { ILafkenClientOptions } from "./types";
import { Transport } from "./transport";
import { AssetsClient } from "./sub-clients/assets-client";
import { NamespacesClient } from "./sub-clients/namespaces-client";

export class LafkenClient {
  readonly assets: AssetsClient;
  readonly namespaces: NamespacesClient;

  constructor(opts: ILafkenClientOptions) {
    const transport = new Transport(opts);
    this.assets = new AssetsClient(transport);
    this.namespaces = new NamespacesClient(transport);
  }
}
