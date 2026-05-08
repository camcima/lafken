/**
 * Sniffs the actual MIME type of a byte buffer by inspecting its magic bytes.
 * Returns null when the bytes don't match any known signature — callers
 * should treat null as "unknown" and decide whether to fail-open or
 * fail-closed in their own context.
 */
export abstract class MimeSniffPort {
  abstract sniff(bytes: Buffer): Promise<string | null>;
}
