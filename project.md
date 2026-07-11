# TaxiCo Vehicle Tracking API — Project Plan

## Overview

A read-only REST API for a taxi company to track its fleet vehicles across provinces, districts, and police stations in Sri Lanka. The API serves data from a single JSON seed file (`seedTuk.json`) loaded into memory at application startup. No database, no authentication, no write operations.

**Technology stack:** Node.js, Express 5, CommonJS modules.

---

## Assumptions

1. **Read-only** — All routes are `GET` only. No `POST`, `PUT`, `PATCH`, or `DELETE` endpoints are provided.
2. **In-memory data** — `seedTuk.json` is loaded via `require()` at startup. No database, no caching layer, no external storage.
3. **No authentication** — Any client can access any endpoint. No API keys, tokens, or session management.
4. **snake_case field naming** — All JSON response fields use `snake_case` convention (e.g., `province_id`, `reg_number`, `last_ping`).
5. **String IDs** — All identifier fields (`province_id`, `district_id`, `station_id`, `vehicle_id`, `ping_id`) are returned as strings, even though the source data stores them as numbers.
6. **No `speed` field** — The source seed data contains no speed information, so the `speed` field is excluded entirely from all responses. It cannot be meaningfully computed from the available data.
7. **Flat pings — no filtering** — Ping list endpoints return the full array of pings for a vehicle. No pagination, no time-range filtering, no limit.
8. **Empty arrays are valid** — A nested collection route (e.g., vehicles at a station) returns `[]` when the relationship exists but has no children. This is not an error.
9. **Hierarchy completeness** — Every district belongs to a province, every station to a district, every vehicle to a station. Foreign keys are always valid integers.
10. **No business logic** — No trip management, fare calculation, driver assignment, or geofencing. Pure data retrieval.

---

## Data Model

### Entity-Relationship Diagram

```
Province (1) ──── (N) District (1) ──── (N) Station (1) ──── (N) Vehicle (1) ──── (N) Ping
```

### Entity Definitions

#### Province
| Source Field | Response Field | Type | Example |
|---|---|---|---|
| `id` | `province_id` | string | `"1"` |
| `name` | `name` | string | `"Western Province"` |

Sample: `{ "province_id": "1", "name": "Western Province" }`

A province is a top-level administrative region. There are 9 provinces in the seed data.

#### District
| Source Field | Response Field | Type | Example |
|---|---|---|---|
| `id` | `district_id` | string | `"1"` |
| `name` | `name` | string | `"Colombo"` |
| `province_id` | `province_id` | string | `"1"` |

Sample: `{ "district_id": "1", "name": "Colombo", "province_id": "1" }`

A district is a subdivision within a province. The `province_id` foreign key links it to its parent province. There are 25 districts in the seed data.

#### Station
| Source Field | Response Field | Type | Example |
|---|---|---|---|
| `id` | `station_id` | string | `"1"` |
| `name` | `name` | string | `"Colombo Police Station"` |
| `district_id` | `district_id` | string | `"1"` |

Sample: `{ "station_id": "1", "name": "Colombo Police Station", "district_id": "1" }`

A station is a physical location (operational base) within a district. The `district_id` foreign key links it to its parent district. There are 32 stations in the seed data.

#### Vehicle
| Source Field | Response Field | Type | Example |
|---|---|---|---|
| `id` | `vehicle_id` | string | `"1"` |
| `register_number` | `reg_number` | string | `"HB-6168"` |
| `device_id` | `device_id` | string | `"TUK-DEV-520651"` |
| `station_id` | `station_id` | string | `"4"` |

Sample: `{ "vehicle_id": "1", "reg_number": "HB-6168", "device_id": "TUK-DEV-520651", "station_id": "4" }`

A vehicle is a taxi tracked by the system. Each vehicle has a unique registration number and an IoT device identifier. The `station_id` foreign key links it to its home station. There are 220 vehicles in the seed data.

**Note:** `register_number` is shortened to `reg_number` in the response.

