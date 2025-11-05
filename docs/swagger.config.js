/**
 * Swagger Configuration for EV Charging Platform
 * Centralized configuration for API documentation
 */

import authPaths from "./swagger-paths/auth.js";
import stationPaths from "./swagger-paths/stations.js";
import vehiclePaths from "./swagger-paths/vehicles.js";
import { GATEWAY_PORT } from "../config/services.config.js";

const swaggerSpec = {
    openapi: "3.0.0",
    info: {
        title: "EV Charging Platform API",
        version: "1.0.0",
        description: "EV Charging Platform API Documentation",
        contact: {
            name: "EV Platform Team",
            email: "support@evplatform.com",
            url: "https://api.bestinfra.app/ev/",
        },
        license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT",
        },
        termsOfService: "https://api.bestinfra.app/ev/terms",
    },
    servers: [
        {
            url: `http://localhost:${GATEWAY_PORT}`,
            description: "Development server (Default)",
        },
        {
            url: "https://api.bestinfra.app/ev/",
            description: "Production server",
        },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "JWT token obtained from OTP verification",
            },
            ApiVersionHeader: {
                type: "apiKey",
                in: "header",
                name: "X-API-Version",
                description: "API version header (e.g., v1, v2)",
            },
        },
        schemas: {
            // Common Response Schemas
            SuccessResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: true,
                    },
                    message: {
                        type: "string",
                        example: "Operation completed successfully",
                    },
                    data: {
                        type: "object",
                        description: "Response data",
                    },
                    timestamp: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T10:30:00Z",
                    },
                },
                required: ["success", "message"],
            },
            ErrorResponse: {
                type: "object",
                properties: {
                    success: {
                        type: "boolean",
                        example: false,
                    },
                    message: {
                        type: "string",
                        example: "Error message",
                    },
                    error: {
                        type: "string",
                        example: "ERROR_CODE",
                    },
                    details: {
                        type: "object",
                        description: "Additional error details",
                    },
                    timestamp: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T10:30:00Z",
                    },
                },
                required: ["success", "message", "error"],
            },

            // Auth Schemas
            PhoneNumber: {
                type: "string",
                pattern: "^[\\d\\s\\+\\-\\(\\)]+$",
                minLength: 10,
                maxLength: 15,
                example: "+919876543210",
                description: "Phone number in international format",
            },
            CountryCode: {
                type: "string",
                pattern: "^[A-Z]{2}$",
                length: 2,
                example: "IN",
                description: "ISO 3166-1 alpha-2 country code",
            },
            OTPCode: {
                type: "string",
                pattern: "^\\d{6}$",
                length: 6,
                example: "123456",
                description: "6-digit OTP code",
            },
            RequestOTPBody: {
                type: "object",
                properties: {
                    phone: {
                        $ref: "#/components/schemas/PhoneNumber",
                    },
                    countryCode: {
                        $ref: "#/components/schemas/CountryCode",
                    },
                },
                required: ["phone"],
            },
            VerifyOTPBody: {
                type: "object",
                properties: {
                    phone: {
                        $ref: "#/components/schemas/PhoneNumber",
                    },
                    otp: {
                        $ref: "#/components/schemas/OTPCode",
                    },
                },
                required: ["phone", "otp"],
            },
            RefreshTokenBody: {
                type: "object",
                properties: {
                    refreshToken: {
                        type: "string",
                        description:
                            "Refresh token for getting new access token",
                    },
                },
                required: ["refreshToken"],
            },
            LogoutBody: {
                type: "object",
                properties: {
                    refreshToken: {
                        type: "string",
                        description: "Refresh token to revoke",
                    },
                },
                required: ["refreshToken"],
            },
            User: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "user_123",
                    },
                    phone: {
                        $ref: "#/components/schemas/PhoneNumber",
                    },
                    countryCode: {
                        $ref: "#/components/schemas/CountryCode",
                    },
                    isVerified: {
                        type: "boolean",
                        example: true,
                    },
                    verifiedAt: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T10:30:00Z",
                    },
                },
            },
            Tokens: {
                type: "object",
                properties: {
                    accessToken: {
                        type: "string",
                        description: "JWT access token",
                    },
                    refreshToken: {
                        type: "string",
                        description: "JWT refresh token",
                    },
                    expiresIn: {
                        type: "integer",
                        description: "Access token expiration time in seconds",
                        example: 900,
                    },
                },
            },

            // Vehicle Schemas
            Vehicle: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "vehicle_123",
                    },
                    make: {
                        type: "string",
                        example: "Tesla",
                    },
                    model: {
                        type: "string",
                        example: "Model 3",
                    },
                    year: {
                        type: "integer",
                        example: 2023,
                    },
                    vin: {
                        type: "string",
                        example: "1HGBH41JXMN109186",
                    },
                    batteryCapacity: {
                        type: "number",
                        example: 75.0,
                        description: "Battery capacity in kWh",
                    },
                    maxChargeRate: {
                        type: "number",
                        example: 11.0,
                        description: "Maximum charge rate in kW",
                    },
                },
            },
            CreateVehicleBody: {
                type: "object",
                properties: {
                    make: {
                        type: "string",
                        example: "Tesla",
                    },
                    model: {
                        type: "string",
                        example: "Model 3",
                    },
                    year: {
                        type: "integer",
                        example: 2023,
                    },
                    vin: {
                        type: "string",
                        example: "1HGBH41JXMN109186",
                    },
                    batteryCapacity: {
                        type: "number",
                        example: 75.0,
                    },
                    maxChargeRate: {
                        type: "number",
                        example: 11.0,
                    },
                },
                required: ["make", "model", "year", "vin"],
            },

            // Vehicle Management Schemas
            VehicleStaticData: {
                type: "object",
                description:
                    "Optional vehicle static data (make, model, year, battery specs)",
                properties: {
                    make: {
                        type: "string",
                        minLength: 1,
                        maxLength: 100,
                        example: "Tata",
                        description: "Vehicle manufacturer",
                    },
                    model: {
                        type: "string",
                        minLength: 1,
                        maxLength: 100,
                        example: "Nexon EV",
                        description: "Vehicle model name",
                    },
                    year: {
                        type: "integer",
                        minimum: 1900,
                        maximum: 2026,
                        example: 2024,
                        description: "Vehicle manufacturing year",
                    },
                    battery_capacity_kwh: {
                        type: "number",
                        minimum: 0,
                        example: 30.0,
                        description: "Battery capacity in kilowatt-hours (kWh)",
                    },
                    efficiency_kwh_per_km: {
                        type: "number",
                        minimum: 0,
                        example: 0.15,
                        description:
                            "Energy efficiency in kilowatt-hours per kilometer",
                    },
                },
            },
            PairVehicleBody: {
                type: "object",
                description: "Vehicle pairing request body",
                properties: {
                    chassis_number: {
                        type: "string",
                        minLength: 1,
                        maxLength: 50,
                        pattern: "^[A-Z0-9]+$",
                        example: "VIN1234567890ABCDE",
                        description:
                            "Vehicle chassis number (VIN). Must contain only alphanumeric characters (uppercase).",
                    },
                    reg_number: {
                        type: "string",
                        minLength: 1,
                        maxLength: 20,
                        pattern: "^[A-Z0-9\\s\\-]+$",
                        example: "DL01AB1234",
                        description:
                            "Vehicle registration number. Must contain only alphanumeric characters, spaces, and hyphens.",
                    },
                    bluetooth_mac: {
                        type: "string",
                        pattern: "^([0-9A-F]{2}[:\\-]){5}([0-9A-F]{2})$",
                        example: "AA:BB:CC:DD:EE:FF",
                        description:
                            "Optional Bluetooth MAC address in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX",
                    },
                    vehicle_static: {
                        $ref: "#/components/schemas/VehicleStaticData",
                        description:
                            "Optional vehicle static data (make, model, year, battery specifications)",
                    },
                },
                required: ["chassis_number", "reg_number"],
            },
            PairedDeviceResponse: {
                type: "object",
                description: "Response data for successful vehicle pairing",
                properties: {
                    paired_device_id: {
                        type: "string",
                        format: "uuid",
                        example: "550e8400-e29b-41d4-a716-446655440000",
                        description: "UUID of the paired device record",
                    },
                    vehicle_id: {
                        type: "string",
                        format: "uuid",
                        example: "550e8400-e29b-41d4-a716-446655440001",
                        description: "UUID of the vehicle record",
                    },
                    message: {
                        type: "string",
                        example: "Vehicle paired successfully",
                    },
                    paired_devices_count: {
                        type: "integer",
                        example: 2,
                        description:
                            "Total number of active paired devices for the user",
                    },
                },
                required: [
                    "paired_device_id",
                    "vehicle_id",
                    "message",
                    "paired_devices_count",
                ],
            },
            PairedDevice: {
                type: "object",
                description:
                    "Paired device information with optional expansions",
                properties: {
                    id: {
                        type: "string",
                        format: "uuid",
                        example: "550e8400-e29b-41d4-a716-446655440000",
                        description: "Paired device UUID",
                    },
                    status: {
                        type: "string",
                        enum: ["active", "inactive"],
                        example: "active",
                        description: "Device pairing status",
                    },
                    connected_at: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T09:00:00Z",
                        description:
                            "Timestamp when the device was first connected",
                    },
                    device: {
                        type: "object",
                        properties: {
                            bluetooth_mac: {
                                type: "string",
                                nullable: true,
                                example: "AA:BB:CC:DD:EE:FF",
                                description: "Bluetooth MAC address",
                            },
                        },
                        required: ["bluetooth_mac"],
                    },
                    vehicle_info: {
                        type: "object",
                        properties: {
                            reg_number: {
                                type: "string",
                                example: "DL01AB1234",
                                description: "Vehicle registration number",
                            },
                            make: {
                                type: "string",
                                nullable: true,
                                example: "Tata",
                                description:
                                    "Vehicle manufacturer (included if 'vehicle' expansion requested)",
                            },
                            model: {
                                type: "string",
                                nullable: true,
                                example: "Nexon EV",
                                description:
                                    "Vehicle model (included if 'vehicle' expansion requested)",
                            },
                        },
                        required: ["reg_number"],
                    },
                },
                required: [
                    "id",
                    "status",
                    "connected_at",
                    "device",
                    "vehicle_info",
                ],
            },
            BluetoothMAC: {
                type: "string",
                pattern: "^([0-9A-F]{2}[:\\-]){5}([0-9A-F]{2})$",
                example: "AA:BB:CC:DD:EE:FF",
                description:
                    "Bluetooth MAC address in format XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX (case insensitive)",
            },
            ChassisNumber: {
                type: "string",
                minLength: 1,
                maxLength: 50,
                pattern: "^[A-Z0-9]+$",
                example: "VIN1234567890ABCDE",
                description:
                    "Vehicle chassis number (VIN). Must contain only alphanumeric characters (uppercase).",
            },
            RegistrationNumber: {
                type: "string",
                minLength: 1,
                maxLength: 20,
                pattern: "^[A-Z0-9\\s\\-]+$",
                example: "DL01AB1234",
                description:
                    "Vehicle registration number. Must contain only alphanumeric characters, spaces, and hyphens.",
            },

            // Station Schemas
            ChargingStation: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "station_123",
                    },
                    name: {
                        type: "string",
                        example: "Downtown Charging Hub",
                    },
                    address: {
                        type: "string",
                        example: "123 Main St, City, State",
                    },
                    location: {
                        type: "object",
                        properties: {
                            latitude: {
                                type: "number",
                                example: 13.0173603,
                            },
                            longitude: {
                                type: "number",
                                example: 77.5501986,
                            },
                        },
                    },
                    connectors: {
                        type: "array",
                        items: {
                            $ref: "#/components/schemas/Connector",
                        },
                    },
                    status: {
                        type: "string",
                        enum: [
                            "available",
                            "occupied",
                            "maintenance",
                            "offline",
                        ],
                        example: "available",
                    },
                    pricing: {
                        $ref: "#/components/schemas/Pricing",
                    },
                },
            },
            Connector: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "connector_1",
                    },
                    type: {
                        type: "string",
                        enum: ["Type1", "Type2", "CCS", "CHAdeMO", "Tesla"],
                        example: "Type2",
                    },
                    power: {
                        type: "number",
                        example: 22.0,
                        description: "Power rating in kW",
                    },
                    status: {
                        type: "string",
                        enum: [
                            "available",
                            "occupied",
                            "maintenance",
                            "offline",
                        ],
                        example: "available",
                    },
                },
            },
            Pricing: {
                type: "object",
                properties: {
                    energyRate: {
                        type: "number",
                        example: 0.25,
                        description: "Price per kWh in USD",
                    },
                    timeRate: {
                        type: "number",
                        example: 0.1,
                        description: "Price per minute in USD",
                    },
                    currency: {
                        type: "string",
                        example: "USD",
                    },
                },
            },

            // Booking Schemas
            Booking: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "booking_123",
                    },
                    userId: {
                        type: "string",
                        example: "user_123",
                    },
                    stationId: {
                        type: "string",
                        example: "station_123",
                    },
                    connectorId: {
                        type: "string",
                        example: "connector_1",
                    },
                    startTime: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T14:00:00Z",
                    },
                    endTime: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T16:00:00Z",
                    },
                    duration: {
                        type: "integer",
                        example: 120,
                        description: "Duration in minutes",
                    },
                    status: {
                        type: "string",
                        enum: ["scheduled", "active", "completed", "cancelled"],
                        example: "scheduled",
                    },
                    estimatedCost: {
                        type: "number",
                        example: 15.5,
                    },
                },
            },
            CreateBookingBody: {
                type: "object",
                properties: {
                    stationId: {
                        type: "string",
                        example: "station_123",
                    },
                    connectorId: {
                        type: "string",
                        example: "connector_1",
                    },
                    startTime: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T14:00:00Z",
                    },
                    duration: {
                        type: "integer",
                        example: 120,
                        description: "Duration in minutes",
                    },
                },
                required: ["stationId", "connectorId", "startTime", "duration"],
            },

            // Payment Schemas
            Payment: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "payment_123",
                    },
                    userId: {
                        type: "string",
                        example: "user_123",
                    },
                    amount: {
                        type: "number",
                        example: 25.5,
                    },
                    currency: {
                        type: "string",
                        example: "USD",
                    },
                    status: {
                        type: "string",
                        enum: ["pending", "completed", "failed", "refunded"],
                        example: "completed",
                    },
                    paymentMethod: {
                        type: "string",
                        example: "card",
                    },
                    transactionId: {
                        type: "string",
                        example: "txn_123456",
                    },
                    createdAt: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T10:30:00Z",
                    },
                },
            },

            // Charging Session Schemas
            ChargingSession: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "session_123",
                    },
                    userId: {
                        type: "string",
                        example: "user_123",
                    },
                    vehicleId: {
                        type: "string",
                        example: "vehicle_123",
                    },
                    stationId: {
                        type: "string",
                        example: "station_123",
                    },
                    connectorId: {
                        type: "string",
                        example: "connector_1",
                    },
                    startTime: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T14:00:00Z",
                    },
                    endTime: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T16:00:00Z",
                    },
                    energyDelivered: {
                        type: "number",
                        example: 45.2,
                        description: "Energy delivered in kWh",
                    },
                    cost: {
                        type: "number",
                        example: 12.5,
                    },
                    status: {
                        type: "string",
                        enum: ["active", "completed", "stopped", "error"],
                        example: "completed",
                    },
                },
            },

            // Notification Schemas
            Notification: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                        example: "notification_123",
                    },
                    userId: {
                        type: "string",
                        example: "user_123",
                    },
                    type: {
                        type: "string",
                        enum: [
                            "booking_confirmed",
                            "charging_started",
                            "charging_completed",
                            "payment_received",
                            "system_alert",
                        ],
                        example: "charging_completed",
                    },
                    title: {
                        type: "string",
                        example: "Charging Complete",
                    },
                    message: {
                        type: "string",
                        example:
                            "Your vehicle has finished charging. Total cost: $12.50",
                    },
                    read: {
                        type: "boolean",
                        example: false,
                    },
                    createdAt: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T10:30:00Z",
                    },
                },
            },

            // Analytics Schemas
            UsageAnalytics: {
                type: "object",
                properties: {
                    userId: {
                        type: "string",
                        example: "user_123",
                    },
                    period: {
                        type: "string",
                        enum: ["daily", "weekly", "monthly", "yearly"],
                        example: "monthly",
                    },
                    totalSessions: {
                        type: "integer",
                        example: 15,
                    },
                    totalEnergyDelivered: {
                        type: "number",
                        example: 450.5,
                        description: "Total energy in kWh",
                    },
                    totalCost: {
                        type: "number",
                        example: 125.75,
                    },
                    averageSessionDuration: {
                        type: "number",
                        example: 95.5,
                        description: "Average duration in minutes",
                    },
                    favoriteStations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                stationId: {
                                    type: "string",
                                    example: "station_123",
                                },
                                stationName: {
                                    type: "string",
                                    example: "Downtown Charging Hub",
                                },
                                sessions: {
                                    type: "integer",
                                    example: 8,
                                },
                            },
                        },
                    },
                },
            },

            // Rate Limit Schemas
            RateLimitInfo: {
                type: "object",
                properties: {
                    retryAfter: {
                        type: "integer",
                        description: "Seconds to wait before retrying",
                        example: 60,
                    },
                    reason: {
                        type: "string",
                        example: "too_many_requests",
                    },
                    limit: {
                        type: "integer",
                        example: 10,
                    },
                    remaining: {
                        type: "integer",
                        example: 0,
                    },
                    resetTime: {
                        type: "string",
                        format: "date-time",
                        example: "2024-01-15T11:00:00Z",
                    },
                },
            },
        },
        responses: {
            Success: {
                description: "Successful operation",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/SuccessResponse",
                        },
                    },
                },
            },
            Error: {
                description: "Error response",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/ErrorResponse",
                        },
                    },
                },
            },
            ValidationError: {
                description: "Validation error",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/ErrorResponse",
                        },
                        example: {
                            success: false,
                            message: "Validation failed",
                            error: "VALIDATION_ERROR",
                            details: {
                                field: "phone",
                                message: "Invalid phone number format",
                            },
                        },
                    },
                },
            },
            RateLimitError: {
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
                        },
                    },
                },
            },
            Unauthorized: {
                description: "Unauthorized - Invalid or missing token",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/ErrorResponse",
                        },
                        example: {
                            success: false,
                            message: "Unauthorized access",
                            error: "UNAUTHORIZED",
                        },
                    },
                },
            },
            Forbidden: {
                description: "Forbidden - Insufficient permissions",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/ErrorResponse",
                        },
                        example: {
                            success: false,
                            message: "Insufficient permissions",
                            error: "FORBIDDEN",
                        },
                    },
                },
            },
            NotFound: {
                description: "Resource not found",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/ErrorResponse",
                        },
                        example: {
                            success: false,
                            message: "Resource not found",
                            error: "NOT_FOUND",
                        },
                    },
                },
            },
            InternalServerError: {
                description: "Internal server error",
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/ErrorResponse",
                        },
                        example: {
                            success: false,
                            message: "Internal server error",
                            error: "INTERNAL_ERROR",
                        },
                    },
                },
            },
        },
        parameters: {
            VersionHeader: {
                name: "X-API-Version",
                in: "header",
                description: "API version",
                schema: {
                    type: "string",
                    enum: ["v1", "v2"],
                    default: "v1",
                },
            },
            AuthorizationHeader: {
                name: "Authorization",
                in: "header",
                description:
                    "Bearer token for authentication. Format: 'Bearer <your-access-token>'",
                required: true,
                schema: {
                    type: "string",
                    format: "bearer",
                    example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
            },
            PageParam: {
                name: "page",
                in: "query",
                description: "Page number for pagination",
                schema: {
                    type: "integer",
                    minimum: 1,
                    default: 1,
                },
            },
            LimitParam: {
                name: "limit",
                in: "query",
                description: "Number of items per page",
                schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 100,
                    default: 20,
                },
            },
            LatitudeParam: {
                name: "lat",
                in: "query",
                description: "Latitude for location-based queries",
                required: true,
                schema: {
                    type: "number",
                    format: "float",
                    example: 13.0173603,
                },
            },
            LongitudeParam: {
                name: "lng",
                in: "query",
                description: "Longitude for location-based queries",
                required: true,
                schema: {
                    type: "number",
                    format: "float",
                    example: 77.5501986,
                },
            },
            RadiusParam: {
                name: "radius",
                in: "query",
                description: "Search radius in kilometers",
                schema: {
                    type: "number",
                    minimum: 0.1,
                    maximum: 100,
                    default: 5,
                },
            },
        },
    },
    tags: [
        {
            name: "Authentication",
            description:
                "User authentication and OTP verification endpoints (Fully Implemented)",
        },
        {
            name: "Station Discovery",
            description:
                "Charging station discovery and range calculation endpoints (Fully Implemented)",
        },
        {
            name: "Vehicle Management",
            description:
                "Vehicle and Bluetooth device pairing endpoints with pagination, filtering, and safety features (Fully Implemented)",
        },
    ],
    security: [
        {
            BearerAuth: [],
        },
    ],
    paths: {
        ...authPaths,
        ...stationPaths,
        ...vehiclePaths,
    },
};

export default swaggerSpec;
