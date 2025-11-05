/**
 * Station Discovery Validation Schemas
 * Input validation using Zod for type safety and validation
 */

import { z } from "zod";

/**
 * Location schema for lat/lng coordinates
 */
export const locationSchema = z.object({
    lat: z.coerce
        .number()
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90"),
    lng: z.coerce
        .number()
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180"),
});

/**
 * Vehicle registration number schema
 */
export const regNumberSchema = z
    .string()
    .min(1, "Registration number is required")
    .max(20, "Registration number must be less than 20 characters")
    .regex(
        /^[A-Z0-9\s\-]+$/i,
        "Registration number contains invalid characters"
    );

/**
 * Battery percentage schema
 */
export const batteryPercentageSchema = z.coerce
    .number()
    .min(0, "Battery percentage must be between 0 and 100")
    .max(100, "Battery percentage must be between 0 and 100");

/**
 * Find stations request schema - follows auth-management pattern
 */
export const findStationsSchema = z.object({
    body: z.object({
        regNumber: regNumberSchema,
        batteryPercentage: batteryPercentageSchema,
        userLocation: locationSchema,
        destination: locationSchema.optional(),
    }),
});

/**
 * Health check schema (empty body)
 */
export const healthCheckSchema = z.object({
    body: z.object({}).optional(),
});

/**
 * Find nearby stations request schema
 * Body: { userLocation: {lat, lng}, radiusKm?: number, limit?: number }
 */
export const nearStationsSchema = z.object({
    body: z.object({
        userLocation: locationSchema,
        radiusKm: z.coerce
            .number()
            .min(0.1, "radiusKm must be positive")
            .max(200, "radiusKm too large")
            .optional()
            .default(20),
    }),
});

/**
 * Create hold schema
 */
export const createHoldSchema = z.object({
    body: z.object({
        stationId: z.string().uuid("Invalid station ID"),
        connectorId: z.string().uuid("Invalid connector ID"),
        startTs: z.string().datetime("Invalid start timestamp"),
        endTs: z.string().datetime("Invalid end timestamp"),
    }),
});

/**
 * Confirm booking schema
 */
export const confirmBookingSchema = z.object({
    body: z.object({
        holdToken: z.string().min(1, "Hold token is required"),
        paymentId: z.string().optional(),
    }),
});

/**
 * Get availability schema
 */
export const getAvailabilitySchema = z.object({
    params: z.object({
        id: z.string().uuid("Invalid station ID"),
    }),
    query: z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
        slotDurationMinutes: z.coerce.number().min(15).max(480).optional().default(60),
    }),
});

/**
 * Connector status webhook schema
 */
export const connectorStatusWebhookSchema = z.object({
    body: z.object({
        stationId: z.string().uuid().optional(),
        connectorId: z.string().uuid().optional(),
        vendorConnectorId: z.string().optional(),
        status: z.string().min(1),
        metadata: z.record(z.any()).optional(),
    }),
});

/**
 * Booking notification webhook schema
 */
export const bookingNotificationWebhookSchema = z.object({
    body: z.object({
        vendorBookingId: z.string().min(1),
        status: z.string().min(1),
        vendorConnectorId: z.string().optional(),
    }),
});

/**
 * Session start webhook schema
 */
export const sessionStartWebhookSchema = z.object({
    body: z.object({
        vendorSessionId: z.string().optional(),
        connectorId: z.string().uuid().optional(),
        vendorConnectorId: z.string().optional(),
        startMeterReading: z.coerce.number().min(0).optional(),
        bookingId: z.string().uuid().optional(),
    }),
});

/**
 * Session end webhook schema
 */
export const sessionEndWebhookSchema = z.object({
    body: z.object({
        vendorSessionId: z.string().optional(),
        sessionId: z.string().uuid().optional(),
        endMeterReading: z.coerce.number().min(0).optional(),
        energyKwh: z.coerce.number().min(0).optional(),
        costAmount: z.coerce.number().min(0).optional(),
    }),
});
