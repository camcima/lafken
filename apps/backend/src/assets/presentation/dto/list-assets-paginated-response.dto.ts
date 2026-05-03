import { AssetResponseDTO, makePaginatedResponseDto } from "@shared/backend-api";

export class PaginatedAssetResponseDTO extends makePaginatedResponseDto(AssetResponseDTO) {}
