import type { ILafkenClientOptions } from "./types";
import { Transport } from "./transport";
import { AssetsClient } from "./sub-clients/assets-client";

export class LafkenClient {
  readonly assets: AssetsClient;

  constructor(opts: ILafkenClientOptions) {
    const transport = new Transport(opts);
    this.assets = new AssetsClient(transport);
  }
}
