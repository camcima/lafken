import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { LegalHoldResponseDTO } from "@shared/backend-api";

import { GetLegalHoldByIdUseCase } from "@/legal-holds/application/use-cases/get-legal-hold-by-id.use-case";
import { ListLegalHoldsUseCase } from "@/legal-holds/application/use-cases/list-legal-holds.use-case";
import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";

import {
  ListLegalHoldsQueryDTO,
  PaginatedLegalHoldResponseDTO,
} from "../dto/list-legal-holds-paginated-response.dto";
import { LegalHoldResponseMapper } from "../mappers/legal-hold.response-mapper";

@Controller({ path: "legal-holds" })
@ApiTags("Legal holds")
export class LegalHoldsController {
  constructor(
    private readonly listLegalHoldsUseCase: ListLegalHoldsUseCase,
    private readonly getLegalHoldByIdUseCase: GetLegalHoldByIdUseCase,
  ) {}

  @Get()
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "List legal holds" })
  @ApiOkResponse({ type: PaginatedLegalHoldResponseDTO })
  async list(@Query() query: ListLegalHoldsQueryDTO): Promise<PaginatedLegalHoldResponseDTO> {
    const page = await this.listLegalHoldsUseCase.execute({
      page: query.page,
      limit: query.limit,
    });

    return {
      data: page.data.map(({ legalHold, affectedAssetCount }) =>
        LegalHoldResponseMapper.fromDomain(legalHold, affectedAssetCount),
      ),
      total: page.total,
      page: page.page,
      limit: page.limit,
      lastPage: page.lastPage,
    };
  }

  @Get(":id")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "Get legal hold by id" })
  @ApiOkResponse({ type: LegalHoldResponseDTO })
  @ApiNotFoundResponse()
  async getOne(@Param("id") id: string): Promise<LegalHoldResponseDTO> {
    try {
      const { legalHold, affectedAssetCount } = await this.getLegalHoldByIdUseCase.execute({ id });
      return LegalHoldResponseMapper.fromDomain(legalHold, affectedAssetCount);
    } catch (err) {
      if (err instanceof LegalHoldNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }
}
