import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Ip,
  NotFoundException,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
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
  AssetAnalysisResponseDTO,
  AssetDownloadUrlResponseDTO,
  AssetResponseDTO,
  AssetStateTransitionResponseDTO,
  ConfirmUploadRequestDTO,
  CreateUploadIntentRequestDTO,
  CreateUploadIntentResponseDTO,
  ListAssetsQueryDTO,
  PreviewUrlResponseDTO,
  ProcessingJobResponseDTO,
  RefreshUploadUrlResponseDTO,
} from "@shared/backend-api";

import { ConfirmUploadUseCase } from "@/assets/application/use-cases/confirm-upload.use-case";
import { CreateUploadIntentUseCase } from "@/assets/application/use-cases/create-upload-intent.use-case";
import { DeleteAssetUseCase } from "@/assets/application/use-cases/delete-asset.use-case";
import { GetAssetByIdUseCase } from "@/assets/application/use-cases/get-asset-by-id.use-case";
import { GetAssetDownloadUrlUseCase } from "@/assets/application/use-cases/get-asset-download-url.use-case";
import { GetAssetProcessingJobUseCase } from "@/assets/application/use-cases/get-asset-processing-job.use-case";
import { GetPreviewUrlUseCase } from "@/assets/application/use-cases/get-preview-url.use-case";
import { ListAssetAnalysesUseCase } from "@/assets/application/use-cases/list-asset-analyses.use-case";
import { ListAssetStateTransitionsUseCase } from "@/assets/application/use-cases/list-asset-state-transitions.use-case";
import { ListAssetsUseCase } from "@/assets/application/use-cases/list-assets.use-case";
import { RefreshUploadUrlUseCase } from "@/assets/application/use-cases/refresh-upload-url.use-case";
import { RetryAssetProcessingUseCase } from "@/assets/application/use-cases/retry-asset-processing.use-case";
import { ActivePresetNotFoundError } from "@/assets/domain/errors/active-preset-not-found.error";
import { AssetNotDownloadableError } from "@/assets/domain/errors/asset-not-downloadable.error";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInProcessingFailedStateError } from "@/assets/domain/errors/asset-not-in-processing-failed-state.error";
import { AssetNotPreviewableError } from "@/assets/domain/errors/asset-not-previewable.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import { FileSizeExceedsPolicyError } from "@/assets/domain/errors/file-size-exceeds-policy.error";
import { MimeTypeNotAllowedError } from "@/assets/domain/errors/mime-type-not-allowed.error";
import { ProcessingJobNotFoundError } from "@/assets/domain/errors/processing-job-not-found.error";
import { TusNotConfiguredError } from "@/assets/domain/errors/tus-not-configured.error";
import { UploadIntentAlreadyConsumedError } from "@/assets/domain/errors/upload-intent-already-consumed.error";
import { UploadIntentExpiredError } from "@/assets/domain/errors/upload-intent-expired.error";
import { UploadIntentNotFoundError } from "@/assets/domain/errors/upload-intent-not-found.error";
import { UploadedObjectMissingError } from "@/assets/domain/errors/uploaded-object-missing.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { NamespaceArchivedError } from "@/namespaces/domain/errors/namespace-archived.error";
import { NamespaceNotFoundError } from "@/namespaces/domain/errors/namespace-not-found.error";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";
import {
  AuthenticatedUser,
  type AuthenticatedUser as AuthenticatedUserType,
} from "@/shared/presentation/auth/decorators/authenticated-user.decorator";
import { EndpointRequiredRoles } from "@/shared/presentation/auth/decorators/endpoint-required-roles.decorator";

import { PaginatedAssetResponseDTO } from "../dto/list-assets-paginated-response.dto";
import { AssetAnalysisResponseMapper } from "../mappers/asset-analysis.response-mapper";
import { AssetStateTransitionResponseMapper } from "../mappers/asset-state-transition.response-mapper";
import { AssetResponseMapper } from "../mappers/asset.response-mapper";
import { ProcessingJobResponseMapper } from "../mappers/processing-job.response-mapper";

