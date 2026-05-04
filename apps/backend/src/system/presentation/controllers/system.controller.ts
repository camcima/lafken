import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  CreateStorageBindingRequestDTO,
  IntegrationStatusResponseDTO,
  StorageBindingResponseDTO,
  SystemHealthResponseDTO,
  UpdateStorageBindingRequestDTO,
} from "@shared/backend-api";

import { ApplicationRole } from "@/shared/kernel/domain/application-roles";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";
import { EndpointRequiredRoles } from "@/shared/presentation/auth/decorators/endpoint-required-roles.decorator";
import { CreateStorageBindingUseCase } from "@/system/application/use-cases/create-storage-binding.use-case";
import { DeleteStorageBindingUseCase } from "@/system/application/use-cases/delete-storage-binding.use-case";
import { GetStorageBindingByNameUseCase } from "@/system/application/use-cases/get-storage-binding-by-name.use-case";
import { GetSystemHealthUseCase } from "@/system/application/use-cases/get-system-health.use-case";
import { ListIntegrationsUseCase } from "@/system/application/use-cases/list-integrations.use-case";
import { ListStorageBindingsUseCase } from "@/system/application/use-cases/list-storage-bindings.use-case";
import { UpdateStorageBindingUseCase } from "@/system/application/use-cases/update-storage-binding.use-case";
import { DuplicateStorageBindingNameError } from "@/system/domain/errors/duplicate-storage-binding-name.error";
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
    private readonly createStorageBindingUseCase: CreateStorageBindingUseCase,
    private readonly updateStorageBindingUseCase: UpdateStorageBindingUseCase,
    private readonly deleteStorageBindingUseCase: DeleteStorageBindingUseCase,
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

  @Post("storage-bindings")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a storage binding" })
  @ApiCreatedResponse({ type: StorageBindingResponseDTO })
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  @ApiBadRequestResponse()
  async createStorageBinding(
    @Body() body: CreateStorageBindingRequestDTO,
  ): Promise<StorageBindingResponseDTO> {
    try {
      const binding = await this.createStorageBindingUseCase.execute({
        name: body.name,
        adapterType: body.adapterType,
        config: body.config,
      });
      return StorageBindingResponseMapper.fromDomain(binding);
    } catch (err) {
      if (err instanceof DuplicateStorageBindingNameError) {
        throw new ConflictException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Patch("storage-bindings/:name")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @ApiOperation({ summary: "Update a storage binding's config" })
  @ApiOkResponse({ type: StorageBindingResponseDTO })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  @ApiBadRequestResponse()
  async updateStorageBinding(
    @Param("name") name: string,
    @Body() body: UpdateStorageBindingRequestDTO,
  ): Promise<StorageBindingResponseDTO> {
    try {
      const binding = await this.updateStorageBindingUseCase.execute({
        name,
        config: body.config,
      });
      return StorageBindingResponseMapper.fromDomain(binding);
    } catch (err) {
      if (err instanceof StorageBindingNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Delete("storage-bindings/:name")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a storage binding" })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  async deleteStorageBinding(@Param("name") name: string): Promise<void> {
    try {
      await this.deleteStorageBindingUseCase.execute({ name });
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
