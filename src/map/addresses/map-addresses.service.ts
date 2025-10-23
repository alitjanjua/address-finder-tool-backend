import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MapAddressesFilterDto } from './dto/map-addresses-filter.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { MapAddressResponseDto } from './dto/map-address-response.dto';
import { MapAddress, MapAddressDocument } from './schemas/map-address.schema';

@Injectable()
export class MapAddressesService {
  constructor(
    @InjectModel(MapAddress.name)
    private mapAddressModel: Model<MapAddressDocument>,
  ) {}

  async getAddresses(
    searchQuery: SearchQueryDto,
    filters: MapAddressesFilterDto,
  ): Promise<MapAddressResponseDto> {
    try {
      // Build MongoDB query based on search query and filters
      const query: any = {};
      const specificFilters: any = {};

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

      // Build specific field filters separately
      if (filters.city && filters.city.length > 0) {
        const cityRegex = filters.city.map(
          (city) => new RegExp(city.toLowerCase(), 'i'),
        );
        specificFilters['properties.city'] = { $in: cityRegex };
      }

      if (filters.street && filters.street.length > 0) {
        const streetRegex = filters.street.map(
          (street) => new RegExp(street.toLowerCase(), 'i'),
        );
        specificFilters['properties.street'] = { $in: streetRegex };
      }

      if (filters.postcode && filters.postcode.length > 0) {
        const postcodeRegex = filters.postcode.map(
          (postcode) => new RegExp(postcode.toLowerCase(), 'i'),
        );
        specificFilters['properties.postcode'] = { $in: postcodeRegex };
      }

      if (filters.district && filters.district.length > 0) {
        const districtRegex = filters.district.map(
          (district) => new RegExp(district.toLowerCase(), 'i'),
        );
        specificFilters['properties.district'] = { $in: districtRegex };
      }

      if (filters.region && filters.region.length > 0) {
        const regionRegex = filters.region.map(
          (region) => new RegExp(region.toLowerCase(), 'i'),
        );
        specificFilters['properties.region'] = { $in: regionRegex };
      }

      if (filters.number) {
        specificFilters['properties.number'] = {
          $regex: filters.number,
          $options: 'i',
        };
      }

      // Combine searchQuery and specific filters properly
      if (Object.keys(specificFilters).length > 0) {
        if (query.$or) {
          // Both searchQuery and specific filters: use $and to combine them
          query.$and = [{ $or: query.$or }, specificFilters];
          delete query.$or;
        } else {
          // Only specific filters
          Object.assign(query, specificFilters);
        }
      }

      // Get filtered addresses from MongoDB
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
      throw new Error(`Failed to fetch map addresses: ${error.message}`);
    }
  }

  async getAddressesWithinPolygon(
    polygon: any,
    additionalFilters?: MapAddressesFilterDto,
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

      // Get addresses within polygon using spatial query
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
