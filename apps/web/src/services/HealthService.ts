import { BaseService } from "./BaseService";

export class HealthService extends BaseService {
  private readonly healthPath = "/health";

  /**
   * Checks if the Backend service is healthy by verifying the HTTP status code.
   * - 200 = healthy
   * - 503 (Service Unavailable) = unhealthy
   * - Other 5xx = unhealthy
   * - Network errors (TypeError) = unhealthy
   */
  async isHealthy(signal?: AbortSignal): Promise<boolean> {
    try {
      const response = await this.getApiClient().health(this.getServiceUrl(this.healthPath), {
        signal,
      });

      // eslint-disable-next-line no-magic-numbers
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
