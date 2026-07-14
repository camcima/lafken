import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  NotFoundException,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  AssetResponseDTO,
  ListQuarantineQueryDTO,
  RejectQuarantinedAssetRequestDTO,
  ReleaseQuarantinedAssetRequestDTO,
} from "@shared/backend-api";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetResponseMapper } from "@/assets/presentation/mappers/asset.response-mapper";
import { ListQuarantinedAssetsUseCase } from "@/quarantine/application/use-cases/list-quarantined-assets.use-case";
import { RejectQuarantinedAssetUseCase } from "@/quarantine/application/use-cases/reject-quarantined-asset.use-case";
import { ReleaseQuarantinedAssetUseCase } from "@/quarantine/application/use-cases/release-quarantined-asset.use-case";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";
import {
  AuthenticatedUser,
  type AuthenticatedUser as AuthenticatedUserType,
} from "@/shared/presentation/auth/decorators/authenticated-user.decorator";
import { EndpointRequiredRoles } from "@/shared/presentation/auth/decorators/endpoint-required-roles.decorator";

import { PaginatedQuarantinedAssetResponseDTO } from "../dto/list-quarantine-paginated-response.dto";
import { QuarantinedAssetResponseMapper } from "../mappers/quarantined-asset.response-mapper";

@Controller({ path: "quarantine" })
@ApiTags("Quarantine")
export class QuarantineController {
  constructor(
    private readonly listQuarantinedAssetsUseCase: ListQuarantinedAssetsUseCase,
    private readonly releaseQuarantinedAssetUseCase: ReleaseQuarantinedAssetUseCase,
    private readonly rejectQuarantinedAssetUseCase: RejectQuarantinedAssetUseCase,
    private readonly assetQueryRepository: AssetQueryRepositoryPort,
  ) {}

  private async toResponseDto(asset: Asset): Promise<AssetResponseDTO> {
    const namespaceSlug: string =
      (await this.assetQueryRepository.findNamespaceSlug(asset.props.namespaceId)) ?? "unknown";
    const policyVersion: number =
      (await this.assetQueryRepository.findPolicyVersion(asset.props.policyVersionId)) ?? 0;
    return AssetResponseMapper.fromDomain(asset, namespaceSlug, policyVersion);
  }

  @Get()
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List quarantined assets" })
  @ApiOkResponse({ type: PaginatedQuarantinedAssetResponseDTO })
  async list(
    @Query() query: ListQuarantineQueryDTO,
  ): Promise<PaginatedQuarantinedAssetResponseDTO> {
    const page = await this.listQuarantinedAssetsUseCase.execute({
      page: query.page,
      limit: query.limit,
      kind: query.kind,
      namespaceSlug: query.namespaceSlug,
      flaggedFrom: query.flaggedFrom,
      flaggedTo: query.flaggedTo,
    });

    const data = page.data.map((item) => QuarantinedAssetResponseMapper.fromDomain(item));

    return { data, total: page.total, page: page.page, limit: page.limit, lastPage: page.lastPage };
  }

  @Post(":publicId/release")
  @HttpCode(HttpStatus.OK)
  @AuthenticatedEndpoint()
  @EndpointRequiredRoles([ApplicationRole.CONTENT_REVIEWER, ApplicationRole.PLATFORM_OPERATOR])
  @ApiOperation({
    summary: "Release a quarantined asset back to ready",
    description:
      "Content-reviewer only. Moves the bytes back from `_quarantined/<key>` to the original key (when applicable) and transitions the asset to `ready` with the reviewer's note recorded in the audit trail. Refuses when the asset is not currently quarantined or is under legal hold.",
  })
  @ApiOkResponse({ type: AssetResponseDTO })
  async release(
    @Param("publicId") publicId: string,
    @Body() body: ReleaseQuarantinedAssetRequestDTO,
    @AuthenticatedUser() user: AuthenticatedUserType,
    @Ip() requestIp: string,
  ): Promise<AssetResponseDTO> {
    try {
      const asset = await this.releaseQuarantinedAssetUseCase.execute({
        publicId,
        reviewerId: user.emailAddress,
        note: body.note,
        requestIp,
      });
      return await this.toResponseDto(asset);
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  @Post(":publicId/reject")
  @HttpCode(HttpStatus.OK)
  @AuthenticatedEndpoint()
  @EndpointRequiredRoles([ApplicationRole.CONTENT_REVIEWER, ApplicationRole.PLATFORM_OPERATOR])
  @ApiOperation({
    summary: "Reject a quarantined asset",
    description:
      "Content-reviewer only. Marks the asset terminal in `rejected`. The original bytes remain in `_quarantined/<key>` until the namespace retention sweep removes them. Refuses when the asset is not currently quarantined or is under legal hold.",
  })
  @ApiOkResponse({ type: AssetResponseDTO })
  async reject(
    @Param("publicId") publicId: string,
    @Body() body: RejectQuarantinedAssetRequestDTO,
    @AuthenticatedUser() user: AuthenticatedUserType,
  ): Promise<AssetResponseDTO> {
    try {
      const asset = await this.rejectQuarantinedAssetUseCase.execute({
        publicId,
        reviewerId: user.emailAddress,
        note: body.note,
      });
      return await this.toResponseDto(asset);
    } catch (err) {
      if (err instanceof AssetNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }
}
