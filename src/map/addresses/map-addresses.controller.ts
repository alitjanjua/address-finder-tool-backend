import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MapAddressesService } from './map-addresses.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { MapAddressResponseDto } from './dto/map-address-response.dto';
import {
  NearPointRequestDto,
  WithinRegionRequestDto,
} from './dto/spatial-query.dto';
import { MapAddressBatchResponseDto } from './dto/map-address-response.dto';

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
    const numericLimit = limit !== undefined ? Number(limit) : undefined;
    return await this.mapAddressesService.getAddresses(
      searchQuery,
      numericLimit,
    );
  }

  @ApiOperation({
    summary: 'Get addresses within a WKT polygon or multipolygon',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns addresses within the specified polygon',
    type: MapAddressBatchResponseDto,
  })
  @Post('within-polygon')
  async getAddressesWithinPolygon(
    @Body() body: WithinRegionRequestDto,
  ): Promise<MapAddressBatchResponseDto> {
    return await this.mapAddressesService.getAddressesWithinPolygon(body);
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
    return await this.mapAddressesService.getAddressesNearPoint(
      body.point,
      body.maxDistance,
      body.filters,
    );
  }
}
