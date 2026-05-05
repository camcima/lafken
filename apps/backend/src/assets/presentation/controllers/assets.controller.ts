import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  AssetAnalysisResponseDTO,
  AssetResponseDTO,
  AssetStateTransitionResponseDTO,
  ConfirmUploadRequestDTO,
  CreateUploadIntentRequestDTO,
  CreateUploadIntentResponseDTO,
  ListAssetsQueryDTO,
  ProcessingJobResponseDTO,
} from "@shared/backend-api";

import { ConfirmUploadUseCase } from "@/assets/application/use-cases/confirm-upload.use-case";
import { CreateUploadIntentUseCase } from "@/assets/application/use-cases/create-upload-intent.use-case";
import { GetAssetByPublicIdUseCase } from "@/assets/application/use-cases/get-asset-by-public-id.use-case";
import { GetAssetProcessingJobUseCase } from "@/assets/application/use-cases/get-asset-processing-job.use-case";
import { ListAssetAnalysesUseCase } from "@/assets/application/use-cases/list-asset-analyses.use-case";
import { ListAssetStateTransitionsUseCase } from "@/assets/application/use-cases/list-asset-state-transitions.use-case";
import { ListAssetsUseCase } from "@/assets/application/use-cases/list-assets.use-case";
import type { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { FileSizeExceedsPolicyError } from "@/assets/domain/errors/file-size-exceeds-policy.error";
import { MimeTypeNotAllowedError } from "@/assets/domain/errors/mime-type-not-allowed.error";
import { ProcessingJobNotFoundError } from "@/assets/domain/errors/processing-job-not-found.error";
import { UploadIntentExpiredError } from "@/assets/domain/errors/upload-intent-expired.error";
import { UploadIntentNotFoundError } from "@/assets/domain/errors/upload-intent-not-found.error";
import { UploadedObjectMissingError } from "@/assets/domain/errors/uploaded-object-missing.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import {
  type IPreviewSpec,
  PreviewUrlSignerPort,
} from "@/assets/domain/services/preview-url-signer.port";
import { SYSTEM_PRESETS } from "@/assets/infrastructure/services/system-presets";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";
import {
  AuthenticatedUser,
  type AuthenticatedUser as AuthenticatedUserType,
} from "@/shared/presentation/auth/decorators/authenticated-user.decorator";
import { EndpointRequiredRoles } from "@/shared/presentation/auth/decorators/endpoint-required-roles.decorator";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

import { PaginatedAssetResponseDTO } from "../dto/list-assets-paginated-response.dto";
import { AssetAnalysisResponseMapper } from "../mappers/asset-analysis.response-mapper";
import { AssetStateTransitionResponseMapper } from "../mappers/asset-state-transition.response-mapper";
import { AssetResponseMapper, type IPreviewSignContext } from "../mappers/asset.response-mapper";
import { ProcessingJobResponseMapper } from "../mappers/processing-job.response-mapper";

@Controller({ path: "assets" })
@ApiTags("Assets")
export class AssetsController {
  constructor(
    private readonly listAssetsUseCase: ListAssetsUseCase,
    private readonly getAssetByPublicIdUseCase: GetAssetByPublicIdUseCase,
    private readonly listAssetStateTransitionsUseCase: ListAssetStateTransitionsUseCase,
    private readonly listAssetAnalysesUseCase: ListAssetAnalysesUseCase,
    private readonly getAssetProcessingJobUseCase: GetAssetProcessingJobUseCase,
    private readonly createUploadIntentUseCase: CreateUploadIntentUseCase,
    private readonly confirmUploadUseCase: ConfirmUploadUseCase,
    private readonly assetQueryRepository: AssetQueryRepositoryPort,
    private readonly previewUrlSigner: PreviewUrlSignerPort,
    private readonly namespaceQueryRepository: NamespaceQueryRepositoryPort,
    private readonly storageBindingQueryRepository: StorageBindingQueryRepositoryPort,
  ) {}

