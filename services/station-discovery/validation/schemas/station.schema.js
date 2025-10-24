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
