import { LafkenClient } from "@lafken/client";

import { getRuntimeValue } from "@/config/app-config";
import { getAuthProvider } from "@/lib/auth/AuthProviderFactory";

let _client: LafkenClient | null = null;

export function getLafkenClient(): LafkenClient {
  if (_client) return _client;
  _client = new LafkenClient({
    baseUrl: getRuntimeValue("API_URL"),
    getAuthToken: async () => {
      const provider = await getAuthProvider();
      const token = await provider.getAccessToken();
      return token ?? null;
    },
  });
  return _client;
}
