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
import stringSimilarity from 'string-similarity';

@Injectable()
export class MapAddressesService {
  constructor(
    @InjectModel(MapAddress.name)
    private mapAddressModel: Model<MapAddressDocument>,
  ) {}

  async getAddresses(
    searchQuery: SearchQueryDto,
    limit = 100,
  ): Promise<MapAddressResponseDto> {
    try {
      const { searchQuery: searchStr } = searchQuery;
      const fields = [
        'properties.street',
        'properties.number',
        'properties.postcode',
        'properties.city',
      ];

      // No search input → return early
      if (!searchStr || !searchStr.trim()) {
        return { type: 'FeatureCollection', features: [] };
      }

      const normalizedSearch = searchStr.trim().toLowerCase();

      // Tokenize search to allow multi-word precision filtering
      const tokens = normalizedSearch
        .split(/[^a-z0-9]+/i)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const escapeRegExp = (s: string) =>
        s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Build query: require all tokens to appear somewhere ($and of per-token $or)
      const query =
        tokens.length > 0
          ? {
              $and: tokens.map((t) => {
                const rx = new RegExp(escapeRegExp(t), 'i');
                return { $or: fields.map((f) => ({ [f]: rx })) };
              }),
            }
          : { $or: [] };

      // Pull a larger pool so we can rank them by similarity
      const candidates = await this.mapAddressModel
        .find(query)
        .select('_id type geometry properties')
        .limit(Math.max(limit * 2, 100))
        .lean();

      if (candidates.length === 0) {
        return { type: 'FeatureCollection', features: [] };
      }

      // Step 2️⃣: Compute similarity scores with field weighting and prefix boost
      const scored = candidates.map((addr) => {
        const street = String(addr.properties.street || '').toLowerCase();
        const number = String(addr.properties.number || '').toLowerCase();
        const postcode = String(addr.properties.postcode || '').toLowerCase();
        const city = String(addr.properties.city || '').toLowerCase();

        const combined = [street, number, postcode, city]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const combinedScore = stringSimilarity.compareTwoStrings(
          normalizedSearch,
          combined,
        );

        // Field-level scores with weights to emphasize street/city
        const weights = { street: 1.0, city: 0.9, postcode: 0.8, number: 0.5 };
        const fieldScores = [
          stringSimilarity.compareTwoStrings(normalizedSearch, street) *
            weights.street,
          stringSimilarity.compareTwoStrings(normalizedSearch, city) *
            weights.city,
          stringSimilarity.compareTwoStrings(normalizedSearch, postcode) *
            weights.postcode,
          stringSimilarity.compareTwoStrings(normalizedSearch, number) *
            weights.number,
        ];
        const maxFieldScore = Math.max(...fieldScores);

        // Prefix boost when any field starts with the full query
        const startsWith = [street, number, postcode, city].some((t) =>
          t.startsWith(normalizedSearch),
        );
        const prefixBoost = startsWith ? 0.15 : 0;

        const score = Math.min(
          1,
          Math.max(combinedScore, maxFieldScore) + prefixBoost,
        );

        return { ...addr, score };
      });

      // Step 3️⃣: Sort by similarity
      scored.sort((a, b) => b.score - a.score);

      // Step 4️⃣: Determine threshold
      // If any candidate is a "close match" (e.g., score >= 0.75), use only those.
      const bestScore = scored[0].score;
      const threshold = 0.75;

      const closeMatches =
        bestScore >= threshold
          ? scored
              .filter((s) => s.score >= Math.max(0.7, bestScore - 0.08))
              .slice(0, limit)
          : scored.slice(0, limit); // fallback to broader substring/fuzzy matches

      // Step 5️⃣: Transform response
      return {
        type: 'FeatureCollection',
        features: closeMatches.map((a) => ({
          ...a,
          _id: a._id.toString(),
        })),
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
