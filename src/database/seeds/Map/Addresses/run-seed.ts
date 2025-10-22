import { NestFactory } from '@nestjs/core';
import { MapSeedModule } from '../seed.module';
import { MapAddressesSeedService } from './map-addresses.seed';

async function runSeed() {
  const app = await NestFactory.createApplicationContext(MapSeedModule);
  const seedService = app.get(MapAddressesSeedService);

  const command = process.argv[2];
  const filePath = process.argv[3];

  try {
    switch (command) {
      case 'file':
        if (!filePath) {
          console.error('Please provide a file path');
          process.exit(1);
        }
        const result = await seedService.seedFromFile(filePath);
        console.log(result.message);
        break;
      case 'stats':
        const stats = await seedService.getCollectionStats();
        console.log('Collection Statistics:');
        console.log(`Total addresses: ${stats.totalAddresses}`);
        console.log('Top cities:', stats.cities);
        console.log('Top streets:', stats.streets);
        break;
      case 'clear':
        const clearResult = await seedService.clearCollection();
        console.log(clearResult.message);
        break;
      default:
        console.log('Usage:');
        console.log('  npm run seed:map-addresses file <file-path>');
        console.log('  npm run seed:map-addresses stats');
        console.log('  npm run seed:map-addresses clear');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

void runSeed();
