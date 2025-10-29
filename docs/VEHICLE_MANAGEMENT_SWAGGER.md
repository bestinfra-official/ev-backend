# Vehicle Management Service - Swagger Documentation

## Overview

This document explains the Swagger/OpenAPI documentation implementation for the Vehicle Management microservice. The documentation follows the same patterns established in the `auth.js` and `stations.js` Swagger path files.

## Implementation Structure

### Files Created/Modified

1. **`docs/swagger-paths/vehicles.js`** (NEW)

    - Contains all endpoint definitions for vehicle management
    - Includes detailed descriptions, request/response schemas, and examples
    - Documents two endpoints:
        - `POST /api/v1/vehicles/pair` - Pair a vehicle with a Bluetooth device
        - `GET /api/v1/vehicles/paired-devices` - Get paginated list of paired devices

2. **`docs/swagger.config.js`** (MODIFIED)
    - Added import for `vehiclePaths`
    - Added new schemas for vehicle management:
        - `VehicleStaticData` - Optional vehicle information (make, model, year, battery specs)
        - `PairVehicleBody` - Request body for pairing endpoint
        - `PairedDeviceResponse` - Response data for successful pairing
        - `PairedDevice` - Detailed paired device information with optional expansions
        - `BluetoothMAC` - Bluetooth MAC address format validation
        - `ChassisNumber` - Vehicle chassis number format validation
        - `RegistrationNumber` - Vehicle registration number format validation
    - Added "Vehicle Management" tag with description
    - Included vehicle paths in the main paths object

## API Endpoints Documented

### 1. Pair Vehicle (`POST /api/v1/vehicles/pair`)

**Purpose**: Pairs a vehicle with a Bluetooth device when mobile app successfully connects.

**Key Features Documented**:

-   **Authentication**: Requires Bearer token (JWT)
-   **Idempotency**: Supports `Idempotency-Key` header to prevent duplicates
-   **Safety Features**:
    -   PostgreSQL advisory locks prevent race conditions
    -   Transactional safety ensures data consistency
    -   Input validation via Zod schemas
    -   Rate limiting protection

**Request Body Schema**:

-   `chassis_number` (required): Vehicle chassis number/VIN (alphanumeric, uppercase)
-   `reg_number` (required): Registration number (alphanumeric, spaces, hyphens)
-   `bluetooth_mac` (optional): Bluetooth MAC address (format: XX:XX:XX:XX:XX:XX)
-   `vehicle_static` (optional): Vehicle details (make, model, year, battery specs)

**Response Codes**:

-   `201 Created` - Successful pairing
-   `200 OK` - Idempotent duplicate request
-   `400 Bad Request` - Validation errors
-   `401 Unauthorized` - Missing/invalid token
-   `409 Conflict` - Resource conflicts
-   `429 Too Many Requests` - Rate limit exceeded
-   `503 Service Unavailable` - Resource locked

**Examples Included**:

-   Successful pairing response
-   Idempotent duplicate request response
-   Various validation error examples
-   Resource locked error example

### 2. Get Paired Devices (`GET /api/v1/vehicles/paired-devices`)

**Purpose**: Retrieves paginated list of paired devices for authenticated user.

**Key Features Documented**:

-   **Pagination**: Cursor-based pagination for efficient large dataset handling
-   **Filtering**: Filter by active status (`active=true` or `active=false`)
-   **Expansion**: Include related data via `include` parameter:
    -   `vehicle` - Vehicle make/model information
    -   `latest_status` - Battery level, range, last recorded timestamp
-   **Sorting**: Sort by `last_seen_desc` or `connected_at_desc`
-   **Caching**: 30-second response cache
-   **Response Headers**: `X-Total-Active` and `X-Total-All` counters

**Query Parameters**:

-   `active` (optional): Filter by active status (`true`/`false`)
-   `include` (optional): Comma-separated expansions (`vehicle`, `latest_status`)
-   `limit` (optional): Items per page (1-100, default: 20)
-   `cursor` (optional): Pagination cursor from previous response
-   `sort` (optional): Sort order (`last_seen_desc` or `connected_at_desc`)

**Response Structure**:

```json
{
  "success": true,
  "message": "Paired devices retrieved successfully",
  "data": {
    "data": [...],           // Array of paired devices
    "page_info": {           // Pagination metadata
      "next_cursor": "...",
      "limit": 20,
      "has_more": false
    },
    "total_active": 3,       // Count of active devices
    "total_all": 5            // Count of all devices
  }
}
```

**Examples Included**:

-   Full response with vehicle info and status
-   Minimal response without expansions
-   Paginated response with next cursor

## Schema Documentation

All schemas follow OpenAPI 3.0 specification with:

-   **Type definitions**: String, number, integer, object, array
-   **Format validations**: UUID, date-time, regex patterns
-   **Constraints**: minLength, maxLength, minimum, maximum
-   **Enumerations**: Status enums, sort options
-   **Descriptions**: Detailed field-level descriptions
-   **Examples**: Real-world example values

## Documentation Best Practices Applied

1. **Comprehensive Descriptions**: Each endpoint includes detailed descriptions explaining purpose, workflow, and features

2. **Authentication Guidance**: Clear instructions on how to obtain and use Bearer tokens

3. **Error Examples**: Multiple error scenario examples for common failure cases:

    - Validation errors
    - Authentication failures
    - Resource conflicts
    - Rate limiting

4. **Request/Response Examples**: Real-world JSON examples for all success and error scenarios

5. **Parameter Documentation**: Detailed parameter descriptions with:

    - Valid values
    - Default values
    - Constraints
    - Usage examples

6. **Header Documentation**: Documents custom headers like:
    - `Idempotency-Key` for duplicate prevention
    - `X-Total-Active` and `X-Total-All` for counts

## Integration with Existing Docs

The vehicle management documentation:

-   Follows the same structure as `auth.js` and `stations.js`
-   Uses consistent schema naming conventions
-   Reuses common response schemas (`SuccessResponse`, `ErrorResponse`)
-   Follows the same authentication pattern (Bearer token)
-   Uses the same error response format

## Route Mapping

**Gateway Path** → **Service Path**:

-   `/api/v1/vehicles/pair` → `/v1/pair` (proxied via gateway)
-   `/api/v1/vehicles/paired-devices` → `/v1/paired-devices` (proxied via gateway)

The Swagger documentation uses the **gateway paths** (`/api/v1/vehicles/...`) as these are the paths that clients will use.

## Testing with Swagger UI

To test the endpoints:

1. Start the API gateway with Swagger UI enabled
2. Navigate to Swagger documentation page
3. Authenticate using the Authentication endpoints first
4. Use the returned `accessToken` in the Bearer token field
5. Test vehicle pairing and retrieval endpoints

## Future Enhancements

The documentation structure allows for easy addition of:

-   Additional vehicle management endpoints
-   New query parameters
-   Expanded response schemas
-   Additional error scenarios

## Summary

The Swagger documentation provides:
✅ Complete endpoint coverage (2 endpoints)
✅ Detailed request/response schemas
✅ Comprehensive error handling documentation
✅ Authentication flow guidance
✅ Pagination and filtering explanation
✅ Real-world examples for all scenarios
✅ Integration with existing documentation patterns

The documentation is production-ready and follows OpenAPI 3.0 best practices.
