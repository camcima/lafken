import * as net from "node:net";

import type {
  IVirusScanInput,
  IVirusScanResult,
} from "@/assets/domain/services/virus-scan.service.port";
import { VirusScanPort } from "@/assets/domain/services/virus-scan.service.port";

export interface IClamAvVirusScanAdapterOptions {
  host: string;
  port: number;
  timeoutMs: number;
  chunkSizeBytes: number;
}

const ANALYZER_NAME = "virus_scan";
const ANALYZER_VERSION = "clamav-instream-v1";
/** clamd's INSTREAM length prefix: 4-byte big-endian uint32 before each chunk. */
const INSTREAM_LENGTH_HEADER_BYTES = 4;

/**
 * Implementation of the clamd INSTREAM protocol over a plain TCP socket.
 *
 *   client -> "zINSTREAM\0"
 *   client -> [4-byte BE uint32 length][chunk]   (repeat 1..N times)
 *   client -> [4-byte BE uint32 zero]            (terminator)
 *   server -> "stream: OK\0"                     (clean)
 *           | "stream: <Sig> FOUND\0"            (infected)
 *           | "INSTREAM size limit exceeded. ERROR\0"
 *           | "<other> ERROR\0"                  (operational)
 *
 * We deliberately reach for `node:net` instead of an npm wrapper: the protocol
 * is small enough that the wrapper's connection-mgmt + CLI fallback aren't
 * worth the dependency, and we want clamd-only semantics — never the slower,
 * sig-reloading-per-call clamscan binary.
 */
export class ClamAvVirusScanAdapter extends VirusScanPort {
  constructor(private readonly options: IClamAvVirusScanAdapterOptions) {
    super();
  }

  async scan(input: IVirusScanInput): Promise<IVirusScanResult> {
    const response: string = await this.sendInstream(input.bytes);
    const trimmed: string = response.replace(/\0+$/u, "").trim();

    // Operational error from clamd — surface as transient so the worker can
    // retry instead of mis-classifying the asset.
    if (trimmed.endsWith("ERROR")) {
      throw new Error(`clamd reported error: ${trimmed}`);
    }

    if (trimmed === "stream: OK") {
      return {
        decision: "pass",
        reason: null,
        analyzer: ANALYZER_NAME,
        analyzerVersion: ANALYZER_VERSION,
        findings: {
          step: "virus_scan",
          adapter: "clamav",
          adapter_version: ANALYZER_VERSION,
          decision: "pass",
          signature: null,
          content_hash_hex: input.contentHash?.toString("hex") ?? null,
          size_bytes: input.bytes.length,
          raw_response: trimmed,
        },
      };
    }

    // Infected: "stream: <Signature> FOUND"
    const found = /^stream:\s+(.+)\s+FOUND$/u.exec(trimmed);
    if (found) {
      const signature: string = found[1] ?? "unknown";
      return {
        decision: "quarantine",
        reason: `virus_detected:${signature}`,
        analyzer: ANALYZER_NAME,
        analyzerVersion: ANALYZER_VERSION,
        findings: {
          step: "virus_scan",
          adapter: "clamav",
          adapter_version: ANALYZER_VERSION,
          decision: "quarantine",
          signature,
          content_hash_hex: input.contentHash?.toString("hex") ?? null,
          size_bytes: input.bytes.length,
          raw_response: trimmed,
        },
      };
    }

    // Anything else is unexpected — better to fail loud than silently pass.
    throw new Error(`clamd returned unexpected response: ${trimmed}`);
  }

  /**
   * Sends the bytes via INSTREAM and resolves with the raw response string.
   * Rejects on connection errors, timeouts, or premature socket closure.
   */
  private sendInstream(bytes: Buffer): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const socket: net.Socket = net.createConnection({
        host: this.options.host,
        port: this.options.port,
      });
      socket.setTimeout(this.options.timeoutMs);

      const chunks: Buffer[] = [];
      let settled: boolean = false;
      const settle = (fn: () => void): void => {
        if (settled) return;
        settled = true;
        fn();
      };

      socket.on("connect", () => {
        socket.write("zINSTREAM\0");
        const chunkSize: number = this.options.chunkSizeBytes;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          const slice: Buffer = bytes.subarray(offset, offset + chunkSize);
          const lengthHeader: Buffer = Buffer.alloc(INSTREAM_LENGTH_HEADER_BYTES);
          lengthHeader.writeUInt32BE(slice.length, 0);
          socket.write(lengthHeader);
          socket.write(slice);
        }
        // Zero-length terminator tells clamd we're done streaming.
        const terminator: Buffer = Buffer.alloc(INSTREAM_LENGTH_HEADER_BYTES);
        terminator.writeUInt32BE(0, 0);
        socket.write(terminator);
      });

      socket.on("data", (data: Buffer) => {
        chunks.push(data);
      });

      socket.on("end", () => {
        settle(() => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      });

      socket.on("timeout", () => {
        settle(() => {
          socket.destroy();
          reject(new Error(`clamd timed out after ${String(this.options.timeoutMs)}ms`));
        });
      });

      socket.on("error", (err: Error) => {
        settle(() => {
          socket.destroy();
          reject(err);
        });
      });

      socket.on("close", (hadError: boolean) => {
        settle(() => {
          if (hadError || chunks.length === 0) {
            reject(new Error("clamd closed the connection without responding"));
          } else {
            resolve(Buffer.concat(chunks).toString("utf8"));
          }
        });
      });
    });
  }
}
