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
                "Discovers charging stations within the vehicle's usable range based on current battery level and efficiency. Uses route-optimized search with charging strategy recommendations.\n\n**⚠️ Authentication Required:** This endpoint requires a valid Bearer token in the Authorization header. Format: `Bearer <your-access-token>`\n\n**How to get a token:**\n1. Request OTP: `POST /api/v1/auth/otp/request`\n2. Verify OTP: `POST /api/v1/auth/otp/verify`\n3. Use the `accessToken` from the response",
            operationId: "findStations",
            security: [
                {
                    BearerAuth: [],
                },
            ],
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
                        description:
                            "**Note:** This endpoint requires authentication. Include `Authorization: Bearer <your-access-token>` header.",
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
                                                    batteryPercentage: {
                                                        type: "number",
                                                        example: 85.5,
                                                        description:
                                                            "Current battery percentage",
                                                    },
                                                    totalRouteDistance: {
                                                        type: "number",
                                                        example: 45.2,
                                                        description:
                                                            "Total route distance in kilometers",
                                                    },
                                                    totalFound: {
                                                        type: "integer",
                                                        example: 12,
                                                        description:
                                                            "Total number of stations found",
                                                    },
                                                    routeSafety: {
                                                        type: "object",
                                                        properties: {
                                                            level: {
                                                                type: "string",
                                                                enum: [
                                                                    "safe",
                                                                    "moderate",
                                                                    "risky",
                                                                    "critical",
                                                                ],
                                                                example: "safe",
                                                            },
                                                            message: {
                                                                type: "string",
                                                                example:
                                                                    "Route is safe with current battery level",
                                                            },
                                                            safetyRatio: {
                                                                type: "number",
                                                                example: 2.67,
                                                            },
                                                            requiresCharging: {
                                                                type: "boolean",
                                                                example: false,
                                                            },
                                                            recommendedStationsAvailable:
                                                                {
                                                                    type: "boolean",
                                                                    example: true,
                                                                },
                                                        },
                                                    },
                                                    chargingStrategy: {
                                                        type: "object",
                                                        properties: {
                                                            optimalZone: {
                                                                type: "object",
                                                                properties: {
                                                                    start: {
                                                                        type: "number",
                                                                        example: 83.1,
                                                                    },
                                                                    end: {
                                                                        type: "number",
                                                                        example: 106.0,
                                                                    },
                                                                },
                                                            },
                                                            priorityZone: {
                                                                type: "object",
                                                                properties: {
                                                                    start: {
                                                                        type: "number",
                                                                        example: 90.4,
                                                                    },
                                                                    end: {
                                                                        type: "number",
                                                                        example: 97.2,
                                                                    },
                                                                },
                                                            },
                                                            safetyBuffer: {
                                                                type: "number",
                                                                example: 21.7,
                                                            },
                                                            maxReachableDistance:
                                                                {
                                                                    type: "number",
                                                                    example: 98.8,
                                                                },
                                                        },
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
                                                                    marker: {
                                                                        type: "object",
                                                                        properties:
                                                                            {
                                                                                type: {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "user",
                                                                                },
                                                                                icon: {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "user-marker.png",
                                                                                },
                                                                                title: {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "Your Location",
                                                                                },
                                                                            },
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
                                                                    marker: {
                                                                        type: "object",
                                                                        properties:
                                                                            {
                                                                                type: {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "destination",
                                                                                },
                                                                                icon: {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "destination-marker.png",
                                                                                },
                                                                                title: {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "Destination",
                                                                                },
                                                                            },
                                                                    },
                                                                },
                                                            },
                                                            routePolyline: {
                                                                type: "string",
                                                                example:
                                                                    "encoded_polyline_string",
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
                                                                            },
                                                                            name: {
                                                                                type: "string",
                                                                                example:
                                                                                    "Downtown Charging Hub",
                                                                            },
                                                                            latitude:
                                                                                {
                                                                                    type: "number",
                                                                                    example: 17.4740185,
                                                                                },
                                                                            longitude:
                                                                                {
                                                                                    type: "number",
                                                                                    example: 78.3204047,
                                                                                },
                                                                            distanceKm:
                                                                                {
                                                                                    type: "number",
                                                                                    example: 2.5,
                                                                                    description:
                                                                                        "Distance from user location in km",
                                                                                },
                                                                            powerKw:
                                                                                {
                                                                                    type: "number",
                                                                                    example: 150.0,
                                                                                    description:
                                                                                        "Station power rating in kW",
                                                                                },
                                                                            plugs: {
                                                                                type: "array",
                                                                                items: {
                                                                                    type: "object",
                                                                                    properties:
                                                                                        {
                                                                                            type: {
                                                                                                type: "string",
                                                                                                example:
                                                                                                    "CCS",
                                                                                            },
                                                                                            power: {
                                                                                                type: "number",
                                                                                                example: 50.0,
                                                                                            },
                                                                                            available:
                                                                                                {
                                                                                                    type: "boolean",
                                                                                                    example: true,
                                                                                                },
                                                                                        },
                                                                                },
                                                                            },
                                                                            availability:
                                                                                {
                                                                                    type: "string",
                                                                                    enum: [
                                                                                        "available",
                                                                                        "occupied",
                                                                                        "maintenance",
                                                                                        "offline",
                                                                                    ],
                                                                                    example:
                                                                                        "available",
                                                                                },
                                                                            operator:
                                                                                {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "ChargePoint",
                                                                                },
                                                                            address:
                                                                                {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "123 Main St",
                                                                                },
                                                                            city: {
                                                                                type: "string",
                                                                                example:
                                                                                    "New York",
                                                                            },
                                                                            state: {
                                                                                type: "string",
                                                                                example:
                                                                                    "NY",
                                                                            },
                                                                            pricing:
                                                                                {
                                                                                    type: "object",
                                                                                    properties:
                                                                                        {
                                                                                            per_kwh:
                                                                                                {
                                                                                                    type: "number",
                                                                                                    example: 0.25,
                                                                                                },
                                                                                            session_fee:
                                                                                                {
                                                                                                    type: "number",
                                                                                                    example: 1.0,
                                                                                                },
                                                                                        },
                                                                                },
                                                                            amenities:
                                                                                {
                                                                                    type: "array",
                                                                                    items: {
                                                                                        type: "string",
                                                                                    },
                                                                                    example:
                                                                                        [
                                                                                            "restrooms",
                                                                                            "food",
                                                                                            "wifi",
                                                                                        ],
                                                                                },
                                                                            isRecommended:
                                                                                {
                                                                                    type: "boolean",
                                                                                    example: true,
                                                                                    description:
                                                                                        "Whether this station is recommended for charging",
                                                                                },
                                                                        },
                                                                },
                                                            },
                                                        },
                                                    },
                                                    routeData: {
                                                        type: "object",
                                                        description:
                                                            "Route information and polyline data",
                                                    },
                                                    recommendations: {
                                                        type: "object",
                                                        properties: {
                                                            shouldCharge: {
                                                                type: "boolean",
                                                                example: false,
                                                            },
                                                            recommendedDistance:
                                                                {
                                                                    type: "number",
                                                                    example: 50.0,
                                                                },
                                                            urgency: {
                                                                type: "string",
                                                                enum: [
                                                                    "low",
                                                                    "medium",
                                                                    "high",
                                                                    "urgent",
                                                                    "critical",
                                                                ],
                                                                example: "low",
                                                            },
                                                            nextChargingStop: {
                                                                type: "object",
                                                                nullable: true,
                                                                properties: {
                                                                    stationId: {
                                                                        type: "string",
                                                                        example:
                                                                            "station_123",
                                                                    },
                                                                    distance: {
                                                                        type: "number",
                                                                        example: 2.5,
                                                                    },
                                                                    estimatedArrival:
                                                                        {
                                                                            type: "string",
                                                                            example:
                                                                                "3 minutes",
                                                                        },
                                                                    urgency: {
                                                                        type: "string",
                                                                        example:
                                                                            "low",
                                                                    },
                                                                },
                                                            },
                                                            optimalChargingDistance:
                                                                {
                                                                    type: "number",
                                                                    example: 83.1,
                                                                },
                                                            priorityChargingDistance:
                                                                {
                                                                    type: "number",
                                                                    example: 90.4,
                                                                },
                                                            routeRecommendations:
                                                                {
                                                                    type: "object",
                                                                    properties:
                                                                        {
                                                                            canReachDestination:
                                                                                {
                                                                                    type: "boolean",
                                                                                    example: true,
                                                                                },
                                                                            chargingStopsNeeded:
                                                                                {
                                                                                    type: "integer",
                                                                                    example: 0,
                                                                                },
                                                                            optimalChargingStops:
                                                                                {
                                                                                    type: "array",
                                                                                    items: {
                                                                                        type: "object",
                                                                                    },
                                                                                },
                                                                            routeStrategy:
                                                                                {
                                                                                    type: "string",
                                                                                    example:
                                                                                        "You can reach your destination without charging",
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
                                            batteryPercentage: 85.5,
                                            totalRouteDistance: 45.2,
                                            totalFound: 12,
                                            routeSafety: {
                                                level: "safe",
                                                message:
                                                    "Route is safe with current battery level",
                                                safetyRatio: 2.67,
                                                requiresCharging: false,
                                                recommendedStationsAvailable: true,
                                            },
                                            chargingStrategy: {
                                                optimalZone: {
                                                    start: 83.1,
                                                    end: 106.0,
                                                },
                                                priorityZone: {
                                                    start: 90.4,
                                                    end: 97.2,
                                                },
                                                safetyBuffer: 21.7,
                                                maxReachableDistance: 98.8,
                                            },
                                            mapData: {
                                                userLocation: {
                                                    lat: 13.0173603,
                                                    lng: 77.5501986,
                                                    marker: {
                                                        type: "user",
                                                        icon: "user-marker.png",
                                                        title: "Your Location",
                                                    },
                                                },
                                                destination: {
                                                    lat: 17.4740185,
                                                    lng: 78.3204047,
                                                    marker: {
                                                        type: "destination",
                                                        icon: "destination-marker.png",
                                                        title: "Destination",
                                                    },
                                                },
                                                routePolyline:
                                                    "encoded_polyline_string",
                                            },
                                            allStations: {
                                                totalCount: 12,
                                                stations: [
                                                    {
                                                        id: "station_123",
                                                        name: "Downtown Charging Hub",
                                                        latitude: 17.4740185,
                                                        longitude: 78.3204047,
                                                        distanceKm: 2.5,
                                                        powerKw: 150.0,
                                                        plugs: [
                                                            {
                                                                type: "CCS",
                                                                power: 50.0,
                                                                available: true,
                                                            },
                                                            {
                                                                type: "CHAdeMO",
                                                                power: 50.0,
                                                                available: true,
                                                            },
                                                        ],
                                                        availability:
                                                            "available",
                                                        operator: "ChargePoint",
                                                        address: "123 Main St",
                                                        city: "New York",
                                                        state: "NY",
                                                        pricing: {
                                                            per_kwh: 0.25,
                                                            session_fee: 1.0,
                                                        },
                                                        amenities: [
                                                            "restrooms",
                                                            "food",
                                                            "wifi",
                                                        ],
                                                        isRecommended: true,
                                                    },
                                                    {
                                                        id: "station_456",
                                                        name: "Central Plaza Station",
                                                        latitude: 13.0173603,
                                                        longitude: 77.5501986,
                                                        distanceKm: 5.2,
                                                        powerKw: 75.0,
                                                        plugs: [
                                                            {
                                                                type: "Type2",
                                                                power: 22.0,
                                                                available: true,
                                                            },
                                                        ],
                                                        availability:
                                                            "available",
                                                        operator: "EVgo",
                                                        address:
                                                            "456 Central Ave",
                                                        city: "New York",
                                                        state: "NY",
                                                        pricing: {
                                                            per_kwh: 0.3,
                                                            session_fee: 0.5,
                                                        },
                                                        amenities: [
                                                            "restrooms",
                                                        ],
                                                        isRecommended: false,
                                                    },
                                                ],
                                            },
                                            routeData: {
                                                polyline:
                                                    "encoded_polyline_string",
                                                distance: 45.2,
                                                duration: "35 minutes",
                                            },
                                            recommendations: {
                                                shouldCharge: false,
                                                recommendedDistance: 50.0,
                                                urgency: "low",
                                                nextChargingStop: {
                                                    stationId: "station_123",
                                                    distance: 2.5,
                                                    estimatedArrival:
                                                        "3 minutes",
                                                    urgency: "low",
                                                },
                                                optimalChargingDistance: 83.1,
                                                priorityChargingDistance: 90.4,
                                                routeRecommendations: {
                                                    canReachDestination: true,
                                                    chargingStopsNeeded: 0,
                                                    optimalChargingStops: [],
                                                    routeStrategy:
                                                        "You can reach your destination without charging",
                                                },
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
                                    message: "Invalid or expired Bearer token",
                                    error: "UNAUTHORIZED",
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
};
