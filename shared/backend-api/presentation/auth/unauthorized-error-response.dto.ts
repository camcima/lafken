import { UnauthorizedException } from "@nestjs/common";

import { makeDomainErrorResponseDto } from "../../shared/errors-response-dto-factories";

export class UnauthorizedErrorResponseDTO extends makeDomainErrorResponseDto(
  UnauthorizedException,
) {}
