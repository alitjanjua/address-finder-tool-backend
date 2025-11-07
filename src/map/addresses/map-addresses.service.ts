import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MapAddressesFilterDto } from './dto/map-addresses-filter.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  MapAddressBatchResponseDto,
  MapAddressResponseDto,
} from './dto/map-address-response.dto';
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

      // Handle searchQuery - match substrings across multiple fields
      if (searchQuery.searchQuery) {
        const raw = searchQuery.searchQuery.toLowerCase();
        // Split on non-alphanumeric separators to support inputs like "App, gedam, pinge"
        const terms = raw
          .split(/[^a-z0-9]+/i)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        const fields = [
          'properties.city',
          'properties.street',
          'properties.postcode',
          'properties.district',
          'properties.region',
        ];

        const escapeRegExp = (s: string) =>
          s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regexes = terms.map((t) => new RegExp(escapeRegExp(t), 'i'));

        if (regexes.length > 0) {
          // OR across all term-field combinations so any substring matches
          query.$or = fields.flatMap((field) =>
            regexes.map((rx) => ({ [field]: rx })),
          );
        }
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

  // New POST-based region method: accepts WKT or map bounds
  async getAddressesWithinPolygon(
    body: WithinRegionRequestDto,
  ): Promise<MapAddressBatchResponseDto> {
    try {
      const batchSize = body.batchSize ?? body.limit ?? 500;

      // Decide the geometry source
      let region: PolygonDto | MultiPolygonDto | undefined;

      if (body.searchRegion) {
        region = this.parseWktRegion(body.searchRegion);
      }

      if (!region) {
        throw new Error(
          'searchRegion (WKT POLYGON/MULTIPOLYGON) must be provided.',
        );
      }

      const query: any = {
        geometry: { $geoWithin: { $geometry: region } },
      };

      // Cursor gating to avoid skip
      if (body.cursor) {
        if (!Types.ObjectId.isValid(body.cursor)) {
          throw new Error(
            'Invalid cursor value: must be a valid ObjectId string',
          );
        }
        query._id = { $gt: new Types.ObjectId(body.cursor) };
      }

      const docs = await this.mapAddressModel
        .find(query)
        .sort({ _id: 1 })
        .select('_id type geometry properties')
        .limit(batchSize)
        .lean()
        .exec();

      const features =
        docs?.map((d) => ({ ...d, _id: d._id?.toString() })) || [];
      const last = docs.length ? docs[docs.length - 1]._id?.toString() : null;
      const hasMore = docs.length === batchSize;

      return {
        geojson: {
          type: 'FeatureCollection',
          features,
        },
        nextCursor: last ?? null,
        hasMore,
      };
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
