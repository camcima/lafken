import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  NamespacePolicyResponseDTO,
  NamespacePresetResponseDTO,
  NamespaceResponseDTO,
} from "@shared/backend-api";

import { GetNamespaceBySlugUseCase } from "@/namespaces/application/use-cases/get-namespace-by-slug.use-case";
import { ListNamespacePoliciesUseCase } from "@/namespaces/application/use-cases/list-namespace-policies.use-case";
import { ListNamespacePresetsUseCase } from "@/namespaces/application/use-cases/list-namespace-presets.use-case";
import { ListNamespacesUseCase } from "@/namespaces/application/use-cases/list-namespaces.use-case";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";

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
    private readonly repository: NamespaceQueryRepositoryPort,
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

    const data = await Promise.all(
      page.data.map(async (ns) => {
        const [bindingName, currentVersion] = await Promise.all([
          this.repository.findStorageBindingName(ns.props.storageBindingId),
          this.repository.findCurrentPolicyVersion(ns.props.id),
        ]);
        return NamespaceResponseMapper.fromDomain(
          ns,
          bindingName ?? "unknown",
          currentVersion ?? 0,
        );
      }),
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
      const namespace = await this.getNamespaceBySlugUseCase.execute({ slug });
      const [bindingName, currentVersion] = await Promise.all([
        this.repository.findStorageBindingName(namespace.props.storageBindingId),
        this.repository.findCurrentPolicyVersion(namespace.props.id),
      ]);
      return NamespaceResponseMapper.fromDomain(
        namespace,
        bindingName ?? "unknown",
        currentVersion ?? 0,
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
}