  /**
   * Builds a per-asset preview-sign context, caching per-namespace presets and
   * per-binding bucket lookups across the loop. Returns null when no preview
   * source base URL is configured (signer is a no-op in that case anyway).
   */
  private buildSignContextResolver(): (asset: Asset) => Promise<IPreviewSignContext | null> {
    const sourceBaseUrl: string | undefined = environmentConfiguration.IMGPROXY_SOURCE_BASE_URL;
    if (!sourceBaseUrl) {
      return (): Promise<null> => Promise.resolve(null);
    }
    const trimmedBaseUrl: string = sourceBaseUrl.replace(/\/+$/u, "");
    const presetsCache: Map<string, Array<{ name: string; spec: IPreviewSpec }>> = new Map();
    const bucketCache: Map<string, string | null> = new Map();
    const signer: PreviewUrlSignerPort = this.previewUrlSigner;
    const namespaceRepo: NamespaceQueryRepositoryPort = this.namespaceQueryRepository;
    const bindingRepo: StorageBindingQueryRepositoryPort = this.storageBindingQueryRepository;

    return async (asset: Asset): Promise<IPreviewSignContext | null> => {
      const namespaceId: string = asset.props.namespaceId;
      let presets: Array<{ name: string; spec: IPreviewSpec }> | undefined =
        presetsCache.get(namespaceId);
      if (!presets) {
        // listPresets returns every active row ordered by (name asc, version
        // desc); collapse to the highest active version per name so a stale
        // older version can't clobber the latest one in the resulting URL map.
        const list = await namespaceRepo.listPresets(namespaceId);
        const latestByName: Map<string, IPreviewSpec> = new Map();
        // System presets first; namespace can never collide due to prefix
        // validation, but the dedupe pass remains as defense-in-depth.
        for (const sys of SYSTEM_PRESETS) {
          latestByName.set(sys.name, sys.spec);
        }
        for (const preset of list) {
          if (!latestByName.has(preset.props.name)) {
            latestByName.set(preset.props.name, preset.props.params.props);
          }
        }
        presets = Array.from(latestByName, ([name, spec]) => ({ name, spec }));
        presetsCache.set(namespaceId, presets);
      }
      if (presets.length === 0) {
        return null;
      }
      const bindingId: string = asset.props.storageBindingId;
      let bucket: string | null | undefined = bucketCache.get(bindingId);
      if (bucket === undefined) {
        const binding = await bindingRepo.findById(bindingId);
        bucket = binding ? binding.getGcsConfig().bucket : null;
        bucketCache.set(bindingId, bucket);
      }
      if (!bucket) {
        return null;
      }
      return { signer, presets, sourceBaseUrl: trimmedBaseUrl, bucket };
    };
  }

  @Get()
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List assets" })
  @ApiOkResponse({ type: PaginatedAssetResponseDTO })
  async list(@Query() query: ListAssetsQueryDTO): Promise<PaginatedAssetResponseDTO> {
    const page = await this.listAssetsUseCase.execute({
      page: query.page,
      limit: query.limit,
      namespaceSlug: query.namespaceSlug,
      states: query.states,
      uploadedBy: query.uploadedBy,
      owningRecordType: query.owningRecordType,
      owningRecordId: query.owningRecordId,
      uploadedFrom: query.uploadedFrom,
      uploadedTo: query.uploadedTo,
    });

    const resolveSignCtx = this.buildSignContextResolver();
    const data = await Promise.all(
      page.data.map(async (item) => {
        const signCtx: IPreviewSignContext | null = await resolveSignCtx(item.asset);
        return AssetResponseMapper.fromDomain(
          item.asset,
          item.namespaceSlug,
          item.policyVersion,
          signCtx,
        );
      }),
    );

    return { data, total: page.total, page: page.page, limit: page.limit, lastPage: page.lastPage };
  }

