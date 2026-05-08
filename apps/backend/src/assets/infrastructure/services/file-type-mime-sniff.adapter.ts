import { Injectable } from "@nestjs/common";
import { fileTypeFromBuffer } from "file-type";

import { MimeSniffPort } from "@/assets/domain/services/mime-sniff.service.port";

@Injectable()
export class FileTypeMimeSniffAdapter extends MimeSniffPort {
  async sniff(bytes: Buffer): Promise<string | null> {
    const result = await fileTypeFromBuffer(bytes);
    return result?.mime ?? null;
  }
}
