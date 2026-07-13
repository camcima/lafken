import {
  AssetStoragePort,
  type IDeleteObjectInput,
  type IIssueSignedUploadUrlInput,
  type IIssueSignedUploadUrlResult,
  type IMoveObjectInput,
  type IObjectExistsInput,
  type IReadObjectBytesInput,
  type ISignReadUrlInput,
} from "@/assets/domain/services/asset-storage.service.port";

const DEFAULT_TTL_MS = 900_000;

export class FakeAssetStorage extends AssetStoragePort {
  readonly issued: IIssueSignedUploadUrlInput[] = [];
  readonly existsCalls: IObjectExistsInput[] = [];
  readonly readCalls: IReadObjectBytesInput[] = [];
  readonly readSigned: ISignReadUrlInput[] = [];
  readonly moveCalls: IMoveObjectInput[] = [];
  readonly deleteCalls: IDeleteObjectInput[] = [];
  readonly objects: Map<string, Buffer> = new Map();
  existsResult = true;
  existsError: Error | null = null;

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
    if (this.existsError) {
      return Promise.reject(this.existsError);
    }
    return Promise.resolve(this.existsResult || this.objects.has(input.storageKey));
  }

  readObjectBytes(input: IReadObjectBytesInput): Promise<Buffer> {
    this.readCalls.push(input);
    const bytes: Buffer | undefined = this.objects.get(input.storageKey);
    if (!bytes) {
      return Promise.reject(new Error(`Object "${input.storageKey}" does not exist`));
    }
    return Promise.resolve(bytes);
  }

  signReadUrl(input: ISignReadUrlInput): Promise<string> {
    this.readSigned.push(input);
    return Promise.resolve(
      `https://fake-gcs.local/read/${encodeURIComponent(input.storageKey)}?sig=stub`,
    );
  }

  signSourceUrlForRendering(input: ISignReadUrlInput): Promise<string> {
    this.readSigned.push(input);
    return Promise.resolve(
      `https://fake-gcs.local/render-source/${encodeURIComponent(input.storageKey)}?sig=stub`,
    );
  }

  deleteObject(input: IDeleteObjectInput): Promise<void> {
    this.deleteCalls.push(input);
    this.objects.delete(input.storageKey);
    return Promise.resolve();
  }

  moveObject(input: IMoveObjectInput): Promise<void> {
    this.moveCalls.push(input);
    if (input.fromKey === input.toKey) return Promise.resolve();
    const bytes: Buffer | undefined = this.objects.get(input.fromKey);
    if (bytes) {
      this.objects.set(input.toKey, bytes);
      this.objects.delete(input.fromKey);
      return Promise.resolve();
    }
    if (this.objects.has(input.toKey)) {
      // Idempotent already-moved case.
      return Promise.resolve();
    }
    return Promise.reject(
      new Error(`Object "${input.fromKey}" not found and "${input.toKey}" not in place.`),
    );
  }
}
