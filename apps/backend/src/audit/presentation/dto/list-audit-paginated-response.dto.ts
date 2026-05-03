import { AuditEntryResponseDTO, makePaginatedResponseDto } from "@shared/backend-api";

export class PaginatedAuditEntryResponseDTO extends makePaginatedResponseDto(
  AuditEntryResponseDTO,
) {}
