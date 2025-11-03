import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MapAddressesFilterDto } from './dto/map-addresses-filter.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { MapAddressResponseDto } from './dto/map-address-response.dto';
import { MapAddress, MapAddressDocument } from './schemas/map-address.schema';
import {
  MultiPolygonDto,
  PolygonDto,
  WithinRegionRequestDto,
} from './dto/spatial-query.dto';

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

  // New POST-based region method: accepts WKT or map bounds
  async getAddressesWithinRegion(
    body: WithinRegionRequestDto,
  ): Promise<MapAddressResponseDto> {
    try {
      const limit = body.limit ?? 1000;

      // Decide the geometry source
      let region: PolygonDto | MultiPolygonDto | undefined;

      if (body.searchRegion) {
        region = this.parseWktRegion(body.searchRegion);
      } else if (body.mapbounds) {
        region = this.buildPolygonFromBounds(body.mapbounds);
      }

      if (!region) {
        throw new Error(
          'Either searchRegion (WKT POLYGON/MULTIPOLYGON) or mapbounds must be provided.',
        );
      }

      const query: any = {
        geometry: {
          $geoWithin: {
            $geometry: region,
          },
        },
      };

      const addresses = await this.mapAddressModel
        .find(query)
        .hint('geometry_2dsphere')
        .select('_id type geometry properties')
        .limit(limit)
        .lean()
        .exec();

      const features =
        addresses?.map((address) => ({
          ...address,
          _id: address._id?.toString(),
        })) || [];

      return { type: 'FeatureCollection', features };
    } catch (error) {
      throw new Error(
        `Failed to fetch addresses within region: ${error.message}`,
      );
    }
  }

  // Minimal WKT parser for POLYGON and MULTIPOLYGON
  private parseWktRegion(wkt: string): PolygonDto | MultiPolygonDto {
    const trimmed = wkt.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('POLYGON')) {
      // POLYGON((lon lat, lon lat, ...)) possibly with inner rings
      const ringsStr = trimmed
        .replace(/^\s*POLYGON\s*\(\(/i, '')
        .replace(/\)\)\s*$/i, '');

      const ringParts = this.splitRings(ringsStr);
      const rings = ringParts.map((part) => this.parseCoordinates(part));

      return { type: 'Polygon', coordinates: rings };
    }

    if (upper.startsWith('MULTIPOLYGON')) {
      // MULTIPOLYGON(((...)),((...)))
      const polysStr = trimmed
        .replace(/^\s*MULTIPOLYGON\s*\(\(\(/i, '')
        .replace(/\)\)\)\s*$/i, '');

      // Split polygons by ')),((', then parse rings within each
      const polygonParts = polysStr.split(/\)\)\s*,\s*\(\(/);
      const polygons = polygonParts.map((polyStr) => {
        const ringParts = this.splitRings(polyStr);
        const rings = ringParts.map((part) => this.parseCoordinates(part));
        return rings;
      });

      return { type: 'MultiPolygon', coordinates: polygons };
    }

    throw new Error('Unsupported WKT type. Use POLYGON or MULTIPOLYGON.');
  }

  private splitRings(ringsStr: string): string[] {
    // Split by '),(' between rings; be tolerant to spaces
    return ringsStr.split(/\)\s*,\s*\(/);
  }

  private parseCoordinates(coordsStr: string): number[][] {
    // Split by comma into points, each point is "lon lat"
    return coordsStr.split(/\s*,\s*/).map((pair) => {
      const [lonStr, latStr] = pair.trim().split(/\s+/);
      const lon = parseFloat(lonStr);
      const lat = parseFloat(latStr);
      if (Number.isNaN(lon) || Number.isNaN(lat)) {
        throw new Error(`Invalid coordinate in WKT: ${pair}`);
      }
      return [lon, lat];
    });
  }

  private buildPolygonFromBounds(bounds: {
    east: number;
    west: number;
    north: number;
    south: number;
  }): PolygonDto {
    const { east, west, north, south } = bounds;
    const ring: number[][] = [
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south], // close ring
    ];

    return { type: 'Polygon', coordinates: [ring] };
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
