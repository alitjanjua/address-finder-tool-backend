import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MapAreasFilterDto } from './dto/map-areas-filter.dto';
import { MapAreaResponseDto } from './dto/map-area-response.dto';
import { MapArea, MapAreaDocument } from './schemas/map-area.schema';

@Injectable()
export class MapAreasService {
  constructor(
    @InjectModel(MapArea.name) private mapAreaModel: Model<MapAreaDocument>,
  ) {}

  async getAreas(filters: MapAreasFilterDto): Promise<MapAreaResponseDto> {
    try {
      // Build MongoDB query based on filters
      const query: any = {};

      if (filters.layerType) {
        const typeLower = filters.layerType.toLowerCase();
        query['properties.layerType'] = { $regex: typeLower, $options: 'i' };
      }

      if (filters.area && filters.area.length > 0) {
        const areaRegex = filters.area.map(
          (area) => new RegExp(area.toLowerCase(), 'i'),
        );
        query['properties.stato_area'] = { $in: areaRegex };
      }

      if (filters.intervention && filters.intervention.length > 0) {
        const interventionRegex = filters.intervention.map(
          (intervention) => new RegExp(intervention.toLowerCase(), 'i'),
        );
        query['properties.tipo_intervento'] = { $in: interventionRegex };
      }

      if (filters.budget_min) {
        query['properties.budget_min'] = {
          $gte: filters.budget_min,
        };
      }

      if (filters.budget_max) {
        query['properties.budget_max'] = {
          $lte: filters.budget_max,
        };
      }

      if (
        filters.servizi_ecosistemici &&
        filters.servizi_ecosistemici.length > 0
      ) {
        const serviziEcosistemiciRegex = filters.servizi_ecosistemici.map(
          (servizio) => new RegExp(servizio.toLowerCase(), 'i'),
        );
        query['properties.servizi_ecosistemici'] = {
          $elemMatch: { $in: serviziEcosistemiciRegex },
        };
      }

      // Get filtered areas from MongoDB
      const areas = await this.mapAreaModel
        .find(query)
        .select('_id type geometry properties')
        .lean()
        .exec();

      const transformedAreas =
        areas?.map((area) => ({
          ...area,
          _id: area._id?.toString(),
        })) || [];

      return {
        type: 'FeatureCollection',
        features: transformedAreas,
      };
    } catch (error) {
      throw new Error(`Failed to fetch map areas: ${error.message}`);
    }
  }
}
