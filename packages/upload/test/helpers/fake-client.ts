import type {
  ICreateUploadIntentInput,
  ICreateUploadIntentResult,
  IRefreshUploadUrlResult,
} from "@lafken/client";

export interface IFakeClientOptions {
  /** Protocol to return from createUploadIntent. Default: "simple". */
  protocol?: "simple" | "tus";
  /**
   * How far in the future (ms from now) expiresAt should be on the initial
   * createUploadIntent response. Default: 3_600_000 (1 hour).
   */
  initialExpiresInMs?: number;
  /**
   * Verbatim `expiresAt` for the createUploadIntent response, bypassing
   * `initialExpiresInMs`. Use it to simulate a malformed/unparseable value.
   */
  initialExpiresAtRaw?: string;
  /**
   * How far in the future (ms from now) expiresAt should be on the
   * refreshUploadUrl response. Default: 3_600_000 (1 hour).
   */
  refreshExpiresInMs?: number;
  /** If set, refreshUploadUrl will reject with this error. */
  refreshError?: Error;
}

interface ICreateUploadIntentCall {
  input: ICreateUploadIntentInput;
  response: ICreateUploadIntentResult;
}

interface IRefreshUploadUrlCall {
  publicId: string;
  response: IRefreshUploadUrlResult;
}

export interface IFakeAssetsClient {
  createUploadIntent(input: ICreateUploadIntentInput): Promise<ICreateUploadIntentResult>;
  refreshUploadUrl(publicId: string): Promise<IRefreshUploadUrlResult>;
  confirmUpload(
    publicId: string,
    options?: unknown,
  ): Promise<{ publicId: string; state: string; storageKey: string }>;
}

export interface IFakeClient {
  assets: IFakeAssetsClient;
  createUploadIntentCalls: ICreateUploadIntentCall[];
  refreshUploadUrlCalls: IRefreshUploadUrlCall[];
}

let _counter = 0;

export function fakeClientFor(opts: IFakeClientOptions = {}): IFakeClient {
  const protocol = opts.protocol ?? "simple";
  const initialExpiresInMs = opts.initialExpiresInMs ?? 3_600_000;
  const refreshExpiresInMs = opts.refreshExpiresInMs ?? 3_600_000;

  const createUploadIntentCalls: ICreateUploadIntentCall[] = [];
  const refreshUploadUrlCalls: IRefreshUploadUrlCall[] = [];

  return {
    createUploadIntentCalls,
    refreshUploadUrlCalls,

    assets: {
      async createUploadIntent(
        input: ICreateUploadIntentInput,
      ): Promise<ICreateUploadIntentResult> {
        _counter += 1;
        const publicId = `fake-pub-${_counter}`;
        const response: ICreateUploadIntentResult = {
          publicId,
          protocol,
          uploadUrl:
            protocol === "tus"
              ? `http://tusd.fake/files/${publicId}`
              : `https://gcs.fake/upload/${publicId}`,
          uploadHeaders:
            protocol === "tus"
              ? { "Tus-Resumable": "1.0.0" }
              : { "x-goog-content-length-range": "0,10485760" },
          expiresAt:
            opts.initialExpiresAtRaw ?? new Date(Date.now() + initialExpiresInMs).toISOString(),
        };
        createUploadIntentCalls.push({ input, response });
        return response;
      },

      async refreshUploadUrl(publicId: string): Promise<IRefreshUploadUrlResult> {
        if (opts.refreshError) {
          throw opts.refreshError;
        }
        const response: IRefreshUploadUrlResult = {
          uploadUrl:
            protocol === "tus"
              ? `http://tusd.fake/files/${publicId}?refreshed`
              : `https://gcs.fake/upload/${publicId}?refreshed`,
          uploadHeaders:
            protocol === "tus"
              ? { "Tus-Resumable": "1.0.0" }
              : { "x-goog-content-length-range": "0,10485760" },
          expiresAt: new Date(Date.now() + refreshExpiresInMs).toISOString(),
        };
        refreshUploadUrlCalls.push({ publicId, response });
        return response;
      },

      async confirmUpload(
        publicId: string,
      ): Promise<{ publicId: string; state: string; storageKey: string }> {
        return { publicId, state: "confirmed", storageKey: `key/${publicId}` };
      },
    },
  };
}

export function fakeImageFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}
