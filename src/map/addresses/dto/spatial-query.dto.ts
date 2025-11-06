import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
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

// New DTO for POST-based region query
export class WithinRegionRequestDto {
  @ApiPropertyOptional({
    description:
      'WKT string representing a POLYGON or MULTIPOLYGON. Example: POLYGON((lon lat, ...))',
    example:
      'POLYGON((-118.25474027440879 34.222418907924144, -118.25748685620879 34.215605510930345, -118.26160672890876 34.206520124511734, -118.2684731834087 34.19516201418956, -118.27533963790867 34.183802373759455, -118.28220609240864 34.17244120346186, -118.2876992560086 34.16335116588097))',
  })
  @IsString()
  searchRegion: string;

  @ApiPropertyOptional({
    description: 'Maximum number of features to return',
    default: 1000,
  })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Batch size for pagination',
    default: 1000,
  })
  @IsOptional()
  @IsNumber()
  batchSize?: number;

  @ApiPropertyOptional({
    description: 'Opaque cursor string (last _id from previous batch)',
  })
  @IsOptional()
  cursor?: string;
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
}
