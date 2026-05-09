import { getRuntimeValue } from "@/config/app-config";

/**
 * Checks whether the backend is reachable and healthy.
 * Returns `true` if the /health endpoint responds with HTTP 200,
 * `false` for any other status or network error.
 */
export async function isBackendHealthy(signal?: AbortSignal): Promise<boolean> {
  try {
    const r = await fetch(`${getRuntimeValue("API_URL")}/health`, { method: "HEAD", signal });
    // eslint-disable-next-line no-magic-numbers
    return r.status === 200;
  } catch {
    return false;
  }
}
