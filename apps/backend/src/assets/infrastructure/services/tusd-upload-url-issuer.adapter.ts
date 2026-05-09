import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import {
  type IIssueUploadUrlInput,
  type IIssueUploadUrlResult,
  UploadUrlIssuerPort,
} from "@/assets/domain/services/upload-url-issuer.service.port";

const MS_PER_SECOND = 1000;

interface ITusdIssuerOptions {
  endpointUrl: string;
  now?: () => Date;
}

@Injectable()
export class TusdUploadUrlIssuer extends UploadUrlIssuerPort {
  private readonly endpointUrl: string;
  private readonly now: () => Date;

  constructor(options: ITusdIssuerOptions) {
    super();
    this.endpointUrl = options.endpointUrl.endsWith("/")
      ? options.endpointUrl
      : `${options.endpointUrl}/`;
    this.now = options.now ?? ((): Date => new Date());
  }

  async issue(input: IIssueUploadUrlInput): Promise<IIssueUploadUrlResult> {
    const uploadId: string = randomUUID();
    const uploadUrl: string = `${this.endpointUrl}${uploadId}`;
    const expiresAt: Date = new Date(this.now().getTime() + input.ttlSeconds * MS_PER_SECOND);
    const metadata: string = encodeUploadMetadata({
      storageKey: input.storageKey,
      contentType: input.contentType,
      bucket: input.binding.bucket,
      projectId: input.binding.projectId,
    });
    return {
      protocol: "tus",
      uploadUrl,
      uploadHeaders: {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": input.maxBytes.toString(),
        "Upload-Metadata": metadata,
      },
      expiresAt,
    };
  }
}

function encodeUploadMetadata(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key} ${Buffer.from(value, "utf8").toString("base64")}`)
    .join(",");
}