  @Get(":publicId")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "Get an asset by public ID" })
  @ApiOkResponse({ type: AssetResponseDTO })
  @ApiNotFoundResponse()
  async getOne(@Param("publicId") publicId: string): Promise<AssetResponseDTO> {
    try {
      const result = await this.getAssetByPublicIdUseCase.execute({ publicId });
      const resolveSignCtx = this.buildSignContextResolver();
      const signCtx: IPreviewSignContext | null = await resolveSignCtx(result.asset);
      return AssetResponseMapper.fromDomain(
        result.asset,
        result.namespaceSlug,
        result.policyVersion,
        signCtx,
      );
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":publicId/state-transitions")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List state transitions for an asset" })
  @ApiOkResponse({ type: AssetStateTransitionResponseDTO, isArray: true })
  @ApiNotFoundResponse()
  async listStateTransitions(
    @Param("publicId") publicId: string,
  ): Promise<AssetStateTransitionResponseDTO[]> {
    try {
      const transitions = await this.listAssetStateTransitionsUseCase.execute({ publicId });
      return transitions.map((transition) =>
        AssetStateTransitionResponseMapper.fromDomain(transition),
      );
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":publicId/analyses")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List analyses for an asset" })
  @ApiOkResponse({ type: AssetAnalysisResponseDTO, isArray: true })
  @ApiNotFoundResponse()
  async listAnalyses(@Param("publicId") publicId: string): Promise<AssetAnalysisResponseDTO[]> {
    try {
      const analyses = await this.listAssetAnalysesUseCase.execute({ publicId });
      return analyses.map((analysis) => AssetAnalysisResponseMapper.fromDomain(analysis));
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":publicId/processing-job")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "Get the processing job for an asset" })
  @ApiOkResponse({ type: ProcessingJobResponseDTO })
  @ApiNotFoundResponse()
  async getProcessingJob(@Param("publicId") publicId: string): Promise<ProcessingJobResponseDTO> {
    try {
      const job = await this.getAssetProcessingJobUseCase.execute({ publicId });
      return ProcessingJobResponseMapper.fromDomain(job);
    } catch (err) {
      if (err instanceof AssetNotFoundError || err instanceof ProcessingJobNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post("upload-intents")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Issue a signed URL for a new asset upload" })
  @ApiCreatedResponse({ type: CreateUploadIntentResponseDTO })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  async createUploadIntent(
    @Body() body: CreateUploadIntentRequestDTO,
    @AuthenticatedUser() user: AuthenticatedUserType,
  ): Promise<CreateUploadIntentResponseDTO> {
    try {
      const result = await this.createUploadIntentUseCase.execute({
        namespaceSlug: body.namespaceSlug,
        declaredMimeType: body.declaredMimeType,
        declaredSizeBytes: BigInt(body.declaredSizeBytes),
        createdBy: user.emailAddress,
      });
      return {
        publicId: result.publicId,
        uploadUrl: result.uploadUrl,
        uploadHeaders: result.uploadHeaders,
        expiresAt: result.expiresAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof NamespaceNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      if (
        err instanceof NamespaceArchivedError ||
        err instanceof MimeTypeNotAllowedError ||
        err instanceof FileSizeExceedsPolicyError
      ) {
        throw new UnprocessableEntityException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post(":publicId/confirm")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Confirm a successful upload to a signed URL" })
  @ApiOkResponse({ type: AssetResponseDTO })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  async confirmUpload(
    @Param("publicId") publicId: string,
    @Body() body: ConfirmUploadRequestDTO,
    @AuthenticatedUser() user: AuthenticatedUserType,
  ): Promise<AssetResponseDTO> {
    try {
      const asset = await this.confirmUploadUseCase.execute({
        publicId,
        uploadedBy: user.emailAddress,
        width: body.width,
        height: body.height,
      });
      const namespaceSlug =
        (await this.assetQueryRepository.findNamespaceSlug(asset.props.namespaceId)) ?? "unknown";
      const policyVersion =
        (await this.assetQueryRepository.findPolicyVersion(asset.props.policyVersionId)) ?? 0;
      const resolveSignCtx = this.buildSignContextResolver();
      const signCtx: IPreviewSignContext | null = await resolveSignCtx(asset);
      return AssetResponseMapper.fromDomain(asset, namespaceSlug, policyVersion, signCtx);
    } catch (err) {
      if (err instanceof UploadIntentNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      if (err instanceof UploadIntentExpiredError || err instanceof UploadedObjectMissingError) {
        throw new UnprocessableEntityException(err.message, { cause: err });
      }
      throw err;
    }
  }
}
