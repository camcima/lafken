/* eslint-disable no-magic-numbers */
/* eslint-disable max-classes-per-file */
import { Type as Constructor, mixin } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, Min } from "class-validator";

import type { PaginatedResult } from "./paginated-result.interface";

/**
 * @returns A DTO class that expects `data`, `total`, `limit`, `page`, `lastPage`, and `more` properties.
 */
export function makePaginatedResponseDto<T extends Constructor>(ResourceCls: T) {
  class BasePaginedResponseDTO implements PaginatedResult<T> {
    @ApiProperty({ type: [ResourceCls] })
    data: InstanceType<T>[];

    @ApiProperty()
    total: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    lastPage: number;
  }

  Object.defineProperty(BasePaginedResponseDTO, "name", {
    value: `PaginatedResponseDTO<${ResourceCls.name}>`,
  });

  return mixin(BasePaginedResponseDTO);
}

/**
 * @returns A DTO class that expects `page`, `limit`, `order`, `orderBy`
 * properties as input. Where:
 * - `page` defaults to 1
 * - `limit` defaults to 20
 * - `order` defaults to `"desc"`
 */
export function makePaginatedRequestInputDto() {
  class BasePaginedQueryDTO {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @ApiProperty({
      default: 1,
      required: false,
    })
    page: number = 1;

    @Type(() => Number)
    @IsInt()
    @Min(0)
    @ApiProperty({
      default: 20,
      required: false,
    })
    limit: number = 20;

    @Type(() => String)
    @IsArray()
    @IsOptional()
    @Transform(({ value }): unknown => {
      return Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : value;
    })
    @IsIn(["desc", "asc"], { each: true })
    @ApiProperty({
      default: ["desc"],
      required: false,
      enum: ["desc", "asc"],
      type: [String],
    })
    order: ("desc" | "asc")[] = ["desc"];

    @Type(() => String)
    @IsArray()
    @IsOptional()
    @Transform(({ value }): unknown => {
      return Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : value;
    })
    @ApiProperty({
      required: false,
      type: [String],
    })
    orderBy?: string[];
  }

  return mixin(BasePaginedQueryDTO);
}
