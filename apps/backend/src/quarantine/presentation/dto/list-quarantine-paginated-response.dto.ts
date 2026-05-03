import { makePaginatedResponseDto, QuarantinedAssetResponseDTO } from "@shared/backend-api";

export class PaginatedQuarantinedAssetResponseDTO extends makePaginatedResponseDto(
  QuarantinedAssetResponseDTO,
) {}
