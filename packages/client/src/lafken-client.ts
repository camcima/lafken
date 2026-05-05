import {
  type IAsset,
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

  async confirmUpload(publicId: string): Promise<IAsset> {
    const response = await this.request(
      "POST",
      `/v1/assets/${encodeURIComponent(publicId)}/confirm`,
    );
    return response as IAsset;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}${path}`;
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
    return response.json();
  }
}
