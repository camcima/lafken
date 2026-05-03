import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListQuarantineQueryDTO } from "@shared/backend-api";

import { ListQuarantinedAssetsUseCase } from "@/quarantine/application/use-cases/list-quarantined-assets.use-case";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";

import { PaginatedQuarantinedAssetResponseDTO } from "../dto/list-quarantine-paginated-response.dto";
import { QuarantinedAssetResponseMapper } from "../mappers/quarantined-asset.response-mapper";

@Controller({ path: "quarantine" })
@ApiTags("Quarantine")
export class QuarantineController {
  constructor(private readonly listQuarantinedAssetsUseCase: ListQuarantinedAssetsUseCase) {}

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
}
