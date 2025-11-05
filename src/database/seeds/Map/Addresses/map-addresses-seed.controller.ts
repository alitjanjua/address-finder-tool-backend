import { Controller, Post, Get, Delete, Body } from '@nestjs/common';
import { MapAddressesSeedService } from './map-addresses.seed';

@Controller('map-addresses/seed')
export class MapAddressesSeedController {
  constructor(private readonly seedService: MapAddressesSeedService) {}

  @Post('from-file')
  async seedFromFile(@Body() body: { filePath: string }) {
    return this.seedService.seedFromFile(body.filePath);
  }

  @Get('stats')
  async getStats() {
    return this.seedService.getCollectionStats();
  }

  @Delete('clear')
  async clearCollection() {
    return this.seedService.clearCollection();
  }
}
