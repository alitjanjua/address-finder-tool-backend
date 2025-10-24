import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MapAddressesService } from './map-addresses.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { MapAddressResponseDto } from './dto/map-address-response.dto';
import {
  WithinPolygonQueryDto,
  NearPointRequestDto,
} from './dto/spatial-query.dto';

@ApiTags('Map')
@Controller({
  path: 'map/addresses',
  version: '1',
})
export class MapAddressesController {
  constructor(private readonly mapAddressesService: MapAddressesService) {}

  @ApiOperation({ summary: 'Get map addresses with search query and filters' })
  @ApiResponse({
    status: 200,
    description: 'Returns filtered map addresses',
    type: MapAddressResponseDto,
  })
  @Get()
  async getAddresses(
    @Query() searchQuery: SearchQueryDto,
    @Query('limit') limit?: number,
  ): Promise<MapAddressResponseDto> {
    return this.mapAddressesService.getAddresses(searchQuery, limit);
  }

  @ApiOperation({ summary: 'Get addresses within a polygon or multipolygon' })
  @ApiResponse({
    status: 200,
    description: 'Returns addresses within the specified polygon',
    type: MapAddressResponseDto,
  })
  @Get('within-polygon')
  async getAddressesWithinPolygon(
    @Query() query: WithinPolygonQueryDto,
    @Query('limit') limit?: number,
  ): Promise<MapAddressResponseDto> {
    try {
      const polygon = JSON.parse(query.polygon);
      return this.mapAddressesService.getAddressesWithinPolygon(polygon, limit);
    } catch {
      throw new Error('Invalid JSON in query parameters');
    }
  }

  @ApiOperation({ summary: 'Get addresses near a point' })
  @ApiResponse({
    status: 200,
    description: 'Returns addresses near the specified point',
    type: MapAddressResponseDto,
  })
  @Post('near-point')
  async getAddressesNearPoint(
    @Body() body: NearPointRequestDto,
  ): Promise<MapAddressResponseDto> {
    return this.mapAddressesService.getAddressesNearPoint(
      body.point,
      body.maxDistance,
      body.filters,
    );
  }
}
