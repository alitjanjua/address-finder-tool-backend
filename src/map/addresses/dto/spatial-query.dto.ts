import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MapAddressesFilterDto } from './map-addresses-filter.dto';

export class PolygonDto {
  @ApiProperty({ example: 'Polygon' })
  type: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'number',
        },
      },
    },
    example: [
      [
        [6.8, 53.3],
        [6.9, 53.3],
        [6.9, 53.4],
        [6.8, 53.4],
        [6.8, 53.3],
      ],
    ],
  })
  coordinates: number[][][];
}

export class MultiPolygonDto {
  @ApiProperty({ example: 'MultiPolygon' })
  type: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'array',
          items: {
            type: 'number',
          },
        },
      },
    },
  })
  coordinates: number[][][][];
}

export class NearPointRequestDto {
  @ApiProperty({
    description: 'Point coordinates [longitude, latitude]',
    type: 'array',
    items: { type: 'number' },
    example: [6.8636568, 53.3246772],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  point: [number, number];

  @ApiPropertyOptional({
    description: 'Maximum distance in meters',
    example: 1000,
    default: 1000,
  })
  @IsOptional()
  @IsNumber()
  maxDistance?: number;

  @ApiPropertyOptional({
    description: 'Additional filters to apply',
    type: MapAddressesFilterDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MapAddressesFilterDto)
  filters?: MapAddressesFilterDto;
}

// Query parameter DTOs for GET requests
export class WithinPolygonQueryDto {
  @ApiProperty({
    description: 'Polygon or MultiPolygon geometry as JSON string',
    example:
      '{"type":"Polygon","coordinates":[[[6.8,53.3],[6.9,53.3],[6.9,53.4],[6.8,53.4],[6.8,53.3]]]}',
  })
  @IsOptional()
  polygon: string;

  @ApiPropertyOptional({
    description: 'Additional filters as JSON string',
    example: '{"city":"Amsterdam","postcode":"1012"}',
  })
  @IsOptional()
  filters?: string;
}
