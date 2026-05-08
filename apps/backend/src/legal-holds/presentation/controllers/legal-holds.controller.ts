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
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  LegalHoldResponseDTO,
  LiftLegalHoldRequestDTO,
  PlaceLegalHoldRequestDTO,
} from "@shared/backend-api";

import { GetLegalHoldByIdUseCase } from "@/legal-holds/application/use-cases/get-legal-hold-by-id.use-case";
import { LiftLegalHoldUseCase } from "@/legal-holds/application/use-cases/lift-legal-hold.use-case";
import { ListLegalHoldsUseCase } from "@/legal-holds/application/use-cases/list-legal-holds.use-case";
import { PlaceLegalHoldUseCase } from "@/legal-holds/application/use-cases/place-legal-hold.use-case";
import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";
import {
  AuthenticatedUser,
  type AuthenticatedUser as AuthenticatedUserType,
} from "@/shared/presentation/auth/decorators/authenticated-user.decorator";
import { EndpointRequiredRoles } from "@/shared/presentation/auth/decorators/endpoint-required-roles.decorator";

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
    private readonly placeLegalHoldUseCase: PlaceLegalHoldUseCase,
    private readonly liftLegalHoldUseCase: LiftLegalHoldUseCase,
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AuthenticatedEndpoint()
  @EndpointRequiredRoles([ApplicationRole.LEGAL_HOLD_ADMIN, ApplicationRole.PLATFORM_OPERATOR])
  @ApiOperation({
    summary: "Place a legal hold over a set of assets",
    description:
      "Legal-hold-admin only. Places a hold whose case reference and reason are persisted with the picked assets. Idempotent under retry.",
  })
  @ApiCreatedResponse({ type: LegalHoldResponseDTO })
  async place(
    @Body() body: PlaceLegalHoldRequestDTO,
    @AuthenticatedUser() user: AuthenticatedUserType,
    @Ip() requestIp: string,
  ): Promise<LegalHoldResponseDTO> {
    const hold = await this.placeLegalHoldUseCase.execute({
      caseReference: body.caseReference,
      description: body.description,
      assetIds: body.assetIds,
      placedBy: user.emailAddress,
      requestIp,
    });
    return LegalHoldResponseMapper.fromDomain(hold, new Set(body.assetIds).size);
  }

  @Post(":id/lift")
  @HttpCode(HttpStatus.OK)
  @AuthenticatedEndpoint()
  @EndpointRequiredRoles([ApplicationRole.LEGAL_HOLD_ADMIN, ApplicationRole.PLATFORM_OPERATOR])
  @ApiOperation({
    summary: "Lift a legal hold (terminal)",
    description:
      "Legal-hold-admin only. Sets the hold inactive and recomputes the per-asset flag, leaving any asset still under another active hold flagged.",
  })
  @ApiOkResponse({ type: LegalHoldResponseDTO })
  async lift(
    @Param("id") id: string,
    @Body() body: LiftLegalHoldRequestDTO,
    @AuthenticatedUser() user: AuthenticatedUserType,
    @Ip() requestIp: string,
  ): Promise<LegalHoldResponseDTO> {
    try {
      const hold = await this.liftLegalHoldUseCase.execute({
        holdId: id,
        liftedBy: user.emailAddress,
        liftReason: body.liftReason,
        requestIp,
      });
      const affectedAssetCount = await this.computeAffectedAssetCount(id);
      return LegalHoldResponseMapper.fromDomain(hold, affectedAssetCount);
    } catch (err) {
      if (err instanceof LegalHoldNotFoundError) {
        throw new NotFoundException(err.message, { cause: err });
      }
      throw err;
    }
  }

  private async computeAffectedAssetCount(holdId: string): Promise<number> {
    return (await this.getLegalHoldByIdUseCase.execute({ id: holdId })).affectedAssetCount;
  }
}
