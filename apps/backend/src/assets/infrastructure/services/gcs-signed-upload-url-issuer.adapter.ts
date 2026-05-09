import { Injectable } from "@nestjs/common";

import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import {
  type IIssueUploadUrlInput,
  type IIssueUploadUrlResult,
  UploadUrlIssuerPort,
} from "@/assets/domain/services/upload-url-issuer.service.port";

@Injectable()
export class GcsSignedUploadUrlIssuer extends UploadUrlIssuerPort {
  constructor(private readonly storage: AssetStoragePort) {
    super();
  }

  async issue(input: IIssueUploadUrlInput): Promise<IIssueUploadUrlResult> {
    const signed = await this.storage.issueSignedUploadUrl({
      binding: input.binding,
      storageKey: input.storageKey,
      contentType: input.contentType,
      maxBytes: input.maxBytes,
      ttlSeconds: input.ttlSeconds,
    });
    return {
      protocol: "simple",
      uploadUrl: signed.url,
      uploadHeaders: signed.headers,
      expiresAt: signed.expiresAt,
    };
  }
}