#### Ping
| Source Field | Response Field | Type | Example |
|---|---|---|---|
| `id` | `ping_id` | string | `"1"` |
| `vehicle_id` | `vehicle_id` | string | `"1"` |
| `latitude` | `lat` | number | `7.312694` |
| `longitude` | `lng` | number | `80.60383` |
| `timestamp` | `timestamp` | string (ISO 8601) | `"2026-06-14T00:00:00Z"` |

Sample: `{ "ping_id": "1", "vehicle_id": "1", "timestamp": "2026-06-14T00:00:00Z", "lat": 7.312694, "lng": 80.60383 }`

A ping is a GPS location report from a vehicle at a specific point in time. Each ping records the vehicle's latitude and longitude at the given timestamp. There are 36,960 pings in the seed data (approximately 168 pings per vehicle).

**Note:** `latitude`/`longitude` are shortened to `lat`/`lng` in the response.

---

## Route Map

All routes respond with `application/json`. Non-existent resources return `404 { "error": "<Resource> not found" }`.

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check — returns application status and session identifier |

Response: `{ "status": "ok", "session": "NB6007CEM S2" }`

### Provinces

| Method | Path | Description |
|---|---|---|
| GET | `/provinces` | List all provinces |
| GET | `/provinces/:provinceId` | Get a single province by ID |
| GET | `/provinces/:provinceId/districts` | List all districts within this province |
| GET | `/provinces/:provinceId/stations` | List all stations within this province (via districts) |
| GET | `/provinces/:provinceId/vehicles` | List all vehicles within this province (via districts → stations) |

**`GET /provinces/:provinceId/districts`** — Filters the districts array where `province_id` matches the requested province ID. Returns 404 if the province does not exist.

**`GET /provinces/:provinceId/stations`** — Finds all districts belonging to the province, then returns all stations whose `district_id` matches any of those districts. Returns 404 if the province does not exist.

**`GET /provinces/:provinceId/vehicles`** — Finds all stations in the province (via districts), then returns all vehicles whose `station_id` matches any of those stations. Returns 404 if the province does not exist.

### Districts

| Method | Path | Description |
|---|---|---|
| GET | `/districts` | List all districts |
| GET | `/districts/:districtId` | Get a single district by ID |
| GET | `/districts/:districtId/stations` | List all stations within this district |
| GET | `/districts/:districtId/vehicles` | List all vehicles within this district (via stations) |

**`GET /districts/:districtId/stations`** — Filters the stations array where `district_id` matches the requested district ID. Returns 404 if the district does not exist.

**`GET /districts/:districtId/vehicles`** — Finds all stations in the district, then returns all vehicles whose `station_id` matches any of those stations. Returns 404 if the district does not exist.

### Stations

| Method | Path | Description |
|---|---|---|
| GET | `/stations` | List all stations |
| GET | `/stations/:stationId` | Get a single station by ID |
| GET | `/stations/:stationId/vehicles` | List all vehicles assigned to this station |

**`GET /stations/:stationId/vehicles`** — Filters the vehicles array where `station_id` matches the requested station ID. Returns 404 if the station does not exist.

### Vehicles

| Method | Path | Description |
|---|---|---|
| GET | `/vehicles` | List all vehicles |
| GET | `/vehicles/:vehicleId` | Get a single vehicle with its most recent ping position |
| GET | `/vehicles/:vehicleId/pings` | List all pings for this vehicle |
| GET | `/vehicles/:vehicleId/last-position` | Get only the most recent ping for this vehicle (no vehicle metadata) |

**`GET /vehicles/:vehicleId`** — Returns the vehicle's metadata along with a `last_ping` field containing the most recent GPS ping. To determine the most recent ping: filter pings where `vehicle_id` matches, sort by `timestamp` descending, take the first result. If no pings exist, `last_ping` is `null`.

**`GET /vehicles/:vehicleId/pings`** — Returns all pings for the vehicle, sorted in their original order (ascending by id, which correlates with timestamp). No pagination or filtering is applied.

**`GET /vehicles/:vehicleId/last-position`** — Determines the most recent ping using the same logic as `last_ping` (sort by timestamp descending, take first), but returns only the position data without vehicle metadata. Returns 404 if no pings exist for this vehicle.

---

## Response Shapes (Complete Reference)

All responses are raw JSON objects/arrays — no envelope wrappers (no `data`, `results`, or `meta` wrapping keys).

