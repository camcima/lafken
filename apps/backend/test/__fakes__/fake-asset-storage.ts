import {
  AssetStoragePort,
  type IIssueSignedUploadUrlInput,
  type IIssueSignedUploadUrlResult,
  type IObjectExistsInput,
} from "@/assets/domain/services/asset-storage.service.port";

const DEFAULT_TTL_MS = 900_000;

export class FakeAssetStorage extends AssetStoragePort {
  readonly issued: IIssueSignedUploadUrlInput[] = [];
  readonly existsCalls: IObjectExistsInput[] = [];
  existsResult = true;

  issueSignedUploadUrl(input: IIssueSignedUploadUrlInput): Promise<IIssueSignedUploadUrlResult> {
    this.issued.push(input);
    return Promise.resolve({
      url: `https://fake-gcs.local/upload/${encodeURIComponent(input.storageKey)}?sig=stub`,
      headers: {
        "Content-Type": input.contentType,
        "x-goog-content-length-range": `0,${input.maxBytes.toString()}`,
      },
      expiresAt: new Date(Date.now() + DEFAULT_TTL_MS),
    });
  }

  objectExists(input: IObjectExistsInput): Promise<boolean> {
    this.existsCalls.push(input);
    return Promise.resolve(this.existsResult);
  }
}
