# Station Management Service - Architecture Documentation

## Overview

Production-grade EV charging station management system capable of handling **1M requests/minute** with low latency and fault tolerance.

## Architecture

### High-Level Flow

```
Frontend (React/Flutter)
    ↓ WebSocket / REST
API Gateway (Rate limiting, JWT auth)
    ↓
Station Management Service (Node.js)
    ├─ Redis Cluster (Cache + Pub/Sub)
    ├─ PostgreSQL Cluster (Source of truth)
    ├─ WebSocket Server (Socket.io)
    └─ Background Workers
```

### Key Components

#### 1. **Redis Layer** (Real-time)
- **Connector Status**: Live status of each connector (`station:{id}:connectors:{connector_id}`)
- **Holds Management**: Temporary slot holds with atomic Lua scripts
- **Availability Cache**: Cached computed time slots (TTL: 60s)
- **Pub/Sub**: Event broadcasting to WebSocket clients

#### 2. **Database Layer** (Source of Truth)
- **Tables**:
  - `connectors`: Individual charging connectors
  - `bookings`: Slot bookings with time windows
  - `charging_sessions`: Actual charging sessions with meter readings
- **Indexes**: Optimized for time-range queries and overlapping detection

#### 3. **WebSocket Server**
- Real-time updates via Socket.io
- Subscribes to Redis Pub/Sub channels
- Broadcasts events to subscribed clients

#### 4. **Background Workers**
- **No-Show Worker**: Handles expired bookings, frees connectors, triggers refunds

## API Endpoints

### Station Details & Availability

