import {
  type IAsset,
  type IConfirmUploadOptions,
  type ICreateUploadIntentInput,
  type ICreateUploadIntentResult,
  type ILafkenClientOptions,
  type IProblemDetails,
  LafkenApiError,
} from "./types";

export class LafkenClient {
  constructor(private readonly opts: ILafkenClientOptions) {}

  async createUploadIntent(input: ICreateUploadIntentInput): Promise<ICreateUploadIntentResult> {
    const response = await this.request("POST", "/v1/assets/upload-intents", input);
    return response as ICreateUploadIntentResult;
  }

  async confirmUpload(publicId: string, options?: IConfirmUploadOptions): Promise<IAsset> {
    const response = await this.request(
      "POST",
      `/v1/assets/${encodeURIComponent(publicId)}/confirm`,
      options ?? {},
    );
    return response as IAsset;
  }

  async getPreviewUrl(input: { publicId: string; preset: string }): Promise<string> {
    const base = this.opts.baseUrl.replace(/\/$/, "");
    const url = new URL(`${base}/v1/assets/${encodeURIComponent(input.publicId)}/preview-url`);
    url.searchParams.set("preset", input.preset);
    const response = (await this.request("GET", url.toString())) as { url: string };
    return response.url;
  }

  async getDownloadUrl(input: { publicId: string }): Promise<string> {
    const response = (await this.request(
      "GET",
      `/v1/assets/${encodeURIComponent(input.publicId)}/download-url`,
    )) as { url: string };
    return response.url;
  }

  async retryAssetProcessing(input: { publicId: string }): Promise<void> {
    await this.request(
      "POST",
      `/v1/assets/${encodeURIComponent(input.publicId)}/retry-processing`,
      {},
    );
  }

  private async request(method: string, pathOrUrl: string, body?: unknown): Promise<unknown> {
    const url = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : `${this.opts.baseUrl.replace(/\/$/, "")}${pathOrUrl}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (this.opts.getAuthToken) {
      const token = await this.opts.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      let problem: IProblemDetails | null = null;
      try {
        problem = JSON.parse(text) as IProblemDetails;
      } catch {
        // problem stays null if the body is not valid JSON
      }
      throw new LafkenApiError({
        status: response.status,
        problemDetails: problem,
        message:
          problem?.detail ?? problem?.title ?? `Request failed with status ${response.status}`,
      });
    }

    if (response.status === 204) return undefined;
    // Some endpoints (e.g. POST /retry-processing) return 200 with an empty
    // body — calling response.json() there would throw. Defensively read the
    // text first and only parse when there's something to parse.
    const text = await response.text();
    if (text.length === 0) return undefined;
    return JSON.parse(text);
  }
}
