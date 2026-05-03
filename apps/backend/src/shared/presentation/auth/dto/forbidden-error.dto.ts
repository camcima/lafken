import { ForbiddenException } from "@nestjs/common";

import { makeDomainErrorResponseDto } from "@/shared/presentation/documentation/errors-response-dto-factories";

export class ForbiddenErrorResponseDTO extends makeDomainErrorResponseDto(ForbiddenException) {}
