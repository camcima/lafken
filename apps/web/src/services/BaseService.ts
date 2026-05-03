import { getRuntimeValue } from "@/config/app-config";
import { apiClient } from "@/lib/api/client";

export abstract class BaseService {
  private readonly serviceUrl = getRuntimeValue("API_URL");
  private readonly defaultVersion = "v1";

  protected getServiceUrl(path: string, version: string = this.defaultVersion): string {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    return `${this.serviceUrl}/${version}${cleanPath}`;
  }

  protected getApiClient(): typeof apiClient {
    return apiClient;
  }
}
