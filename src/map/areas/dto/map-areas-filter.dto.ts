import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

export class MapAreasFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by area name(s)',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim());
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  area?: string[];

  @ApiPropertyOptional({
    description: 'Filter by intervention type(s)',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim());
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  intervention?: string[];

  @ApiPropertyOptional({ description: 'Minimum budget value' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === '' ? undefined : Number(value);
    }
    return value;
  })
  @IsNumber()
  budget_min?: number;

  @ApiPropertyOptional({ description: 'Maximum budget value' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === '' ? undefined : Number(value);
    }
    return value;
  })
  @IsNumber()
  budget_max?: number;

  @ApiPropertyOptional({
    description: 'Filter by Servizi Ecosistemici value(s)',
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((item) => item.trim());
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  servizi_ecosistemici?: string[];

  @ApiPropertyOptional({ description: 'Filter by type' })
  @IsOptional()
  @IsString()
  layerType?: string;
}
