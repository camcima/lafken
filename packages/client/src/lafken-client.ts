import {
  type IAsset,
  type IConfirmUploadOptions,
  type ICreateUploadIntentInput,
  type ICreateUploadIntentResult,
  type ILafkenClientOptions,
  type IRefreshUploadUrlResult,
} from "./types";
import { Transport } from "./transport";

export class LafkenClient {
  private readonly transport: Transport;

  constructor(opts: ILafkenClientOptions) {
    this.transport = new Transport(opts);
  }

  async createUploadIntent(input: ICreateUploadIntentInput): Promise<ICreateUploadIntentResult> {
    return this.transport.request<ICreateUploadIntentResult>(
      "POST",
      "/v1/assets/upload-intents",
      input,
    );
  }

  async refreshUploadUrl(publicId: string): Promise<IRefreshUploadUrlResult> {
    return this.transport.request<IRefreshUploadUrlResult>(
      "POST",
      `/v1/assets/upload-intents/${encodeURIComponent(publicId)}/refresh-url`,
      {},
    );
  }

  async confirmUpload(publicId: string, options?: IConfirmUploadOptions): Promise<IAsset> {
    return this.transport.request<IAsset>(
      "POST",
      `/v1/assets/${encodeURIComponent(publicId)}/confirm`,
      options ?? {},
    );
  }

  async getPreviewUrl(input: { publicId: string; preset: string }): Promise<string> {
    const url = this.transport.buildUrl(
      `/v1/assets/${encodeURIComponent(input.publicId)}/preview-url`,
    );
    url.searchParams.set("preset", input.preset);
    const response = await this.transport.request<{ url: string }>("GET", url.toString());
    return response.url;
  }

  async getDownloadUrl(input: { publicId: string }): Promise<string> {
    const response = await this.transport.request<{ url: string }>(
      "GET",
      `/v1/assets/${encodeURIComponent(input.publicId)}/download-url`,
    );
    return response.url;
  }

  async retryAssetProcessing(input: { id: string }): Promise<void> {
    await this.transport.request(
      "POST",
      `/v1/assets/${encodeURIComponent(input.id)}/retry-processing`,
      {},
    );
  }
}
