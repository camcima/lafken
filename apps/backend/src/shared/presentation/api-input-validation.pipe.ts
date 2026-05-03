import { ValidationPipe } from "@nestjs/common";

export class ApiInputValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });
  }
}
