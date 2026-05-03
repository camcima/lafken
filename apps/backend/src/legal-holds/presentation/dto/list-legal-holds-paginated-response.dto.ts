import {
  LegalHoldResponseDTO,
  makePaginatedRequestInputDto,
  makePaginatedResponseDto,
} from "@shared/backend-api";

export class ListLegalHoldsQueryDTO extends makePaginatedRequestInputDto() {}
export class PaginatedLegalHoldResponseDTO extends makePaginatedResponseDto(LegalHoldResponseDTO) {}