### Collection Responses

```
GET /provinces  →  [{ province_id: string, name: string }, ...]
GET /districts  →  [{ district_id: string, name: string, province_id: string }, ...]
GET /stations   →  [{ station_id: string, name: string, district_id: string }, ...]
GET /vehicles   →  [{ vehicle_id: string, reg_number: string, device_id: string, station_id: string }, ...]
```

### Member Responses

```
GET /provinces/:provinceId  →  { province_id: string, name: string }
GET /districts/:districtId  →  { district_id: string, name: string, province_id: string }
GET /stations/:stationId    →  { station_id: string, name: string, district_id: string }
```

### Vehicle Composite

```
GET /vehicles/:vehicleId  →
{
  vehicle_id: string,
  reg_number: string,
  device_id: string,
  station_id: string,
  last_ping: {
    ping_id: string,
    vehicle_id: string,
    timestamp: string (ISO 8601),
    lat: number,
    lng: number
  } | null
}
```

### Ping Collection

```
GET /vehicles/:vehicleId/pings  →
[{ ping_id: string, vehicle_id: string, timestamp: string (ISO 8601), lat: number, lng: number }, ...]
```

### Last Position

```
GET /vehicles/:vehicleId/last-position  →
{
  vehicle_id: string,
  timestamp: string (ISO 8601),
  lat: number,
  lng: number
}
```

Nested collection routes (`districts`, `stations`, `vehicles` under a parent) use the same shapes as their top-level collection counterparts.

---

## Error Handling

All error responses use HTTP 404 with a JSON body:

```json
{ "error": "Province not found" }
{ "error": "District not found" }
{ "error": "Station not found" }
{ "error": "Vehicle not found" }
{ "error": "No pings found for this vehicle" }
```

The error message matches the resource type requested. Only 404 errors are returned; no 400, 401, 403, 500, or other status codes are used since there is no validation, authentication, or external dependencies.

---

## Implementation Notes

### Field Mapping Convention

| Raw Source | Response | Reason |
|---|---|---|
| `id` | `{entity}_id` | Prefixed with entity name for clarity in nested contexts |
| `register_number` | `reg_number` | Abbreviated for conciseness; consistent with `device_id` pattern |
| `latitude` | `lat` | Common geospatial abbreviation |
| `longitude` | `lng` | Common geospatial abbreviation |

### Type Conversion

All ID fields are converted from their source type (number) to string using `String()`:

```js
{ province_id: String(province.id), name: province.name }
```

This ensures type consistency across all responses, even if the source data type changes.

### Route Definition Order

Express matches routes in the order they are defined. Static path segments (like `/pings` and `/last-position`) must not be shadowed by parameterized routes. The current definition order is:

1. `/` — health check
2. `/provinces` — collection
3. `/provinces/:provinceId` — member
4. `/provinces/:provinceId/districts` — nested collection
5. `/provinces/:provinceId/stations` — nested collection
6. `/provinces/:provinceId/vehicles` — nested collection
7. `/districts` — collection
8. `/districts/:districtId` — member
9. `/districts/:districtId/stations` — nested collection
10. `/districts/:districtId/vehicles` — nested collection
11. `/stations` — collection
12. `/stations/:stationId` — member
13. `/stations/:stationId/vehicles` — nested collection
14. `/vehicles` — collection
15. `/vehicles/:vehicleId` — member with composite
16. `/vehicles/:vehicleId/pings` — sub-resource collection
17. `/vehicles/:vehicleId/last-position` — sub-resource member

All routes under `/vehicles/:vehicleId/...` come after `/vehicles/:vehicleId` so that Express correctly matches the static path segments.

### Data Loading

Data is loaded once at startup using `require()`:

```js
const data = require('./seedTuk.json');
```

Node's module caching ensures the data is loaded only once and shared across all request handlers. No runtime I/O occurs during request handling.

---

## Files

| File | Role |
|---|---|
| `index.js` | Express application entry point — all route handlers |
| `seedTuk.json` | Static seed data — provinces, districts, stations, vehicles, pings |
| `package.json` | Project metadata and dependencies (express ^5.2.1) |
| `project.md` | This document — project plan and API reference |
