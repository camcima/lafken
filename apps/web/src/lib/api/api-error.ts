export interface ApiErrorBody {
  type?: string;
  code?: string;
  title?: string;
  status?: number;
  detail?: string;
  params?: Record<string, unknown>;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: ApiErrorBody;

  constructor(status: number, statusText: string, body: ApiErrorBody) {
    super(`API request failed: ${status} ${statusText}`);

    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}
