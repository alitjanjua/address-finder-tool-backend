import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MapAddressesService } from './map-addresses.service';
import { MapAddressesFilterDto } from './dto/map-addresses-filter.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { MapAddressResponseDto } from './dto/map-address-response.dto';
import {
  WithinPolygonRequestDto,
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
    @Query() filters: MapAddressesFilterDto,
  ): Promise<MapAddressResponseDto> {
    return this.mapAddressesService.getAddresses(searchQuery, filters);
  }

  @ApiOperation({ summary: 'Get addresses within a polygon or multipolygon' })
  @ApiResponse({
    status: 200,
    description: 'Returns addresses within the specified polygon',
    type: MapAddressResponseDto,
  })
  @Post('within-polygon')
  async getAddressesWithinPolygon(
    @Body() body: WithinPolygonRequestDto,
  ): Promise<MapAddressResponseDto> {
    return this.mapAddressesService.getAddressesWithinPolygon(
      body.polygon,
      body.filters,
    );
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
