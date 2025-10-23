import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MapAddressesController } from './addresses/map-addresses.controller';
import { MapAddressesService } from './addresses/map-addresses.service';
import {
  MapAddress,
  MapAddressSchema,
} from './addresses/schemas/map-address.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MapAddress.name, schema: MapAddressSchema },
    ]),
  ],
  controllers: [MapAddressesController],
  providers: [MapAddressesService],
  exports: [MapAddressesService],
})
export class MapModule {}
