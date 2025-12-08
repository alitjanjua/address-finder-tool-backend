**Address Finder Backend**

- Fast search across addresses by street, number, postcode, city, district, and region
- Spatial queries: find addresses within a polygon (WKT) and near a point
- Built with NestJS, MongoDB (Mongoose), and GeoJSON indexes

**Tech Stack**
- `NestJS 11` for the HTTP API
- `MongoDB` via `@nestjs/mongoose` and `mongoose`
- `GeoJSON` types and MongoDB `2dsphere` queries
- `TypeScript` and `ts-jest` for development and tests

**Folder Structure**
- `src/` application source code
- `src/map/addresses/` address domain
- `src/map/addresses/map-addresses.controller.ts` routes for queries
- `src/map/addresses/map-addresses.service.ts` search + spatial logic
- `src/map/addresses/dto/` request/response DTOs
- `src/database/` configuration and (optional) seeds
- `dist/` compiled output from `yarn build`

**Prerequisites**
- `Node.js` `22.16.0` (use `nvm`): `nvm use`
- `Yarn` classic (`1.x`)
- `MongoDB` running locally or accessible via URI

**Environment Setup**
- Create `.env` at project root. Minimal Mongo config examples:
- Option A: single URL
  - `DATABASE_TYPE=mongodb`
  - `DATABASE_URL=mongodb://localhost:27017/`
  - `DATABASE_NAME=addresses`
- Option B: discrete fields
  - `DATABASE_TYPE=mongodb`
  - `DATABASE_HOST=localhost`
  - `DATABASE_PORT=27017`
  - `DATABASE_USERNAME=` (optional)
  - `DATABASE_PASSWORD=` (optional)
  - `DATABASE_NAME=addresses`

**Install & Build**
- `nvm use`
- `yarn install --check-files`
- `yarn build`

**Run**
- `yarn start` for production build (`dist`)
- `yarn start:dev` for watch mode (TypeScript)

**API Overview**
- Base path: `/api`

- `GET /api/map/addresses` — search and list addresses
  - Query params:
    - `searchQuery` free text to match across fields
    - `limit` optional maximum results (e.g., `50`)
  - Example:
    - `curl "http://localhost:3000/api/map/addresses?searchQuery=Johanna%20van%20Burenlaan&limit=50"`

- `POST /api/map/addresses/within-polygon` — addresses inside a WKT polygon
  - Body (JSON):
    - `searchRegion` WKT string for `POLYGON(...)`
    - `limit` optional result cap (default `1000`)
    - `batchSize` optional pagination window
    - `cursor` optional last `_id` from previous batch
  - Example:
    - `curl -X POST http://localhost:3000/api/map/addresses/within-polygon \
      -H "Content-Type: application/json" \
      -d '{
        "searchRegion": "POLYGON((-118.25474 34.22242, -118.25748 34.21560, -118.26160 34.20652, -118.28769 34.16335))",
        "limit": 500
      }'`

- `POST /api/map/addresses/near-point` — addresses near `[lon, lat]`
  - Body (JSON):
    - `point` `[longitude, latitude]` (e.g., `[6.8636568, 53.3246772]`)
    - `maxDistance` optional meters (default `1000`)
    - `filters` optional field filters:
      - `city`, `street`, `postcode`, `district`, `region` as arrays or comma strings
      - `number` as a single string
  - Example:
    - `curl -X POST http://localhost:3000/api/map/addresses/near-point \
      -H "Content-Type: application/json" \
      -d '{
        "point": [6.8636568, 53.3246772],
        "maxDistance": 1500,
        "filters": { "city": ["Amsterdam"], "street": "Johanna van Burenlaan" }
      }'`

**Indexes & Performance**
- MongoDB indexes on `geometry` (`2dsphere`) and `properties` fields (street, number, postcode, city, id, hash)
- Search blends exact/prefix matching with token-based scoring for relevance

**Common Commands**
- `yarn lint` run ESLint
- `yarn test` run Jest unit tests
- `yarn start:prod` run compiled app (`node dist/main`)

**Troubleshooting**
- Node/CJS-ESM interop errors (e.g., `wrap-ansi`/`string-width`): use `nvm use 22.16.0` and `yarn install --check-files`.
- If you switched Node versions, reinstall modules: `rm -rf node_modules && yarn install`.
- Ensure MongoDB is reachable at the URI configured in `.env`.

**License**
- MIT