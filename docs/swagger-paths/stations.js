/**
 * Station Discovery Swagger Paths
 * API documentation for station discovery endpoints
 */

export default {
    "/api/v1/stations/find": {
        post: {
            tags: ["Station Discovery"],
            summary: "Find charging stations within vehicle range",
            description:
                "Discovers charging stations within the vehicle's usable range based on current battery level and efficiency. Uses route-optimized search with charging strategy recommendations.",
            operationId: "findStations",
            security: [],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                regNumber: {
                                    type: "string",
                                    example: "ABC123",
                                    description: "Vehicle registration number",
                                },
                                batteryPercentage: {
                                    type: "number",
                                    minimum: 0,
                                    maximum: 100,
                                    example: 85.5,
                                    description:
                                        "Current battery percentage (0-100)",
                                },
                                userLocation: {
                                    type: "object",
                                    properties: {
                                        lat: {
                                            type: "number",
                                            example: 13.0173603,
                                            description:
                                                "User's current latitude",
                                        },
                                        lng: {
                                            type: "number",
                                            example: 77.5501986,
                                            description:
                                                "User's current longitude",
                                        },
                                    },
                                    required: ["lat", "lng"],
                                },
                                destination: {
                                    type: "object",
                                    properties: {
                                        lat: {
                                            type: "number",
                                            example: 17.4740185,
                                            description:
                                                "Destination latitude (optional)",
                                        },
                                        lng: {
                                            type: "number",
                                            example: 78.3204047,
                                            description:
                                                "Destination longitude (optional)",
                                        },
                                    },
                                    description:
                                        "Optional destination for route-based filtering",
                                },
                            },
                            required: [
                                "regNumber",
                                "batteryPercentage",
                                "userLocation",
                            ],
                        },
                        example: {
                            regNumber: "ABC123",
                            batteryPercentage: 85.5,
                            userLocation: {
                                lat: 13.0173603,
                                lng: 77.5501986,
                            },
                            destination: {
                                lat: 17.4740185,
                                lng: 78.3204047,
                            },
                        },
                        description: "",
                    },
                },
            },
            responses: {
                200: {
                    description: "Stations found successfully",
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
                                                    usableRangeKm: {
                                                        type: "number",
                                                        example: 120.5,
                                                        description:
                                                            "Vehicle's usable range in kilometers",
                                                    },

                                                    totalFound: {
                                                        type: "integer",
                                                        example: 12,
                                                        description:
                                                            "Total number of stations found",
                                                    },

                                                    mapData: {
                                                        type: "object",
                                                        properties: {
                                                            userLocation: {
                                                                type: "object",
                                                                properties: {
                                                                    lat: {
                                                                        type: "number",
                                                                        example: 13.0173603,
                                                                    },
                                                                    lng: {
                                                                        type: "number",
                                                                        example: 77.5501986,
                                                                    },
                                                                },
                                                            },
                                                            destination: {
                                                                type: "object",
                                                                nullable: true,
                                                                properties: {
                                                                    lat: {
                                                                        type: "number",
                                                                        example: 17.4740185,
                                                                    },
                                                                    lng: {
                                                                        type: "number",
                                                                        example: 78.3204047,
                                                                    },
                                                                },
                                                            },
                                                        },
                                                    },
                                                    allStations: {
                                                        type: "object",
                                                        properties: {
                                                            totalCount: {
                                                                type: "integer",
                                                                example: 12,
                                                            },
                                                            stations: {
                                                                type: "array",
                                                                items: {
                                                                    type: "object",
                                                                    properties:
                                                                        {
                                                                            id: {
                                                                                type: "string",
                                                                                example:
                                                                                    "station_123",
                                                                                description:
                                                                                    "Unique station identifier",
                                                                            },
                                                                            name: {
                                                                                type: "string",
                                                                                example:
                                                                                    "Downtown Charging Hub",
                                                                                description:
                                                                                    "Station name",
                                                                            },
                                                                            latitude:
                                                                                {
                                                                                    type: "number",
                                                                                    example: 17.4740185,
                                                                                    description:
                                                                                        "Station latitude",
                                                                                },
                                                                            longitude:
                                                                                {
                                                                                    type: "number",
                                                                                    example: 78.3204047,
                                                                                    description:
                                                                                        "Station longitude",
                                                                                },
                                                                            distanceFromUserLocation:
                                                                                {
                                                                                    type: "number",
                                                                                    nullable: true,
                                                                                    example: 2.5,
                                                                                    description:
                                                                                        "Distance from user location in kilometers (Google Maps distance). Null if distance calculation failed.",
                                                                                },
                                                                            isRecommended:
                                                                                {
                                                                                    type: "boolean",
                                                                                    example: true,
                                                                                    description:
                                                                                        "Whether this station is recommended for charging based on optimal range strategy",
                                                                                },
                                                                            certified:
                                                                                {
                                                                                    type: "boolean",
                                                                                    example: true,
                                                                                    description:
                                                                                        "Whether this station is certified",
                                                                                },
                                                                        },
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                            examples: {
                                success: {
                                    summary: "Successful Station Discovery",
                                    value: {
                                        success: true,
                                        message:
                                            "Route-optimized charging stations found successfully",
                                        data: {
                                            usableRangeKm: 120.5,
                                            totalFound: 12,
                                            mapData: {
                                                userLocation: {
                                                    lat: 13.0173603,
                                                    lng: 77.5501986,
                                                },
                                                destination: {
                                                    lat: 17.4740185,
                                                    lng: 78.3204047,
                                                },
                                            },
                                            allStations: {
                                                totalCount: 12,
                                                stations: [
                                                    {
                                                        id: "station_123",
                                                        name: "Downtown Charging Hub",
                                                        latitude: 17.4740185,
                                                        longitude: 78.3204047,
                                                        distanceFromUserLocation: 2.5,
                                                        isRecommended: true,
                                                        certified: true,
                                                    },
                                                    {
                                                        id: "station_456",
                                                        name: "Central Plaza Station",
                                                        latitude: 13.0173603,
                                                        longitude: 77.5501986,
                                                        distanceFromUserLocation: 5.2,
                                                        isRecommended: false,
                                                        certified: false,
                                                    },
                                                ],
                                            },
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
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
                                        field: "regNumber",
                                        message:
                                            "Registration number is required",
                                    },
                                    timestamp: "2024-01-15T10:30:00Z",
                                },
                            },
                            invalidLocation: {
                                summary: "Invalid Location",
                                value: {
                                    success: false,
                                    message:
                                        "Latitude must be between -90 and 90",
                                    error: "VALIDATION_ERROR",
                                    details: {
                                        field: "userLocation.lat",
                                        message:
                                            "Latitude must be between -90 and 90",
                                    },
                                    timestamp: "2024-01-15T10:30:00Z",
                                },
                            },
                            invalidBattery: {
                                summary: "Invalid Battery Percentage",
                                value: {
                                    success: false,
                                    message:
                                        "Battery percentage must be between 0 and 100",
                                    error: "VALIDATION_ERROR",
                                    details: {
                                        field: "batteryPercentage",
                                        message:
                                            "Battery percentage must be between 0 and 100",
                                    },
                                    timestamp: "2024-01-15T10:30:00Z",
                                },
                            },
                        },
                    },
                },
            },

            404: {
                description: "Vehicle not found",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/ErrorResponse",
                        },
                        example: {
                            success: false,
                            message: "Vehicle not found",
                            error: "VEHICLE_NOT_FOUND",
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
            500: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/ErrorResponse",
                        },
                        example: {
                            success: false,
                            message: "Failed to find stations",
                            error: "INTERNAL_ERROR",
                            timestamp: "2024-01-15T10:30:00Z",
                        },
                    },
                },
            },
        },
    },
    "/api/v1/stations/nearby": {
        post: {
            tags: ["Station Discovery"],
            summary: "Find nearby charging stations by user location",
            description:
                "Returns charging stations near a given location within an optional radius.",
            operationId: "findStationsNearby",
            security: [],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            properties: {
                                userLocation: {
                                    type: "object",
                                    properties: {
                                        lat: {
                                            type: "number",
                                            example: 13.0173603,
                                        },
                                        lng: {
                                            type: "number",
                                            example: 77.5501986,
                                        },
                                    },
                                    required: ["lat", "lng"],
                                    description: "User's current location",
                                },
                                radiusKm: {
                                    type: "number",
                                    minimum: 0.1,
                                    maximum: 200,
                                    default: 20,
                                    example: 20,
                                    description:
                                        "Search radius in kilometers (default 20)",
                                },
                            },
                            required: ["userLocation"],
                        },
                        example: {
                            userLocation: { lat: 13.0173603, lng: 77.5501986 },
                            radiusKm: 15,
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Nearby stations fetched successfully",
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
                                                    stations: {
                                                        type: "array",
                                                        items: {
                                                            type: "object",
                                                            properties: {
                                                                id: {
                                                                    type: "string",
                                                                    example:
                                                                        "station_123",
                                                                    description:
                                                                        "Unique station identifier",
                                                                },
                                                                name: {
                                                                    type: "string",
                                                                    example:
                                                                        "Downtown Charging Hub",
                                                                    description:
                                                                        "Station name",
                                                                },
                                                                latitude: {
                                                                    type: "number",
                                                                    example: 13.01736,
                                                                    description:
                                                                        "Station latitude",
                                                                },
                                                                longitude: {
                                                                    type: "number",
                                                                    example: 77.5501986,
                                                                    description:
                                                                        "Station longitude",
                                                                },
                                                                distanceFromUserLocation:
                                                                    {
                                                                        type: "number",
                                                                        example: 2.5,
                                                                        description:
                                                                            "Distance from user location in kilometers (Google Maps distance). Stations are sorted by this distance.",
                                                                    },
                                                                certified: {
                                                                    type: "boolean",
                                                                    example: true,
                                                                    description:
                                                                        "Whether this station is certified",
                                                                },
                                                            },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                            examples: {
                                success: {
                                    summary: "Successful Nearby Stations",
                                    value: {
                                        success: true,
                                        message:
                                            "Nearby stations fetched successfully",
                                        data: {
                                            stations: [
                                                {
                                                    id: "station_123",
                                                    name: "Downtown Charging Hub",
                                                    latitude: 13.01736,
                                                    longitude: 77.5501986,
                                                    distanceFromUserLocation: 2.5,
                                                    certified: true,
                                                },
                                                {
                                                    id: "station_456",
                                                    name: "Central Plaza Station",
                                                    latitude: 13.005,
                                                    longitude: 77.56,
                                                    distanceFromUserLocation: 5.2,
                                                    certified: false,
                                                },
                                            ],
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
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
                                invalidLocation: {
                                    summary: "Invalid Location",
                                    value: {
                                        success: false,
                                        message:
                                            "Latitude must be between -90 and 90",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "userLocation.lat",
                                            message:
                                                "Latitude must be between -90 and 90",
                                        },
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
                500: {
                    description: "Internal server error",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            example: {
                                success: false,
                                message: "Failed to fetch nearby stations",
                                error: "INTERNAL_ERROR",
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
            },
        },
    },
};
