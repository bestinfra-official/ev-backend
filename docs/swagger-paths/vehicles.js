/**
 * Vehicle Management Swagger Paths
 * API documentation for vehicle pairing and management endpoints
 *
 * This microservice handles vehicle pairing operations, allowing mobile apps
 * to pair with vehicles via Bluetooth and manage paired devices.
 */

export default {
    "/api/v1/vehicles/pair": {
        post: {
            tags: ["Vehicle Management"],
            summary: "Pair Vehicle with Device",
            description:
                "Pair a vehicle with a Bluetooth device. Requires authentication via Bearer token.",
            operationId: "pairVehicle",
            security: [
                {
                    BearerAuth: [],
                },
            ],
            parameters: [
                {
                    $ref: "#/components/parameters/VersionHeader",
                },
                {
                    name: "Idempotency-Key",
                    in: "header",
                    description:
                        "Optional idempotency key (UUID) to prevent duplicate requests. If provided and a matching request exists, the existing result is returned.",
                    required: false,
                    schema: {
                        type: "string",
                        format: "uuid",
                        example: "550e8400-e29b-41d4-a716-446655440000",
                    },
                },
            ],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/PairVehicleBody",
                        },
                        example: {
                            chassis_number: "VIN1234567890ABCDE",
                            reg_number: "DL01AB1234",
                            bluetooth_mac: "AA:BB:CC:DD:EE:FF",
                            vehicle_static: {
                                make: "Tata",
                                model: "Nexon EV",
                                year: 2024,
                                battery_capacity_kwh: 30.0,
                                efficiency_kwh_per_km: 0.15,
                            },
                        },
                        description:
                            "Vehicle pairing request with chassis number, registration number, Bluetooth MAC address, and optional vehicle static data.",
                    },
                },
            },
            responses: {
                201: {
                    description: "Vehicle paired successfully",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/SuccessResponse",
                                    },
                                    {
                                        properties: {
                                            data: {
                                                type: "object",
                                                properties: {
                                                    paired_device_id: {
                                                        type: "string",
                                                        format: "uuid",
                                                        example:
                                                            "550e8400-e29b-41d4-a716-446655440000",
                                                        description:
                                                            "UUID of the created/updated paired device record",
                                                    },
                                                    vehicle_id: {
                                                        type: "string",
                                                        format: "uuid",
                                                        example:
                                                            "550e8400-e29b-41d4-a716-446655440001",
                                                        description:
                                                            "UUID of the vehicle record (created or updated)",
                                                    },
                                                    message: {
                                                        type: "string",
                                                        example:
                                                            "Vehicle paired successfully",
                                                    },
                                                    paired_devices_count: {
                                                        type: "integer",
                                                        example: 2,
                                                        description:
                                                            "Total number of active paired devices for the authenticated user",
                                                    },
                                                },
                                                required: [
                                                    "paired_device_id",
                                                    "vehicle_id",
                                                    "message",
                                                    "paired_devices_count",
                                                ],
                                            },
                                        },
                                    },
                                ],
                            },
                            examples: {
                                success: {
                                    summary: "Successful Pairing",
                                    value: {
                                        success: true,
                                        message:
                                            "Pairing completed successfully",
                                        data: {
                                            paired_device_id:
                                                "550e8400-e29b-41d4-a716-446655440000",
                                            vehicle_id:
                                                "550e8400-e29b-41d4-a716-446655440001",
                                            message:
                                                "Vehicle paired successfully",
                                            paired_devices_count: 2,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                idempotent: {
                                    summary: "Idempotent Request (Duplicate)",
                                    description:
                                        "When the same request is sent with the same Idempotency-Key, it returns the existing result without creating duplicates.",
                                    value: {
                                        success: true,
                                        message:
                                            "Pairing completed successfully",
                                        data: {
                                            paired_device_id:
                                                "550e8400-e29b-41d4-a716-446655440000",
                                            vehicle_id:
                                                "550e8400-e29b-41d4-a716-446655440001",
                                            message:
                                                "Vehicle paired successfully",
                                            paired_devices_count: 2,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                200: {
                    description:
                        "Idempotent duplicate call - same result as original request",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/SuccessResponse",
                                    },
                                    {
                                        properties: {
                                            data: {
                                                $ref: "#/components/schemas/PairedDeviceResponse",
                                            },
                                        },
                                    },
                                ],
                            },
                            example: {
                                success: true,
                                message: "Pairing completed successfully",
                                data: {
                                    paired_device_id:
                                        "550e8400-e29b-41d4-a716-446655440000",
                                    vehicle_id:
                                        "550e8400-e29b-41d4-a716-446655440001",
                                    message: "Vehicle paired successfully",
                                    paired_devices_count: 2,
                                },
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                400: {
                    description: "Validation error or invalid request data",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            examples: {
                                validationError: {
                                    summary: "Validation Error",
                                    value: {
                                        success: false,
                                        message: "Validation failed",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "chassis_number",
                                            message:
                                                "Chassis number is required",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidChassis: {
                                    summary: "Invalid Chassis Number Format",
                                    value: {
                                        success: false,
                                        message: "Validation failed",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "chassis_number",
                                            message:
                                                "Chassis number contains invalid characters",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidMac: {
                                    summary: "Invalid Bluetooth MAC Address",
                                    value: {
                                        success: false,
                                        message: "Validation failed",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "bluetooth_mac",
                                            message:
                                                "Invalid Bluetooth MAC address format",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidReference: {
                                    summary:
                                        "Invalid User or Vehicle Reference",
                                    value: {
                                        success: false,
                                        message:
                                            "Invalid user or vehicle reference",
                                        error: "INVALID_REFERENCE",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                401: {
                    description:
                        "Unauthorized - Invalid or missing Bearer token. Include `Authorization: Bearer <your-access-token>` header.",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            examples: {
                                missingToken: {
                                    summary: "Missing Bearer Token",
                                    value: {
                                        success: false,
                                        message:
                                            "Authorization header is required. Include 'Bearer <your-access-token>'",
                                        error: "UNAUTHORIZED",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidToken: {
                                    summary: "Invalid Bearer Token",
                                    value: {
                                        success: false,
                                        message:
                                            "Invalid or expired Bearer token",
                                        error: "UNAUTHORIZED",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                409: {
                    description:
                        "Resource conflict - Vehicle or device already exists",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            example: {
                                success: false,
                                message: "Vehicle or device already exists",
                                error: "CONFLICT",
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                429: {
                    description: "Rate limit exceeded",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/ErrorResponse",
                                    },
                                    {
                                        properties: {
                                            details: {
                                                $ref: "#/components/schemas/RateLimitInfo",
                                            },
                                        },
                                    },
                                ],
                            },
                            example: {
                                success: false,
                                message: "Rate limit exceeded",
                                error: "RATE_LIMIT_EXCEEDED",
                                details: {
                                    retryAfter: 60,
                                    reason: "too_many_requests",
                                },
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                503: {
                    description:
                        "Service unavailable - Resource is locked due to concurrent pairing attempt",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            example: {
                                success: false,
                                message: "Resource is locked, please try again",
                                error: "RESOURCE_LOCKED",
                                details: {
                                    retryAfter: 1,
                                    reason: "Another pairing operation is in progress for this vehicle",
                                },
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                500: {
                    $ref: "#/components/responses/InternalServerError",
                },
            },
        },
    },

    "/api/v1/vehicles/paired-devices": {
        get: {
            tags: ["Vehicle Management"],
            summary: "Get Paired Devices",
            description:
                "Get paginated list of paired devices for the authenticated user with optional filtering and expansion.",
            operationId: "getPairedDevices",
            security: [
                {
                    BearerAuth: [],
                },
            ],
            parameters: [
                {
                    $ref: "#/components/parameters/VersionHeader",
                },
                {
                    name: "active",
                    in: "query",
                    description:
                        "Filter by active status. If 'true', returns only active paired devices. If 'false', returns only inactive. If omitted, returns all.",
                    required: false,
                    schema: {
                        type: "string",
                        enum: ["true", "false"],
                        example: "true",
                    },
                },
                {
                    name: "include",
                    in: "query",
                    description:
                        "Comma-separated list of expansions to include. Available options: 'vehicle' (vehicle make/model), 'latest_status' (battery level, range). Default: 'vehicle,latest_status'",
                    required: false,
                    schema: {
                        type: "string",
                        default: "vehicle,latest_status",
                        example: "vehicle,latest_status",
                    },
                },
                {
                    name: "limit",
                    in: "query",
                    description:
                        "Number of items per page. Minimum: 1, Maximum: 100, Default: 20",
                    required: false,
                    schema: {
                        type: "integer",
                        minimum: 1,
                        maximum: 100,
                        default: 20,
                        example: 20,
                    },
                },
                {
                    name: "cursor",
                    in: "query",
                    description:
                        "Pagination cursor from the 'next_cursor' field of the previous response. Use for fetching the next page of results.",
                    required: false,
                    schema: {
                        type: "string",
                        example:
                            "eyJsYXN0X3NlZW4iOiIyMDI0LTAxLTE1VDEwOjMwOjAwWiIsImlkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=",
                    },
                },
                {
                    name: "sort",
                    in: "query",
                    description:
                        "Sort order for the results. 'last_seen_desc' sorts by most recently seen first. 'connected_at_desc' sorts by connection time first.",
                    required: false,
                    schema: {
                        type: "string",
                        enum: ["last_seen_desc", "connected_at_desc"],
                        default: "last_seen_desc",
                        example: "last_seen_desc",
                    },
                },
            ],
            responses: {
                200: {
                    description: "Paired devices retrieved successfully",
                    headers: {
                        "X-Total-Active": {
                            description:
                                "Total number of active paired devices for the user",
                            schema: {
                                type: "integer",
                                example: 3,
                            },
                        },
                        "X-Total-All": {
                            description:
                                "Total number of all paired devices (active + inactive) for the user",
                            schema: {
                                type: "integer",
                                example: 5,
                            },
                        },
                        "Cache-Control": {
                            description: "Cache control header",
                            schema: {
                                type: "string",
                                example: "private, max-age=0",
                            },
                        },
                    },
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/SuccessResponse",
                                    },
                                    {
                                        properties: {
                                            data: {
                                                type: "object",
                                                properties: {
                                                    data: {
                                                        type: "array",
                                                        items: {
                                                            $ref: "#/components/schemas/PairedDevice",
                                                        },
                                                        description:
                                                            "Array of paired devices",
                                                    },
                                                    page_info: {
                                                        type: "object",
                                                        properties: {
                                                            next_cursor: {
                                                                type: "string",
                                                                nullable: true,
                                                                example:
                                                                    "eyJsYXN0X3NlZW4iOiIyMDI0LTAxLTE1VDEwOjMwOjAwWiIsImlkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=",
                                                                description:
                                                                    "Base64-encoded cursor for the next page. Null if this is the last page.",
                                                            },
                                                            limit: {
                                                                type: "integer",
                                                                example: 20,
                                                                description:
                                                                    "Number of items requested per page",
                                                            },
                                                            has_more: {
                                                                type: "boolean",
                                                                example: true,
                                                                description:
                                                                    "Whether there are more pages available",
                                                            },
                                                        },
                                                        required: [
                                                            "next_cursor",
                                                            "limit",
                                                            "has_more",
                                                        ],
                                                    },
                                                    total_active: {
                                                        type: "integer",
                                                        example: 3,
                                                        description:
                                                            "Total number of active paired devices",
                                                    },
                                                    total_all: {
                                                        type: "integer",
                                                        example: 5,
                                                        description:
                                                            "Total number of all paired devices (active + inactive)",
                                                    },
                                                },
                                                required: [
                                                    "data",
                                                    "page_info",
                                                    "total_active",
                                                    "total_all",
                                                ],
                                            },
                                        },
                                    },
                                ],
                            },
                            examples: {
                                success: {
                                    summary:
                                        "Successful Response with Vehicle Info",
                                    value: {
                                        success: true,
                                        message:
                                            "Paired devices retrieved successfully",
                                        data: {
                                            data: [
                                                {
                                                    id: "550e8400-e29b-41d4-a716-446655440000",
                                                    status: "active",
                                                    connected_at:
                                                        "2024-01-15T09:00:00Z",
                                                    device: {
                                                        bluetooth_mac:
                                                            "AA:BB:CC:DD:EE:FF",
                                                    },
                                                    vehicle_info: {
                                                        reg_number:
                                                            "DL01AB1234",
                                                        make: "Tata",
                                                        model: "Nexon EV",
                                                    },
                                                    status_info: {
                                                        battery_level_percent: 85.5,
                                                        range_km: 240.0,
                                                        recorded_at:
                                                            "2024-01-15T10:25:00Z",
                                                    },
                                                },
                                                {
                                                    id: "550e8400-e29b-41d4-a716-446655440001",
                                                    status: "active",
                                                    connected_at:
                                                        "2024-01-14T14:30:00Z",
                                                    device: {
                                                        bluetooth_mac:
                                                            "11:22:33:44:55:66",
                                                    },
                                                    vehicle_info: {
                                                        reg_number:
                                                            "DL02CD5678",
                                                        make: "MG",
                                                        model: "ZS EV",
                                                    },
                                                    status_info: {
                                                        battery_level_percent: 92.0,
                                                        range_km: 320.0,
                                                        recorded_at:
                                                            "2024-01-15T10:20:00Z",
                                                    },
                                                },
                                            ],
                                            page_info: {
                                                next_cursor:
                                                    "eyJsYXN0X3NlZW4iOiIyMDI0LTAxLTE1VDEwOjMwOjAwWiIsImlkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=",
                                                limit: 20,
                                                has_more: false,
                                            },
                                            total_active: 3,
                                            total_all: 5,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                minimal: {
                                    summary: "Response without Expansions",
                                    description:
                                        "When 'include' parameter is omitted or empty, only basic device information is returned.",
                                    value: {
                                        success: true,
                                        message:
                                            "Paired devices retrieved successfully",
                                        data: {
                                            data: [
                                                {
                                                    id: "550e8400-e29b-41d4-a716-446655440000",
                                                    status: "active",
                                                    connected_at:
                                                        "2024-01-15T09:00:00Z",
                                                    device: {
                                                        bluetooth_mac:
                                                            "AA:BB:CC:DD:EE:FF",
                                                    },
                                                    vehicle_info: {
                                                        reg_number:
                                                            "DL01AB1234",
                                                    },
                                                },
                                            ],
                                            page_info: {
                                                next_cursor: null,
                                                limit: 20,
                                                has_more: false,
                                            },
                                            total_active: 1,
                                            total_all: 1,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                paginated: {
                                    summary: "Paginated Response",
                                    description:
                                        "When there are more results, 'has_more' is true and 'next_cursor' is provided for fetching the next page.",
                                    value: {
                                        success: true,
                                        message:
                                            "Paired devices retrieved successfully",
                                        data: {
                                            data: [
                                                {
                                                    id: "550e8400-e29b-41d4-a716-446655440000",
                                                    status: "active",
                                                    connected_at:
                                                        "2024-01-15T09:00:00Z",
                                                    device: {
                                                        bluetooth_mac:
                                                            "AA:BB:CC:DD:EE:FF",
                                                    },
                                                    vehicle_info: {
                                                        reg_number:
                                                            "DL01AB1234",
                                                        make: "Tata",
                                                        model: "Nexon EV",
                                                    },
                                                },
                                            ],
                                            page_info: {
                                                next_cursor:
                                                    "eyJsYXN0X3NlZW4iOiIyMDI0LTAxLTE1VDEwOjMwOjAwWiIsImlkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0=",
                                                limit: 20,
                                                has_more: true,
                                            },
                                            total_active: 25,
                                            total_all: 30,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    description:
                        "Validation error or invalid request parameters",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            examples: {
                                invalidActive: {
                                    summary: "Invalid Active Parameter",
                                    value: {
                                        success: false,
                                        message: "Validation failed",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "active",
                                            message:
                                                "Active must be 'true' or 'false'",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidInclude: {
                                    summary: "Invalid Include Parameter",
                                    value: {
                                        success: false,
                                        message: "Validation failed",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "include",
                                            message:
                                                "Include must be one or more of: vehicle, latest_status",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidLimit: {
                                    summary: "Invalid Limit Parameter",
                                    value: {
                                        success: false,
                                        message: "Validation failed",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "limit",
                                            message:
                                                "Limit must be between 1 and 100",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidCursor: {
                                    summary: "Invalid Pagination Cursor",
                                    value: {
                                        success: false,
                                        message: "Invalid pagination cursor",
                                        error: "INVALID_CURSOR",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                401: {
                    description:
                        "Unauthorized - Invalid or missing Bearer token. Include `Authorization: Bearer <your-access-token>` header.",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            examples: {
                                missingToken: {
                                    summary: "Missing Bearer Token",
                                    value: {
                                        success: false,
                                        message:
                                            "Authorization header is required. Include 'Bearer <your-access-token>'",
                                        error: "UNAUTHORIZED",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidToken: {
                                    summary: "Invalid Bearer Token",
                                    value: {
                                        success: false,
                                        message:
                                            "Invalid or expired Bearer token",
                                        error: "UNAUTHORIZED",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                429: {
                    description: "Rate limit exceeded",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/ErrorResponse",
                                    },
                                    {
                                        properties: {
                                            details: {
                                                $ref: "#/components/schemas/RateLimitInfo",
                                            },
                                        },
                                    },
                                ],
                            },
                            example: {
                                success: false,
                                message: "Too many requests",
                                error: "RATE_LIMITED",
                                details: {
                                    retryAfter: 60,
                                    reason: "too_many_requests",
                                },
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                500: {
                    $ref: "#/components/responses/InternalServerError",
                },
            },
        },
    },
};
