# Map Addresses Seed Service

This service provides functionality to seed the Map Addresses collection in MongoDB with GeoJSON data.

## Features

- Seed from single GeoJSON file (JSONL format - one JSON object per line)
- Duplicate detection and skipping
- Collection statistics
- Clear collection functionality

## Usage

### Command Line

```bash
# Seed from a single file
npm run seed:map-addresses file ./files/addresses.geojson
npm run seed:map-addresses file ./files/addresses.featurecollection.geojson

# Get collection statistics
npm run seed:map-addresses stats

# Clear collection
npm run seed:map-addresses clear
```

## File Structure

```
src/database/seeds/Map/
├── seed.module.ts              # Main Map seed module
└── Addresses/
    ├── map-addresses.seed.ts       # Main seed service
    ├── map-addresses-seed.module.ts # Seed module for Map Addresses
    ├── run-seed.ts             # Command line runner
    └── README.md               # This file
```

## Configuration

The service expects GeoJSON files with the following structure (JSONL format):

```json
{
  "type": "Feature",
  "properties": {
    "hash": "be2a3225de8ac6a3",
    "number": "4",
    "street": "Oranjeweg",
    "unit": "",
    "city": "Appingedam",
    "district": "",
    "region": "",
    "postcode": "9901 CK",
    "id": "0003010000126739"
  },
  "geometry": { "type": "Point", "coordinates": [6.8636568, 53.3246772] }
}
```

Each line should contain a complete GeoJSON Feature object with:

- `type`: "Feature"
- `geometry`: Point geometry with coordinates [longitude, latitude]
- `properties`: Address properties including hash, number, street, city, postcode, and id

## Duplicate Detection

The service uses the `properties.id` field to detect duplicates. If a document with the same ID already exists, it will be skipped.

## Error Handling

- Invalid GeoJSON features are logged and skipped
- Individual feature processing errors are logged but don't stop the entire process
- File system errors are properly handled and reported

## Dependencies

- `@nestjs/mongoose` - MongoDB integration
- `mongoose` - MongoDB ODM
- `fs` - File system operations
- `path` - Path utilities

## Integration

The seed service is designed to run independently of the main application, using its own MongoDB connection and module structure.