@Controller({ path: "assets" })
@ApiTags("Assets")
export class AssetsController {
  constructor(
    private readonly listAssetsUseCase: ListAssetsUseCase,
    private readonly getAssetByIdUseCase: GetAssetByIdUseCase,
    private readonly listAssetStateTransitionsUseCase: ListAssetStateTransitionsUseCase,
    private readonly listAssetAnalysesUseCase: ListAssetAnalysesUseCase,
    private readonly getAssetProcessingJobUseCase: GetAssetProcessingJobUseCase,
    private readonly createUploadIntentUseCase: CreateUploadIntentUseCase,
    private readonly confirmUploadUseCase: ConfirmUploadUseCase,
    private readonly retryAssetProcessingUseCase: RetryAssetProcessingUseCase,
    private readonly getAssetDownloadUrlUseCase: GetAssetDownloadUrlUseCase,
    private readonly refreshUploadUrlUseCase: RefreshUploadUrlUseCase,
    private readonly deleteAssetUseCase: DeleteAssetUseCase,
    private readonly getPreviewUrlUseCase: GetPreviewUrlUseCase,
    private readonly assetQueryRepository: AssetQueryRepositoryPort,
  ) {}

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
      externalRefType: query.externalRefType,
      externalRefId: query.externalRefId,
      tags: query.tags,
      uploadedFrom: query.uploadedFrom,
      uploadedTo: query.uploadedTo,
      q: query.q,
      legalHoldId: query.legalHoldId,
    });

    const data = page.data.map((item) =>
      AssetResponseMapper.fromDomain(item.asset, item.namespaceSlug, item.policyVersion),
    );

    return { data, total: page.total, page: page.page, limit: page.limit, lastPage: page.lastPage };
  }

  @Get(":id")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "Get an asset by internal id" })
  @ApiOkResponse({ type: AssetResponseDTO })
  @ApiNotFoundResponse()
  async getOne(@Param("id") id: string): Promise<AssetResponseDTO> {
    try {
      const result = await this.getAssetByIdUseCase.execute({ id });
      return AssetResponseMapper.fromDomain(
        result.asset,
        result.namespaceSlug,
        result.policyVersion,
      );
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":publicId/preview-url")
  @AuthenticatedEndpoint()
  @Header("Cache-Control", "private, max-age=300")
  @ApiOperation({
    summary: "Mint a signed preview URL for an asset against a named preset",
  })
  @ApiOkResponse({ type: PreviewUrlResponseDTO })
  @ApiNotFoundResponse()
  async getPreviewUrl(
    @Param("publicId") publicId: string,
    @Query("preset") preset?: string,
  ): Promise<PreviewUrlResponseDTO> {
    if (!preset || preset.trim() === "") {
      throw new UnprocessableEntityException("preset query parameter is required");
    }
    try {
      const result = await this.getPreviewUrlUseCase.execute({ publicId, presetName: preset });
      return { url: result.url, expiresAt: result.expiresAt.toISOString() };
    } catch (err) {
      if (
        err instanceof AssetNotFoundError ||
        err instanceof AssetNotPreviewableError ||
        err instanceof ActivePresetNotFoundError
      ) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":publicId/download-url")
  @AuthenticatedEndpoint()
  @ApiOperation({
    summary: "Mint a signed read URL for an asset's original bytes",
    description:
      "Returns a fully-signed GCS read URL the browser can fetch directly to " +
      "download the asset's original bytes. The URL is valid for ~5 minutes.",
  })
  @ApiOkResponse({ type: AssetDownloadUrlResponseDTO })
  @ApiNotFoundResponse()
  async getDownloadUrl(@Param("publicId") publicId: string): Promise<AssetDownloadUrlResponseDTO> {
    try {
      const result = await this.getAssetDownloadUrlUseCase.execute({ publicId });
      return { url: result.url };
    } catch (err) {
      if (err instanceof AssetNotFoundError || err instanceof AssetNotDownloadableError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":id/state-transitions")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List state transitions for an asset" })
  @ApiOkResponse({ type: AssetStateTransitionResponseDTO, isArray: true })
  @ApiNotFoundResponse()
  async listStateTransitions(@Param("id") id: string): Promise<AssetStateTransitionResponseDTO[]> {
    try {
      const transitions = await this.listAssetStateTransitionsUseCase.execute({ id });
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

  @Get(":id/analyses")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List analyses for an asset" })
  @ApiOkResponse({ type: AssetAnalysisResponseDTO, isArray: true })
  @ApiNotFoundResponse()
  async listAnalyses(@Param("id") id: string): Promise<AssetAnalysisResponseDTO[]> {
    try {
      const analyses = await this.listAssetAnalysesUseCase.execute({ id });
      return analyses.map((analysis) => AssetAnalysisResponseMapper.fromDomain(analysis));
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Get(":id/processing-job")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "Get the processing job for an asset" })
  @ApiOkResponse({ type: ProcessingJobResponseDTO })
  @ApiNotFoundResponse()
  async getProcessingJob(@Param("id") id: string): Promise<ProcessingJobResponseDTO> {
    try {
      const job = await this.getAssetProcessingJobUseCase.execute({ id });
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
        protocol: body.protocol,
      });
      return {
        publicId: result.publicId,
        protocol: result.protocol,
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
        err instanceof FileSizeExceedsPolicyError ||
        err instanceof TusNotConfiguredError
      ) {
        throw new UnprocessableEntityException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post("upload-intents/:publicId/refresh-url")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reissue an upload URL for an unconsumed upload intent" })
  @ApiOkResponse({ type: RefreshUploadUrlResponseDTO })
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  async refreshUploadUrl(
    @Param("publicId") publicId: string,
    @AuthenticatedUser() user: AuthenticatedUserType,
  ): Promise<RefreshUploadUrlResponseDTO> {
    try {
      const result = await this.refreshUploadUrlUseCase.execute({
        publicId,
        requestedBy: user.emailAddress,
      });
      return {
        uploadUrl: result.uploadUrl,
        uploadHeaders: result.uploadHeaders,
        expiresAt: result.expiresAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof UploadIntentNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      if (
        err instanceof UploadIntentExpiredError ||
        err instanceof UploadIntentAlreadyConsumedError
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
    @Ip() requestIp: string,
  ): Promise<AssetResponseDTO> {
    try {
      const asset = await this.confirmUploadUseCase.execute({
        publicId,
        uploadedBy: user.emailAddress,
        width: body.width,
        height: body.height,
        externalRefType: body.externalRefType,
        externalRefId: body.externalRefId,
        note: body.note,
        tags: body.tags,
        requestIp,
      });
      const namespaceSlug =
        (await this.assetQueryRepository.findNamespaceSlug(asset.props.namespaceId)) ?? "unknown";
      const policyVersion =
        (await this.assetQueryRepository.findPolicyVersion(asset.props.policyVersionId)) ?? 0;
      return AssetResponseMapper.fromDomain(asset, namespaceSlug, policyVersion);
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

  @Post(":id/retry-processing")
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Retry processing for an asset whose previous processing attempts failed",
    description:
      "Re-primes the asset's processing job for another worker attempt and " +
      "transitions the asset from `processing_failed` back to `uploaded`. The " +
      "worker will pick the asset up on its next tick. Only valid when the " +
      "asset is currently in `processing_failed`.",
  })
  @ApiOkResponse()
  @ApiNotFoundResponse()
  @ApiUnprocessableEntityResponse()
  async retryProcessing(
    @Param("id") id: string,
    @AuthenticatedUser() user: AuthenticatedUserType,
  ): Promise<void> {
    try {
      await this.retryAssetProcessingUseCase.execute({
        id,
        requestedByEmail: user.emailAddress,
      });
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      if (err instanceof AssetNotInProcessingFailedStateError) {
        throw new UnprocessableEntityException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Delete(":id")
  @EndpointRequiredRoles([ApplicationRole.ASSET_DELETER])
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Soft-delete an asset",
    description:
      "Transitions the asset to the terminal `deleted` state. Idempotent: " +
      "deleting an already-deleted asset returns 204 without a new " +
      "transition. The stored object remains in place — a separate purge " +
      "process removes bytes later. Assets under a legal hold cannot be " +
      "deleted (409).",
  })
  @ApiNoContentResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  async deleteAsset(
    @Param("id") id: string,
    @AuthenticatedUser() user: AuthenticatedUserType,
  ): Promise<void> {
    try {
      await this.deleteAssetUseCase.execute({ id, requestedByEmail: user.emailAddress });
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      if (err instanceof AssetUnderLegalHoldError) {
        // 409 (not the DomainError-default 422): the delete conflicts with the
        // resource's current state and succeeds once the hold is lifted. The
        // delete-asset E2E pins this status.
        throw new ConflictException(err.message, { cause: err });
      }
      throw err;
    }
  }
}
