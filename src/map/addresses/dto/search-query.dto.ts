import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Search query string to search across city, street, postcode, district, and region fields',
    example: 'Amsterdam Main Street',
  })
  @IsOptional()
  @IsString()
  searchQuery?: string;
}
