import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  IntegrationStatusResponseDTO,
  StorageBindingResponseDTO,
  SystemHealthResponseDTO,
} from "@shared/backend-api";

import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";
import { GetStorageBindingByNameUseCase } from "@/system/application/use-cases/get-storage-binding-by-name.use-case";
import { GetSystemHealthUseCase } from "@/system/application/use-cases/get-system-health.use-case";
import { ListIntegrationsUseCase } from "@/system/application/use-cases/list-integrations.use-case";
import { ListStorageBindingsUseCase } from "@/system/application/use-cases/list-storage-bindings.use-case";
import { StorageBindingNotFoundError } from "@/system/domain/errors/storage-binding-not-found.error";

import { IntegrationStatusResponseMapper } from "../mappers/integration-status.response-mapper";
import { StorageBindingResponseMapper } from "../mappers/storage-binding.response-mapper";
import { SystemHealthResponseMapper } from "../mappers/system-health.response-mapper";

@Controller({ path: "system" })
@ApiTags("System")
export class SystemController {
  constructor(
    private readonly listStorageBindingsUseCase: ListStorageBindingsUseCase,
    private readonly getStorageBindingByNameUseCase: GetStorageBindingByNameUseCase,
    private readonly listIntegrationsUseCase: ListIntegrationsUseCase,
    private readonly getSystemHealthUseCase: GetSystemHealthUseCase,
  ) {}

  @Get("storage-bindings")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List storage bindings" })
  @ApiOkResponse({ type: StorageBindingResponseDTO, isArray: true })
  async listStorageBindings(): Promise<StorageBindingResponseDTO[]> {
    const bindings = await this.listStorageBindingsUseCase.execute();
    return bindings.map((b) => StorageBindingResponseMapper.fromDomain(b));
  }

  @Get("storage-bindings/:name")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "Get a storage binding by name" })
  @ApiOkResponse({ type: StorageBindingResponseDTO })
  @ApiNotFoundResponse()
  async getStorageBinding(@Param("name") name: string): Promise<StorageBindingResponseDTO> {
    try {
      const binding = await this.getStorageBindingByNameUseCase.execute({ name });
      return StorageBindingResponseMapper.fromDomain(binding);
    } catch (err) {
      if (err instanceof StorageBindingNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get("integrations")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List integration adapter statuses" })
  @ApiOkResponse({ type: IntegrationStatusResponseDTO, isArray: true })
  async listIntegrations(): Promise<IntegrationStatusResponseDTO[]> {
    const statuses = await this.listIntegrationsUseCase.execute();
    return statuses.map((status) => IntegrationStatusResponseMapper.fromDomain(status));
  }

  @Get("health")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "System health snapshot" })
  @ApiOkResponse({ type: SystemHealthResponseDTO })
  async health(): Promise<SystemHealthResponseDTO> {
    const snapshot = await this.getSystemHealthUseCase.execute();
    return SystemHealthResponseMapper.fromDomain(snapshot);
  }
}
