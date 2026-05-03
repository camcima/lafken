import { UnauthorizedException } from "@nestjs/common";

import { makeDomainErrorResponseDto } from "@/shared/presentation/documentation/errors-response-dto-factories";

export class UnauthorizedErrorResponseDTO extends makeDomainErrorResponseDto(
  UnauthorizedException,
) {}
