import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ListAuditQueryDTO } from "@shared/backend-api";

import { ListAuditEntriesUseCase } from "@/audit/application/use-cases/list-audit-entries.use-case";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";
import { EndpointRequiredRoles } from "@/shared/presentation/auth/decorators/endpoint-required-roles.decorator";

import { PaginatedAuditEntryResponseDTO } from "../dto/list-audit-paginated-response.dto";
import { AuditEntryResponseMapper } from "../mappers/audit-entry.response-mapper";

@Controller({ path: "audit" })
@ApiTags("Audit")
export class AuditController {
  constructor(private readonly listAuditEntriesUseCase: ListAuditEntriesUseCase) {}

  @Get()
  @EndpointRequiredRoles([ApplicationRole.PLATFORM_OPERATOR])
  @ApiOperation({ summary: "List audit log entries" })
  @ApiOkResponse({ type: PaginatedAuditEntryResponseDTO })
  async list(@Query() query: ListAuditQueryDTO): Promise<PaginatedAuditEntryResponseDTO> {
    const page = await this.listAuditEntriesUseCase.execute({
      page: query.page,
      limit: query.limit,
      principal: query.principal,
      action: query.action,
      entityType: query.entityType,
      entityId: query.entityId,
      occurredFrom: query.occurredFrom,
      occurredTo: query.occurredTo,
    });

    return {
      data: page.data.map((entry) => AuditEntryResponseMapper.fromDomain(entry)),
      total: page.total,
      page: page.page,
      limit: page.limit,
      lastPage: page.lastPage,
    };
  }
}
