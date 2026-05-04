import { createRfc9457ValidationPipeExceptionFactory } from "@camcima/nestjs-rfc9457";
import { ValidationPipe } from "@nestjs/common";

export class ApiInputValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      exceptionFactory: createRfc9457ValidationPipeExceptionFactory(),
    });
  }
}
