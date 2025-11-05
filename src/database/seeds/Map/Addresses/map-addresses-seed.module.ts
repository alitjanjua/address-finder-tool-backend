import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MapAddressesSeedService } from './map-addresses.seed';
import {
  MapAddress,
  MapAddressSchema,
} from '../../../../map/addresses/schemas/map-address.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: MapAddress.name,
        schema: MapAddressSchema,
      },
    ]),
  ],
  providers: [MapAddressesSeedService],
  exports: [MapAddressesSeedService],
})
export class MapAddressesSeedModule {}
