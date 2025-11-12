import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import {
  MapAddress,
  MapAddressDocument,
} from '../../../../map/addresses/schemas/map-address.schema';

@Injectable()
export class MapAddressesSeedService {
  private readonly readFileAsync = promisify(fs.readFile);
  private readonly CHUNK_SIZE = 1000; // Process 1000 features at a time to reduce memory usage

  constructor(
    @InjectModel(MapAddress.name)
    private mapAddressModel: Model<MapAddressDocument>,
  ) {}

  async seedFromFile(
    filePath: string,
  ): Promise<{ success: boolean; message: string; count: number }> {
    try {
      // Read the file in chunks for large files
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      const stats = await fs.promises.stat(fullPath);
      const fileSizeInMB = stats.size / (1024 * 1024);

      console.log(`File size: ${fileSizeInMB.toFixed(2)} MB`);

      let insertedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let processedLines = 0;

      // Detect if the input file is a GeoJSON FeatureCollection
      const isFeatureCollection = await this.isFeatureCollectionFile(fullPath);

      if (isFeatureCollection) {
        console.log('FeatureCollection detected; streaming features array...');
        const result = await this.seedFromFeatureCollectionStream(fullPath);
        return {
          success: true,
          message: `Address seeding from FeatureCollection completed. Inserted: ${result.inserted}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
          count: result.inserted,
        };
      }

      // For large files, read line by line
      if (fileSizeInMB > 100) {
        // If file is larger than 100MB
        console.log('Large file detected, processing line by line...');

        const fileStream = fs.createReadStream(fullPath, { encoding: 'utf8' });
        let buffer = '';
        let chunkCount = 0;

        return new Promise((resolve, reject) => {
          let isProcessing = false;
          let timeoutId: NodeJS.Timeout;

          // Set up timeout mechanism (30 minutes)
          const resetTimeout = () => {
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(
              () => {
                console.error('Processing timeout after 30 minutes');
                fileStream.destroy();
                reject(new Error('Processing timeout after 30 minutes'));
              },
              30 * 60 * 1000,
            );
          };

          resetTimeout(); // Start the timeout

          fileStream.on('data', async (chunk) => {
            if (isProcessing) {
              // Pause the stream if we're still processing previous data
              fileStream.pause();
              return;
            }

            isProcessing = true;
            resetTimeout(); // Reset timeout on each chunk

            try {
              buffer += chunk;
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep the incomplete line in buffer

              if (lines.length > 0) {
                chunkCount++;
                console.log(
                  `Processing chunk ${chunkCount} (${lines.length} lines)...`,
                );

                const features = lines
                  .map((line) => {
                    try {
                      return JSON.parse(line.trim());
                    } catch {
                      console.warn(
                        `Failed to parse line: ${line.substring(0, 100)}...`,
                      );
                      return null;
                    }
                  })
                  .filter((feature) => feature !== null);

                // Process features in smaller sub-chunks to avoid memory issues
                const subChunks = this.chunkArray(features, this.CHUNK_SIZE);
                for (const subChunk of subChunks) {
                  const result = await this.processFeaturesChunk(subChunk);
                  insertedCount += result.inserted;
                  skippedCount += result.skipped;
                  errorCount += result.errors;
                }
                processedLines += lines.length;

                // Force garbage collection every 100 chunks
                if (chunkCount % 100 === 0) {
                  if (global.gc) {
                    global.gc();
                  }
                  console.log(
                    `Memory cleanup at chunk ${chunkCount}. Inserted so far: ${insertedCount}`,
                  );
                }
              }
            } catch (error) {
              console.error(
                `Error processing chunk ${chunkCount}:`,
                error.message,
              );
              errorCount++;
            } finally {
              isProcessing = false;
              // Resume the stream
              fileStream.resume();
            }
          });

          fileStream.on('end', async () => {
            // Clear timeout
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            // Process remaining buffer
            if (buffer.trim()) {
              try {
                const feature = JSON.parse(buffer.trim());
                const result = await this.processFeaturesChunk([feature]);
                insertedCount += result.inserted;
                skippedCount += result.skipped;
                errorCount += result.errors;
                processedLines++;
              } catch {
                console.warn(
                  `Failed to parse final line: ${buffer.substring(0, 100)}...`,
                );
                errorCount++;
              }
            }

            const message = `Address seeding completed. Processed: ${processedLines}, Inserted: ${insertedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`;
            console.log(message);
            resolve({
              success: true,
              message,
              count: insertedCount,
            });
          });

          fileStream.on('error', (error) => {
            // Clear timeout
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            reject(error);
          });
        });
      } else {
        // For smaller files, read all at once
        const fileContent = await this.readFileAsync(fullPath, 'utf8');
        const lines = fileContent.trim().split('\n');
        const features = lines.map((line) => JSON.parse(line));

        console.log(`Processing ${features.length} address features...`);

        // Process features in chunks
        const chunks = this.chunkArray(features, this.CHUNK_SIZE);

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          console.log(
            `Processing chunk ${i + 1}/${chunks.length} (${chunk.length} features)...`,
          );

          const result = await this.processFeaturesChunk(chunk);
          insertedCount += result.inserted;
          skippedCount += result.skipped;
          errorCount += result.errors;
        }

        const message = `Address seeding completed. Inserted: ${insertedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`;
        console.log(message);

        return {
          success: true,
          message,
          count: insertedCount,
        };
      }
    } catch (error) {
      const errorMessage = `Failed to seed addresses from file: ${error.message}`;
      console.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        count: 0,
      };
    }
  }

  private async isFeatureCollectionFile(fullPath: string): Promise<boolean> {
    try {
      const fd = await fs.promises.open(fullPath, 'r');
      try {
        const { buffer, bytesRead } = await fd.read(
          Buffer.alloc(4096),
          0,
          4096,
          0,
        );
        const prefix = buffer.toString('utf8', 0, bytesRead);
        return (
          prefix.includes('"type":"FeatureCollection"') ||
          prefix.includes('"type": "FeatureCollection"')
        );
      } finally {
        await fd.close();
      }
    } catch {
      return false;
    }
  }

  private async seedFromFeatureCollectionStream(
    fullPath: string,
  ): Promise<{ inserted: number; skipped: number; errors: number }> {
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const featureChunk: any[] = [];
    const CHUNK_SIZE = this.CHUNK_SIZE;

    await new Promise<void>((resolve, reject) => {
      const pipeline = fs
        .createReadStream(fullPath)
        .pipe(parser())
        .pipe(pick({ filter: 'features' }))
        .pipe(streamArray());

      let chunkCounter = 0;

      pipeline.on('data', async ({ value }) => {
        try {
          // Each value is a Feature object
          featureChunk.push(value);
          if (featureChunk.length >= CHUNK_SIZE) {
            chunkCounter++;
            const subChunks = this.chunkArray(
              featureChunk.splice(0, featureChunk.length),
              CHUNK_SIZE,
            );
            for (const subChunk of subChunks) {
              const result = await this.processFeaturesChunk(subChunk);
              insertedCount += result.inserted;
              skippedCount += result.skipped;
              errorCount += result.errors;
            }
            if (chunkCounter % 100 === 0) {
              if (global.gc) {
                global.gc();
              }
              console.log(
                `Memory cleanup at chunk ${chunkCounter}. Inserted so far: ${insertedCount}`,
              );
            }
          }
        } catch (err) {
          console.error(
            'Error processing feature from stream:',
            err?.message || err,
          );
          errorCount++;
        }
      });

      pipeline.on('end', async () => {
        try {
          if (featureChunk.length > 0) {
            const subChunks = this.chunkArray(
              featureChunk.splice(0, featureChunk.length),
              CHUNK_SIZE,
            );
            for (const subChunk of subChunks) {
              const result = await this.processFeaturesChunk(subChunk);
              insertedCount += result.inserted;
              skippedCount += result.skipped;
              errorCount += result.errors;
            }
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      pipeline.on('error', (e) => {
        reject(e);
      });
    });

    return {
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errorCount,
    };
  }

  private async processFeaturesChunk(
    features: any[],
  ): Promise<{ inserted: number; skipped: number; errors: number }> {
    let insertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const bulkOps: any[] = [];

    for (const feature of features) {
      try {
        // Validate feature structure
        if (!this.isValidAddressFeature(feature)) {
          console.warn(`Invalid feature structure: ${JSON.stringify(feature)}`);
          errorCount++;
          continue;
        }

        // Create address document
        const addressDoc = {
          type: feature.type,
          geometry: {
            type: feature.geometry.type,
            coordinates: feature.geometry.coordinates,
          },
          properties: {
            hash: feature.properties.hash,
            number: feature.properties.number,
            street: feature.properties.street,
            unit: feature.properties.unit,
            city: feature.properties.city,
            district: feature.properties.district,
            region: feature.properties.region,
            postcode: feature.properties.postcode,
            id: feature.properties.id,
          },
        };

        // Use upsert operation to handle duplicates efficiently
        // This will insert if not exists, or update if exists (based on unique index)
        bulkOps.push({
          updateOne: {
            filter: {
              'properties.id': feature.properties.id,
            },
            update: {
              $setOnInsert: addressDoc, // Only set fields if inserting (not updating)
            },
            upsert: true,
          },
        });
      } catch (error) {
        console.error(`Error processing feature: ${error.message}`);
        errorCount++;
      }
    }

    // Execute bulk operation
    if (bulkOps.length > 0) {
      try {
        const result = await this.mapAddressModel.bulkWrite(bulkOps);
        insertedCount += result.upsertedCount || 0;
        skippedCount += bulkOps.length - (result.upsertedCount || 0);
      } catch (error) {
        console.error(`Bulk write error: ${error.message}`);
        errorCount += bulkOps.length;
      }
    }

    return {
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errorCount,
    };
  }

  async getCollectionStats(): Promise<{
    totalAddresses: number;
    cities: { city: string; count: number }[];
    streets: { street: string; count: number }[];
  }> {
    try {
      const totalAddresses = await this.mapAddressModel.countDocuments();

      // Get city statistics
      const cityStats = await this.mapAddressModel.aggregate([
        {
          $group: {
            _id: '$properties.city',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
        {
          $project: {
            city: '$_id',
            count: 1,
            _id: 0,
          },
        },
      ]);

      // Get street statistics
      const streetStats = await this.mapAddressModel.aggregate([
        {
          $group: {
            _id: '$properties.street',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
        {
          $project: {
            street: '$_id',
            count: 1,
            _id: 0,
          },
        },
      ]);

      return {
        totalAddresses,
        cities: cityStats,
        streets: streetStats,
      };
    } catch (error) {
      throw new Error(`Failed to get collection stats: ${error.message}`);
    }
  }

  async clearCollection(): Promise<{
    success: boolean;
    message: string;
    count: number;
  }> {
    try {
      const result = await this.mapAddressModel.deleteMany({});
      const message = `Cleared ${result.deletedCount} addresses from collection`;
      console.log(message);
      return {
        success: true,
        message,
        count: result.deletedCount,
      };
    } catch (error) {
      const errorMessage = `Failed to clear collection: ${error.message}`;
      console.error(errorMessage);
      return {
        success: false,
        message: errorMessage,
        count: 0,
      };
    }
  }

  private isValidAddressFeature(feature: any): boolean {
    return (
      feature &&
      feature.type === 'Feature' &&
      feature.geometry &&
      feature.geometry.type === 'Point' &&
      Array.isArray(feature.geometry.coordinates) &&
      feature.geometry.coordinates.length === 2 &&
      feature.properties &&
      typeof feature.properties.id === 'string' &&
      typeof feature.properties.hash === 'string' &&
      typeof feature.properties.number === 'string' &&
      typeof feature.properties.street === 'string' &&
      typeof feature.properties.city === 'string' &&
      typeof feature.properties.postcode === 'string'
    );
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
