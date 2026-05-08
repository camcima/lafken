import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  CreateNamespaceRequestDTO,
  CreatePolicyVersionRequestDTO,
  CreatePresetRequestDTO,
  NamespacePolicyResponseDTO,
  NamespacePresetResponseDTO,
  NamespaceResponseDTO,
  SetPresetActiveRequestDTO,
  UpdateNamespaceMetadataRequestDTO,
  UpdatePresetVersionRequestDTO,
} from "@shared/backend-api";

import { ArchiveNamespaceUseCase } from "@/namespaces/application/use-cases/archive-namespace.use-case";
import { CreateNamespaceUseCase } from "@/namespaces/application/use-cases/create-namespace.use-case";
import { CreatePresetUseCase } from "@/namespaces/application/use-cases/create-preset.use-case";
import { GetNamespaceBySlugUseCase } from "@/namespaces/application/use-cases/get-namespace-by-slug.use-case";
import { ListNamespacePoliciesUseCase } from "@/namespaces/application/use-cases/list-namespace-policies.use-case";
import { ListNamespacePresetsUseCase } from "@/namespaces/application/use-cases/list-namespace-presets.use-case";
import { ListNamespacesUseCase } from "@/namespaces/application/use-cases/list-namespaces.use-case";
import { SetPresetActiveUseCase } from "@/namespaces/application/use-cases/set-preset-active.use-case";
import { UnarchiveNamespaceUseCase } from "@/namespaces/application/use-cases/unarchive-namespace.use-case";
import { UpdateNamespaceMetadataUseCase } from "@/namespaces/application/use-cases/update-namespace-metadata.use-case";
import { UpdateNamespacePolicyUseCase } from "@/namespaces/application/use-cases/update-namespace-policy.use-case";
import { UpdatePresetVersionUseCase } from "@/namespaces/application/use-cases/update-preset-version.use-case";
import { NamespaceAlreadyExistsError } from "@/namespaces/domain/errors/namespace-already-exists.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { PolicyVersionConflictError } from "@/namespaces/domain/errors/policy-version-conflict.error";
import { PresetNotFoundError } from "@/namespaces/domain/errors/preset-not-found.error";
import { PresetVersionConflictError } from "@/namespaces/domain/errors/preset-version-conflict.error";
import { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";
import { AuthenticatedUser } from "@/shared/presentation/auth/decorators/authenticated-user.decorator";
import { EndpointRequiredRoles } from "@/shared/presentation/auth/decorators/endpoint-required-roles.decorator";
import type { CurrentAuthenticatedUserDTO } from "@/shared/presentation/auth/dto/current-authenticated-user.dto";

import {
  ListNamespacesQueryDTO,
  PaginatedNamespacesResponseDTO,
} from "../dto/list-namespaces-query.dto";
import { NamespacePolicyResponseMapper } from "../mappers/namespace-policy.response-mapper";
import { NamespacePresetResponseMapper } from "../mappers/namespace-preset.response-mapper";
import { NamespaceResponseMapper } from "../mappers/namespace.response-mapper";

@Controller({ path: "namespaces" })
@ApiTags("Namespaces")
export class NamespacesController {
  constructor(
    private readonly listNamespacesUseCase: ListNamespacesUseCase,
    private readonly getNamespaceBySlugUseCase: GetNamespaceBySlugUseCase,
    private readonly listNamespacePoliciesUseCase: ListNamespacePoliciesUseCase,
    private readonly listNamespacePresetsUseCase: ListNamespacePresetsUseCase,
    private readonly createNamespaceUseCase: CreateNamespaceUseCase,
    private readonly updateNamespaceMetadataUseCase: UpdateNamespaceMetadataUseCase,
    private readonly archiveNamespaceUseCase: ArchiveNamespaceUseCase,
    private readonly unarchiveNamespaceUseCase: UnarchiveNamespaceUseCase,
    private readonly updateNamespacePolicyUseCase: UpdateNamespacePolicyUseCase,
    private readonly createPresetUseCase: CreatePresetUseCase,
    private readonly updatePresetVersionUseCase: UpdatePresetVersionUseCase,
    private readonly setPresetActiveUseCase: SetPresetActiveUseCase,
  ) {}

  @Get()
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List namespaces" })
  @ApiOkResponse({ type: PaginatedNamespacesResponseDTO })
  async list(@Query() query: ListNamespacesQueryDTO): Promise<PaginatedNamespacesResponseDTO> {
    const page = await this.listNamespacesUseCase.execute({
      page: query.page,
      limit: query.limit,
    });

    const data = page.data.map((item) =>
      NamespaceResponseMapper.fromDomain(
        item.namespace,
        item.storageBindingName,
        item.currentPolicyVersion,
      ),
    );

    return { data, total: page.total, page: page.page, limit: page.limit, lastPage: page.lastPage };
  }

  @Get(":slug")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "Get a namespace by slug" })
  @ApiOkResponse({ type: NamespaceResponseDTO })
  @ApiNotFoundResponse()
  async getOne(@Param("slug") slug: string): Promise<NamespaceResponseDTO> {
    try {
      const result = await this.getNamespaceBySlugUseCase.execute({ slug });
      return NamespaceResponseMapper.fromDomain(
        result.namespace,
        result.storageBindingName,
        result.currentPolicyVersion,
      );
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":slug/policies")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List policy versions for a namespace" })
  @ApiOkResponse({ type: NamespacePolicyResponseDTO, isArray: true })
  @ApiNotFoundResponse()
  async listPolicies(@Param("slug") slug: string): Promise<NamespacePolicyResponseDTO[]> {
    try {
      const policies = await this.listNamespacePoliciesUseCase.execute({ slug });
      return policies.map((policy) => NamespacePolicyResponseMapper.fromDomain(policy));
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":slug/presets")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List active presets for a namespace" })
  @ApiOkResponse({ type: NamespacePresetResponseDTO, isArray: true })
  @ApiNotFoundResponse()
  async listPresets(@Param("slug") slug: string): Promise<NamespacePresetResponseDTO[]> {
    try {
      const presets = await this.listNamespacePresetsUseCase.execute({ slug });
      return presets.map((preset) => NamespacePresetResponseMapper.fromDomain(preset));
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post()
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a namespace with its initial policy" })
  @ApiCreatedResponse({ type: NamespaceResponseDTO })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async createNamespace(
    @Body() body: CreateNamespaceRequestDTO,
    @AuthenticatedUser() user: CurrentAuthenticatedUserDTO,
    @Ip() requestIp: string,
  ): Promise<NamespaceResponseDTO> {
    try {
      const result = await this.createNamespaceUseCase.execute({
        slug: body.slug,
        displayName: body.displayName,
        description: body.description,
        storageBindingId: body.storageBindingId,
        createdBy: user.emailAddress,
        requestIp,
        policy: {
          retentionDays: body.policy.retentionDays,
          retentionMode: body.policy.retentionMode,
          maxFileSizeBytes: BigInt(body.policy.maxFileSizeBytes),
          allowedMimeTypes: body.policy.allowedMimeTypes,
          exifHandling: body.policy.exifHandling,
          virusScanRequired: body.policy.virusScanRequired,
          contentModeration: body.policy.contentModeration,
          requiredMetadataSchema: body.policy.requiredMetadataSchema,
          immutable: body.policy.immutable,
          servingMode: body.policy.servingMode,
          signedUrlTtlSeconds: body.policy.signedUrlTtlSeconds,
          signedUrlBucketSize: body.policy.signedUrlBucketSize,
          retryConfig: body.policy.retryConfig,
        },
      });
      return NamespaceResponseMapper.fromDomain(
        result.namespace,
        result.storageBindingName,
        result.currentPolicyVersion,
      );
    } catch (err) {
      if (err instanceof NamespaceAlreadyExistsError) {
        throw new ConflictException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Patch(":slug")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @ApiOperation({ summary: "Update namespace metadata" })
  @ApiOkResponse({ type: NamespaceResponseDTO })
  @ApiNotFoundResponse()
  @ApiBadRequestResponse()
  @ApiUnprocessableEntityResponse()
  async updateNamespaceMetadata(
    @Param("slug") slug: string,
    @Body() body: UpdateNamespaceMetadataRequestDTO,
    @AuthenticatedUser() user: CurrentAuthenticatedUserDTO,
    @Ip() requestIp: string,
  ): Promise<NamespaceResponseDTO> {
    try {
      const result = await this.updateNamespaceMetadataUseCase.execute({
        slug,
        displayName: body.displayName,
        description: body.description,
        occurredBy: user.emailAddress,
        requestIp,
      });
      return NamespaceResponseMapper.fromDomain(
        result.namespace,
        result.storageBindingName,
        result.currentPolicyVersion,
      );
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post(":slug/archive")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Archive a namespace (soft)" })
  @ApiOkResponse({ type: NamespaceResponseDTO })
  @ApiNotFoundResponse()
  async archiveNamespace(
    @Param("slug") slug: string,
    @AuthenticatedUser() user: CurrentAuthenticatedUserDTO,
    @Ip() requestIp: string,
  ): Promise<NamespaceResponseDTO> {
    try {
      const result = await this.archiveNamespaceUseCase.execute({
        slug,
        occurredBy: user.emailAddress,
        requestIp,
      });
      return NamespaceResponseMapper.fromDomain(
        result.namespace,
        result.storageBindingName,
        result.currentPolicyVersion,
      );
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post(":slug/unarchive")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Unarchive a namespace" })
  @ApiOkResponse({ type: NamespaceResponseDTO })
  @ApiNotFoundResponse()
  async unarchiveNamespace(
    @Param("slug") slug: string,
    @AuthenticatedUser() user: CurrentAuthenticatedUserDTO,
    @Ip() requestIp: string,
  ): Promise<NamespaceResponseDTO> {
    try {
      const result = await this.unarchiveNamespaceUseCase.execute({
        slug,
        occurredBy: user.emailAddress,
        requestIp,
      });
      return NamespaceResponseMapper.fromDomain(
        result.namespace,
        result.storageBindingName,
        result.currentPolicyVersion,
      );
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post(":slug/policy-versions")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Create a new policy version for a namespace" })
  @ApiOkResponse({ type: NamespaceResponseDTO })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async createPolicyVersion(
    @Param("slug") slug: string,
    @Body() body: CreatePolicyVersionRequestDTO,
    @AuthenticatedUser() user: CurrentAuthenticatedUserDTO,
    @Ip() requestIp: string,
  ): Promise<NamespaceResponseDTO> {
    try {
      await this.updateNamespacePolicyUseCase.execute({
        slug,
        createdBy: user.emailAddress,
        requestIp,
        policy: {
          retentionDays: body.policy.retentionDays,
          retentionMode: body.policy.retentionMode,
          maxFileSizeBytes: BigInt(body.policy.maxFileSizeBytes),
          allowedMimeTypes: body.policy.allowedMimeTypes,
          exifHandling: body.policy.exifHandling,
          virusScanRequired: body.policy.virusScanRequired,
          contentModeration: body.policy.contentModeration,
          requiredMetadataSchema: body.policy.requiredMetadataSchema,
          immutable: body.policy.immutable,
          servingMode: body.policy.servingMode,
          signedUrlTtlSeconds: body.policy.signedUrlTtlSeconds,
          signedUrlBucketSize: body.policy.signedUrlBucketSize,
          retryConfig: body.policy.retryConfig,
        },
      });

      const refreshed = await this.getNamespaceBySlugUseCase.execute({ slug });
      return NamespaceResponseMapper.fromDomain(
        refreshed.namespace,
        refreshed.storageBindingName,
        refreshed.currentPolicyVersion,
      );
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      if (err instanceof PolicyVersionConflictError) {
        throw new ConflictException(err.message, { cause: err });
      }
      throw err; // NamespaceArchivedError → 422 via global filter
    }
  }

  @Post(":slug/presets")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new preset for a namespace" })
  @ApiCreatedResponse({ type: NamespacePresetResponseDTO })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  async createPreset(
    @Param("slug") slug: string,
    @Body() body: CreatePresetRequestDTO,
    @AuthenticatedUser() user: CurrentAuthenticatedUserDTO,
    @Ip() requestIp: string,
  ): Promise<NamespacePresetResponseDTO> {
    try {
      const params = PresetParams.fromUnknown(body.params);
      const preset = await this.createPresetUseCase.execute({
        slug,
        name: body.name,
        params,
        createdBy: user.emailAddress,
        requestIp,
      });
      return NamespacePresetResponseMapper.fromDomain(preset);
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post(":slug/presets/:name/versions")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create a new version of an existing preset" })
  @ApiCreatedResponse({ type: NamespacePresetResponseDTO })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnprocessableEntityResponse()
  async updatePresetVersion(
    @Param("slug") slug: string,
    @Param("name") name: string,
    @Body() body: UpdatePresetVersionRequestDTO,
    @AuthenticatedUser() user: CurrentAuthenticatedUserDTO,
    @Ip() requestIp: string,
  ): Promise<NamespacePresetResponseDTO> {
    try {
      const params = PresetParams.fromUnknown(body.params);
      const preset = await this.updatePresetVersionUseCase.execute({
        slug,
        name,
        params,
        createdBy: user.emailAddress,
        requestIp,
      });
      return NamespacePresetResponseMapper.fromDomain(preset);
    } catch (err) {
      if (err instanceof NamespaceNotFoundError || err instanceof PresetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      if (err instanceof PresetVersionConflictError) {
        throw new ConflictException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Patch(":slug/presets/:name")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Activate or deactivate a preset" })
  @ApiOkResponse({ type: NamespacePresetResponseDTO })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  async setPresetActive(
    @Param("slug") slug: string,
    @Param("name") name: string,
    @Body() body: SetPresetActiveRequestDTO,
    @AuthenticatedUser() user: CurrentAuthenticatedUserDTO,
    @Ip() requestIp: string,
  ): Promise<NamespacePresetResponseDTO> {
    try {
      const preset = await this.setPresetActiveUseCase.execute({
        slug,
        name,
        active: body.active,
        occurredBy: user.emailAddress,
        requestIp,
      });
      return NamespacePresetResponseMapper.fromDomain(preset);
    } catch (err) {
      if (err instanceof NamespaceNotFoundError || err instanceof PresetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }
}
