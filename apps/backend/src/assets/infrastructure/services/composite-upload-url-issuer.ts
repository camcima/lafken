import { Injectable } from "@nestjs/common";

import { TusNotConfiguredError } from "@/assets/domain/errors/tus-not-configured.error";
import {
  type IIssueUploadUrlInput,
  type IIssueUploadUrlResult,
  UploadUrlIssuerPort,
} from "@/assets/domain/services/upload-url-issuer.service.port";

interface ICompositeOptions {
  gcs: UploadUrlIssuerPort;
}

/**
 * Routes upload-URL issuance by protocol. tus is descoped from v1.0: the
 * request DTO keeps accepting `protocol: "tus"` for forward compatibility,
 * but issuance always fails with TusNotConfiguredError (422).
 */
@Injectable()
export class CompositeUploadUrlIssuer extends UploadUrlIssuerPort {
  constructor(private readonly issuers: ICompositeOptions) {
    super();
  }

  async issue(input: IIssueUploadUrlInput): Promise<IIssueUploadUrlResult> {
    if (input.protocol === "tus") {
      throw new TusNotConfiguredError();
    }
    return this.issuers.gcs.issue(input);
  }
}