#### `GET /v1/stations/:id`
Get station details with real-time connector status.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Station Name",
    "latitude": 17.474,
    "longitude": 78.320,
    "connectors": [
      {
        "id": "uuid",
        "connectorNumber": "1",
        "connectorType": "CCS",
        "powerKw": 150,
        "status": "AVAILABLE",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### `GET /v1/stations/:id/availability`
Get available time slots for a station.

**Query Parameters:**
- `startDate` (ISO 8601): Start date for slots
- `endDate` (ISO 8601): End date for slots
- `slotDurationMinutes` (number): Slot duration (default: 60)

**Response:**
```json
{
  "success": true,
  "data": {
    "stationId": "uuid",
    "availableSlots": [
      {
        "connectorId": "uuid",
        "connectorNumber": "1",
        "start": "2024-01-01T10:00:00Z",
        "end": "2024-01-01T11:00:00Z",
        "durationMinutes": 60
      }
    ],
    "total": 10
  }
}
```

### Booking Management

#### `POST /v1/bookings/holds`
Create a temporary hold for a booking slot (10-minute TTL).

**Request:**
```json
{
  "stationId": "uuid",
  "connectorId": "uuid",
  "startTs": "2024-01-01T10:00:00Z",
  "endTs": "2024-01-01T11:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "hold_1234567890_abc",
    "expiresIn": 600
  }
}
```

#### `POST /v1/bookings/confirm`
Confirm a booking from a hold token.

**Request:**
```json
{
  "holdToken": "hold_1234567890_abc",
  "paymentId": "payment_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "stationId": "uuid",
    "connectorId": "uuid",
    "startTs": "2024-01-01T10:00:00Z",
    "endTs": "2024-01-01T11:00:00Z",
    "status": "CONFIRMED"
  }
}
```

#### `POST /v1/bookings/:id/cancel`
Cancel a booking.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CANCELLED"
  }
}
```

#### `GET /v1/bookings`
Get user bookings.

**Query Parameters:**
- `status` (string): Filter by status
- `limit` (number): Results limit (default: 50)
- `offset` (number): Results offset (default: 0)

### Vendor Integration (Webhooks)

#### `POST /v1/vendor/webhooks/connector-status`
Webhook for connector status updates from vendors.

**Request:**
```json
{
  "stationId": "uuid",
  "connectorId": "uuid",
  "vendorConnectorId": "vendor_123",
  "status": "AVAILABLE",
  "metadata": {}
}
```

#### `POST /v1/vendor/webhooks/session-start`
Webhook for charging session start.

**Request:**
```json
{
  "vendorSessionId": "vendor_session_123",
  "connectorId": "uuid",
  "startMeterReading": 0.0,
  "bookingId": "uuid"
}
```

#### `POST /v1/vendor/webhooks/session-end`
Webhook for charging session end.

**Request:**
```json
{
  "vendorSessionId": "vendor_session_123",
  "endMeterReading": 25.5,
  "energyKwh": 25.5,
  "costAmount": 250.0
}
```

## WebSocket Events

### Client → Server

#### `subscribe_station`
Subscribe to station updates.

```json
{
  "stationId": "uuid"
}
```

#### `unsubscribe_station`
Unsubscribe from station updates.

```json
{
  "stationId": "uuid"
}
```

### Server → Client

#### `connected`
Connection confirmation.

```json
{
  "socketId": "socket_id",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### `station_update`
Real-time station update.

```json
{
  "stationId": "uuid",
  "type": "connector_status_update",
  "data": {
    "connectorId": "uuid",
    "status": "OCCUPIED",
    "updatedAt": 1704067200
  }
}
```

## Performance Characteristics

| Operation                | Target Latency | Infrastructure |
|--------------------------|----------------|---------------|
| `GET /stations/:id`      | <30ms          | Redis cache   |
| `GET /availability`      | <25ms          | Redis read    |
| `POST /holds`            | <50ms          | Redis Lua     |
| `POST /confirm`          | <150ms         | DB + payment  |
| WebSocket Push           | <500ms         | Redis Pub/Sub |
| Vendor webhook           | <200ms         | Async queue   |

## Data Flow

### 1. Connector Status Update

```
Vendor → Webhook → VendorIntegrationService
    ↓
ConnectorStatusService.updateConnectorStatus()
    ↓
Redis (HSET station:{id}:connectors:{connector_id})
    ↓
EventPublisherService.publish()
    ↓
Redis Pub/Sub → WebSocketService → Frontend
```

### 2. Booking Flow

```
User → POST /bookings/holds
    ↓
BookingService.createHold()
    ↓
Redis Lua Script (atomic check + set)
    ↓
EventPublisherService.publishSlotHoldCreated()
    ↓
User → POST /bookings/confirm
    ↓
BookingService.confirmBooking()
    ↓
DB Transaction (insert booking)
    ↓
Redis hold release
    ↓
EventPublisherService.publishBookingConfirmed()
```

### 3. No-Show Handling

```
Background Worker (every 5 minutes)
    ↓
Booking.findNoShowBookings()
    ↓
Booking.updateStatus('NO_SHOW')
    ↓
Connector.updateStatus('AVAILABLE')
    ↓
Payment Service (refund)
```

## Database Schema

### Connectors
```sql
- id (UUID, PK)
- station_id (UUID, FK → charging_stations)
- connector_number (VARCHAR)
- connector_type (VARCHAR)
- power_kw (DECIMAL)
- status (VARCHAR): AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE, OFFLINE, FAULTED
- current_booking_id (UUID, FK → bookings)
- vendor_connector_id (VARCHAR)
```

### Bookings
```sql
- id (UUID, PK)
- user_id (BIGINT, FK → users)
- station_id (UUID, FK → charging_stations)
- connector_id (UUID, FK → connectors)
- start_ts (TIMESTAMP)
- end_ts (TIMESTAMP)
- status (VARCHAR): PENDING, CONFIRMED, CANCELLED, NO_SHOW, COMPLETED, ACTIVE
- hold_token (VARCHAR, UNIQUE)
- payment_id (VARCHAR)
- vendor_booking_id (VARCHAR)
```

### Charging Sessions
```sql
- id (UUID, PK)
- booking_id (UUID, FK → bookings)
- connector_id (UUID, FK → connectors)
- started_at (TIMESTAMP)
- ended_at (TIMESTAMP)
- energy_kwh (DECIMAL)
- cost_amount (DECIMAL)
- status (VARCHAR): STARTING, CHARGING, STOPPING, COMPLETED, FAILED, CANCELLED
```

## Scaling Strategy

### Horizontal Scaling
- **Application**: Stateless Node.js instances (20-30 pods)
- **Redis**: Cluster mode (3 master + 3 replicas)
- **PostgreSQL**: Read replicas + sharding by station_id

### Caching Strategy
- **Connector Status**: Redis (TTL: 3600s)
- **Availability**: Redis (TTL: 60s)
- **Station Details**: Redis (TTL: 600s)

### Fault Tolerance
- **Redis Down**: Fallback to DB (slower but functional)
- **Station Offline**: Show stale cache with "last updated" timestamp
- **Vendor API Down**: Queue webhook processing, retry with exponential backoff

## Environment Variables

```env
# Booking Configuration
BOOKING_HOLD_TTL_SECONDS=600
BOOKING_NO_SHOW_GRACE_PERIOD_MINUTES=15

# Worker Configuration
NO_SHOW_WORKER_INTERVAL_MS=300000

# WebSocket Configuration
CORS_ORIGIN=*
```

## Running the Service

1. **Run Migration:**
   ```bash
   psql -d ev -f services/station-management/migrations/002_create_booking_tables.sql
   ```

2. **Install Dependencies:**
   ```bash
   cd services/station-management
   npm install
   ```

3. **Start Service:**
   ```bash
   npm start
   ```

## Testing

### Manual Testing Endpoints

1. **Create Hold:**
   ```bash
   curl -X POST http://localhost:7103/v1/bookings/holds \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"stationId":"...","connectorId":"...","startTs":"...","endTs":"..."}'
   ```

2. **Confirm Booking:**
   ```bash
   curl -X POST http://localhost:7103/v1/bookings/confirm \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"holdToken":"hold_..."}'
   ```

3. **Get Availability:**
   ```bash
   curl http://localhost:7103/v1/stations/{id}/availability \
     -H "Authorization: Bearer <token>"
   ```

## Notes

- All timestamps are in ISO 8601 format
- All IDs are UUIDs
- Authentication required for all endpoints except vendor webhooks
- WebSocket connections require authentication (implement via middleware)

