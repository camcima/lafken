import { Injectable } from "@nestjs/common";

import { TusNotConfiguredError } from "@/assets/domain/errors/tus-not-configured.error";
import {
  type IIssueUploadUrlInput,
  type IIssueUploadUrlResult,
  UploadUrlIssuerPort,
} from "@/assets/domain/services/upload-url-issuer.service.port";

interface ICompositeOptions {
  gcs: UploadUrlIssuerPort;
  tusd: UploadUrlIssuerPort | null;
}

@Injectable()
export class CompositeUploadUrlIssuer extends UploadUrlIssuerPort {
  constructor(private readonly issuers: ICompositeOptions) {
    super();
  }

  async issue(input: IIssueUploadUrlInput): Promise<IIssueUploadUrlResult> {
    if (input.protocol === "tus") {
      if (!this.issuers.tusd) {
        throw new TusNotConfiguredError();
      }
      return this.issuers.tusd.issue(input);
    }
    return this.issuers.gcs.issue(input);
  }
}
