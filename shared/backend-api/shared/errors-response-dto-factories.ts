/* eslint-disable max-classes-per-file */
import { Type as Constructor, mixin } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

export function makeDomainErrorResponseDto<T extends Constructor>(ResourceCls: T) {
  const isNativeHttpException = Object.getPrototypeOf(ResourceCls)?.name === "HttpException";

  if (isNativeHttpException) {
    class BaseProblemDetailsDomainErrorResponseDTO {
      @ApiProperty()
      type: string;

      @ApiProperty({
        enum: [ResourceCls.name],
      })
      title: string;

      @ApiProperty()
      status: number;

      @ApiProperty()
      detail: string;

      @ApiProperty({
        type: [Object],
      })
      errors: unknown[];
    }

    Object.defineProperty(BaseProblemDetailsDomainErrorResponseDTO, "name", {
      value: `DomainErrorResponseDTO<${ResourceCls.name}>`,
    });

    return mixin(BaseProblemDetailsDomainErrorResponseDTO);
  } else {
    class BaseProblemDetailsDomainErrorResponseDTO {
      @ApiProperty()
      type: string;

      @ApiProperty({
        enum: [ResourceCls.name],
      })
      title: string;

      @ApiProperty()
      status: number;

      @ApiProperty()
      detail: string;
    }

    Object.defineProperty(BaseProblemDetailsDomainErrorResponseDTO, "name", {
      value: `DomainErrorResponseDTO<${ResourceCls.name}>`,
    });

    return mixin(BaseProblemDetailsDomainErrorResponseDTO);
  }
}
