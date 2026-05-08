import { MimeSniffPort } from "@/assets/domain/services/mime-sniff.service.port";

/**
 * In-memory mime sniff fake. By default returns whatever the test set via
 * `setResult(...)`. Set to `undefined` (the initial state) to simulate a
 * sniffer that couldn't recognize the bytes — the use case treats this as
 * "unknown" and falls back to the happy path.
 */
export class FakeMimeSniff extends MimeSniffPort {
  public readonly calls: Buffer[] = [];
  private result: string | null = null;

  setResult(mime: string | null): void {
    this.result = mime;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async sniff(bytes: Buffer): Promise<string | null> {
    this.calls.push(bytes);
    return this.result;
  }
}
