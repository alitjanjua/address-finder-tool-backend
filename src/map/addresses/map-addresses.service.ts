import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MapAddressesFilterDto } from './dto/map-addresses-filter.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { MapAddressResponseDto } from './dto/map-address-response.dto';
import { MapAddress, MapAddressDocument } from './schemas/map-address.schema';
import { MultiPolygonDto, PolygonDto } from './dto/spatial-query.dto';

@Injectable()
export class MapAddressesService {
  constructor(
    @InjectModel(MapAddress.name)
    private mapAddressModel: Model<MapAddressDocument>,
  ) {}

  async getAddresses(
    searchQuery: SearchQueryDto,
    limit: number = 100,
  ): Promise<MapAddressResponseDto> {
    try {
      // Build MongoDB query based on search query only
      const query: any = {};

      // Handle searchQuery - search across multiple fields
      if (searchQuery.searchQuery) {
        const searchRegex = new RegExp(
          searchQuery.searchQuery.toLowerCase(),
          'i',
        );
        query.$or = [
          { 'properties.city': searchRegex },
          { 'properties.street': searchRegex },
          { 'properties.postcode': searchRegex },
          { 'properties.district': searchRegex },
          { 'properties.region': searchRegex },
        ];
      }

      // Get addresses from MongoDB with limit for better performance
      const addresses = await this.mapAddressModel
        .find(query)
        .select('_id type geometry properties')
        .limit(limit)
        .lean()
        .exec();

      const transformedAddresses =
        addresses?.map((address) => ({
          ...address,
          _id: address._id?.toString(),
        })) || [];

      return {
        type: 'FeatureCollection',
        features: transformedAddresses,
      };
    } catch (error) {
      throw new Error(`Failed to fetch map addresses: ${error.message}`);
    }
  }

  async getAddressesWithinPolygon(
    polygon: PolygonDto | MultiPolygonDto,
    limit: number = 1000,
  ): Promise<MapAddressResponseDto> {
    try {
      // Build MongoDB query with spatial filter
      const query: any = {
        geometry: {
          $geoWithin: {
            $geometry: polygon,
          },
        },
      };

      // Get addresses within polygon using spatial query with optimizations
      const addresses = await this.mapAddressModel
        .find(query)
        .select('_id type geometry properties')
        .limit(limit) // Limit results for better performance
        .lean() // Use lean() for better performance (returns plain JS objects)
        .exec();

      const transformedAddresses =
        addresses?.map((address) => ({
          ...address,
          _id: address._id?.toString(),
        })) || [];

      return {
        type: 'FeatureCollection',
        features: transformedAddresses,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch addresses within polygon: ${error.message}`,
      );
    }
  }

  async getAddressesNearPoint(
    point: [number, number],
    maxDistance: number = 1000, // in meters
    additionalFilters?: MapAddressesFilterDto,
  ): Promise<MapAddressResponseDto> {
    try {
      // Build MongoDB query with spatial filter
      const query: any = {
        geometry: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: point,
            },
            $maxDistance: maxDistance,
          },
        },
      };

      // Add additional filters if provided
      if (additionalFilters) {
        if (additionalFilters.city && additionalFilters.city.length > 0) {
          const cityRegex = additionalFilters.city.map(
            (city) => new RegExp(city.toLowerCase(), 'i'),
          );
          query['properties.city'] = { $in: cityRegex };
        }

        if (additionalFilters.street && additionalFilters.street.length > 0) {
          const streetRegex = additionalFilters.street.map(
            (street) => new RegExp(street.toLowerCase(), 'i'),
          );
          query['properties.street'] = { $in: streetRegex };
        }

        if (
          additionalFilters.postcode &&
          additionalFilters.postcode.length > 0
        ) {
          const postcodeRegex = additionalFilters.postcode.map(
            (postcode) => new RegExp(postcode.toLowerCase(), 'i'),
          );
          query['properties.postcode'] = { $in: postcodeRegex };
        }

        if (
          additionalFilters.district &&
          additionalFilters.district.length > 0
        ) {
          const districtRegex = additionalFilters.district.map(
            (district) => new RegExp(district.toLowerCase(), 'i'),
          );
          query['properties.district'] = { $in: districtRegex };
        }

        if (additionalFilters.region && additionalFilters.region.length > 0) {
          const regionRegex = additionalFilters.region.map(
            (region) => new RegExp(region.toLowerCase(), 'i'),
          );
          query['properties.region'] = { $in: regionRegex };
        }

        if (additionalFilters.number) {
          query['properties.number'] = {
            $regex: additionalFilters.number,
            $options: 'i',
          };
        }
      }

      // Get addresses near point using spatial query
      const addresses = await this.mapAddressModel
        .find(query)
        .select('_id type geometry properties')
        .lean()
        .exec();

      const transformedAddresses =
        addresses?.map((address) => ({
          ...address,
          _id: address._id?.toString(),
        })) || [];

      return {
        type: 'FeatureCollection',
        features: transformedAddresses,
      };
    } catch (error) {
      throw new Error(`Failed to fetch addresses near point: ${error.message}`);
    }
  }
}
