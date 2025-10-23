import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MapAddressDocument = MapAddress & Document;

@Schema({ timestamps: true, collection: 'addresses' })
export class MapAddress {
  @Prop({ required: true })
  type: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({
    type: {
      hash: String,
      number: String,
      street: String,
      unit: String,
      city: String,
      district: String,
      region: String,
      postcode: String,
      id: String,
    },
    required: true,
    _id: false, // Prevent MongoDB from creating _id for this subdocument
  })
  properties: {
    hash: string;
    number: string;
    street: string;
    unit: string;
    city: string;
    district: string;
    region: string;
    postcode: string;
    id: string;
  };
}

export const MapAddressSchema = SchemaFactory.createForClass(MapAddress);

// Create 2dsphere index for efficient spatial queries
MapAddressSchema.index({ geometry: '2dsphere' });

// Create unique index on properties.id to prevent duplicates
MapAddressSchema.index({ 'properties.id': 1 }, { unique: true });

// Create unique index on properties.hash as secondary unique identifier
MapAddressSchema.index({ 'properties.hash': 1 }, { unique: true });

// Create compound indexes for common query patterns
MapAddressSchema.index({ 'properties.city': 1, geometry: '2dsphere' });
MapAddressSchema.index({ 'properties.postcode': 1, geometry: '2dsphere' });
MapAddressSchema.index({ 'properties.street': 1 });
