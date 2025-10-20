#!/usr/bin/env node

import { NestFactory } from '@nestjs/core';
import { MapSeedModule } from '../seed.module';
import { MapAreasSeedService } from './map-areas.seed';

async function bootstrap() {
  console.log('Starting Map Areas Seed Service...');

  try {
    const app = await NestFactory.createApplicationContext(MapSeedModule, {
      logger: ['error', 'warn', 'log'],
    });

    console.log('Application context created successfully');

    const seedService = app.get(MapAreasSeedService);
    console.log('Seed service retrieved successfully');

    const command = process.argv[2];
    const path = process.argv[3];

    try {
      switch (command) {
        case 'file':
          if (!path) {
            console.error('Please provide a file path');
            process.exit(1);
          }
          console.log(`Seeding from file: ${path}`);
          const fileResult = await seedService.seedFromFile(path);
          console.log(fileResult.message);
          break;

        case 'directory':
          if (!path) {
            console.error('Please provide a directory path');
            process.exit(1);
          }
          console.log(`Seeding from directory: ${path}`);
          const dirResult = await seedService.seedFromDirectory(path);
          console.log(dirResult.message);
          if (dirResult.results) {
            dirResult.results.forEach((result: any) => {
              console.log(`  ${result.file}: ${result.message}`);
            });
          }
          break;

        case 'stats':
          const stats = await seedService.getCollectionStats();
          console.log(stats.message);
          break;

        case 'clear':
          const clearResult = await seedService.clearCollection();
          console.log(clearResult.message);
          break;

        case 'clearByLayerType':
          const layerType = process.argv[3];
          if (!layerType) {
            console.error('Please provide a layerType value');
            process.exit(1);
          }
          const clearByLayerResult = await seedService.clearByFilter({
            'properties.layerType': layerType,
          });
          console.log(clearByLayerResult.message);
          break;

        default:
          console.log(`
Usage: npm run seed:map-areas <command> [path]

Commands:
  file <path>     - Seed from a single GeoJSON file
  directory <path> - Seed from all GeoJSON files in a directory
  stats           - Show collection statistics
  clear           - Clear all data from collection
  clearByLayerType <layerType> - Clear all data with a specific layerType

Examples:
  npm run seed:map-areas file ./files/sisteco_default_areas.geojson
  npm run seed:map-areas directory ./files
  npm run seed:map-areas stats
  npm run seed:map-areas clear
  npm run seed:map-areas clearByLayerType sentieri
        `);
      }
    } catch (error) {
      console.error('Error during seeding:', error.message);
      if (error.stack) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    } finally {
      await app.close();
      console.log('Application context closed');
    }
  } catch (error) {
    console.error('Failed to create application context:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

void bootstrap();
