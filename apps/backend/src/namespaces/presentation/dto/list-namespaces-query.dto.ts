import {
  makePaginatedRequestInputDto,
  makePaginatedResponseDto,
  NamespaceResponseDTO,
} from "@shared/backend-api";

export class ListNamespacesQueryDTO extends makePaginatedRequestInputDto() {}
export class PaginatedNamespacesResponseDTO extends makePaginatedResponseDto(
  NamespaceResponseDTO,
) {}
