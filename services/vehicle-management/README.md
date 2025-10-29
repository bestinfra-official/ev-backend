# Vehicle Management Service

This microservice handles vehicle pairing operations, allowing mobile apps to pair with vehicles via Bluetooth.

## Features

### API 1: Vehicle Pairing

**Endpoint**: `POST /api/v1/pairings`

**Description**: When the mobile app successfully connects to a vehicle via Bluetooth, it sends vehicle information and this service:

1. Persists a **paired device** record
2. Ensures a normalized **vehicles** record exists (create or update)
3. Returns a deterministic response with pairing details

**Request Headers**:

-   `Authorization: Bearer <JWT>` - Required for authentication
-   `Idempotency-Key: <uuid>` - Optional, prevents duplicate requests
-   `Content-Type: application/json`

**Request Body**:

```json
{
    "chassis_number": "VIN1234567890",
    "reg_number": "DL01AB1234",
    "bluetooth_mac": "AA:BB:CC:DD:EE:FF",
    "vehicle_static": {
        "make": "Tata",
        "model": "Nexon EV",
        "year": 2024,
        "battery_capacity_kwh": 30,
        "efficiency_kwh_per_km": 0.15
    }
}
```

**Responses**:

-   `201 Created` - Pairing successful
-   `200 OK` - Idempotent duplicate call
-   `400 Bad Request` - Validation error
-   `401 Unauthorized` - Invalid JWT
-   `409 Conflict` - Resource conflict
-   `429 Too Many Requests` - Rate limit exceeded
-   `500 Internal Server Error` - Server error
-   `503 Service Unavailable` - Resource locked

**Success Response**:

```json
{
    "success": true,
    "message": "Pairing completed successfully",
    "data": {
        "paired_device_id": "uuid",
        "vehicle_id": "uuid",
        "message": "Vehicle paired successfully",
        "paired_devices_count": 2
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Implementation Highlights

### Safety & Reliability

-   **Idempotency**: Idempotency-Key header prevents duplicate pairings
-   **Advisory Locks**: PostgreSQL advisory locks prevent race conditions on vehicle pairing
-   **Transactional Safety**: All operations wrapped in database transactions
-   **Input Validation**: Zod schema validation for all inputs

### Performance Optimizations

-   **Connection Pooling**: Uses pg.Pool for efficient database connections
-   **Indexed Queries**: Strategic indexes on `chassis_number`, `user_id`, and `idempotency_key`
-   **Rate Limiting**: Strict rate limiting on pairing endpoint to prevent abuse
-   **Query Optimization**: Efficient upsert patterns to minimize database roundtrips

### Database Schema

The service uses the following tables:

**vehicles** (extended):

-   `id` (UUID, PK)
-   `reg_number` (VARCHAR, UNIQUE)
-   `chassis_number` (VARCHAR, UNIQUE) - NEW
-   `make`, `model`, `year`
-   `battery_capacity_kwh`
-   `efficiency_kwh_per_km`
-   `created_at`, `updated_at`

**paired_devices** (NEW):

-   `id` (UUID, PK)
-   `user_id` (BIGINT, FK to users)
-   `vehicle_id` (UUID, FK to vehicles)
-   `chassis_number`, `reg_number`
-   `bluetooth_mac`
-   `is_active` (BOOLEAN)
-   `connected_at`, `last_seen`
-   `idempotency_key` (TEXT)
-   `created_at`, `updated_at`

### Architecture

```
Client Request
  ↓
Auth Middleware (JWT)
  ↓
Rate Limiter (Prevent Abuse)
  ↓
Validation Middleware (Zod)
  ↓
Pairing Controller
  ↓
  ├─ Idempotency Check
  ├─ Advisory Lock
  ├─ Transaction
  │   ├─ Find/Create Vehicle
  │   ├─ Find/Create Paired Device
  │   └─ Count Active Devices
  └─ Return Response
```

## Running the Service

### Prerequisites

-   Node.js 18+
-   PostgreSQL database
-   Redis (for caching and rate limiting)

### Setup

1. Run the migration:

```bash
psql -d ev -f services/vehicle-management/migrations/001_create_vehicle_tables.sql
```

2. Set environment variables:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/ev
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your-secret-key
PORT=7101
```

3. Install dependencies:

```bash
npm install
```

4. Start the service:

```bash
npm start
```

Or via the main orchestrator:

```bash
npm run start:all
```

## API Testing

### Example cURL Request

```bash
curl -X POST http://localhost:7101/v1/pairings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Idempotency-Key: unique-uuid-key" \
  -H "Content-Type: application/json" \
  -d '{
    "chassis_number": "VIN1234567890",
    "reg_number": "DL01AB1234",
    "bluetooth_mac": "AA:BB:CC:DD:EE:FF",
    "vehicle_static": {
      "make": "Tata",
      "model": "Nexon EV",
      "year": 2024,
      "battery_capacity_kwh": 30,
      "efficiency_kwh_per_km": 0.15
    }
  }'
```

### Expected Response

```json
{
    "success": true,
    "message": "Pairing completed successfully",
    "data": {
        "paired_device_id": "550e8400-e29b-41d4-a716-446655440000",
        "vehicle_id": "550e8400-e29b-41d4-a716-446655440001",
        "message": "Vehicle paired successfully",
        "paired_devices_count": 1
    },
    "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Scalability Notes

-   **High Throughput**: Can handle thousands of pairing requests per minute
-   **Advisory Locks**: Prevent race conditions even under high concurrency
-   **Connection Pooling**: Efficient reuse of database connections
-   **Indexed Queries**: Optimized for fast lookups

## Security

-   JWT authentication required
-   Input validation via Zod
-   Rate limiting to prevent abuse
-   SQL injection protection via parameterized queries
-   TLS recommended for production

## Error Handling

The service handles various error scenarios:

-   Invalid authentication → 401
-   Validation errors → 400
-   Resource conflicts → 409
-   Rate limit exceeded → 429
-   Server errors → 500
-   Resource locked → 503

All errors are logged with request context for debugging.
