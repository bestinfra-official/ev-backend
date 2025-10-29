/**
 * Vehicle Pairing Validation Schemas
 * Input validation using Zod for type safety and validation
 */

import { z } from "zod";

/**
 * Vehicle static data schema
 */
export const vehicleStaticSchema = z.object({
    make: z
        .string()
        .min(1, "Make is required")
        .max(100, "Make must be less than 100 characters")
        .optional(),
    model: z
        .string()
        .min(1, "Model is required")
        .max(100, "Model must be less than 100 characters")
        .optional(),
    year: z.coerce
        .number()
        .int()
        .min(1900, "Year must be >= 1900")
        .max(new Date().getFullYear() + 2, "Year cannot be in the future")
        .optional(),
    battery_capacity_kwh: z.coerce
        .number()
        .positive("Battery capacity must be positive")
        .optional(),
    efficiency_kwh_per_km: z.coerce
        .number()
        .positive("Efficiency must be positive")
        .optional(),
});

/**
 * Pairing request schema
 */
export const pairingSchema = z.object({
    body: z.object({
        chassis_number: z
            .string()
            .min(1, "Chassis number is required")
            .max(50, "Chassis number must be less than 50 characters")
            .regex(
                /^[A-Z0-9]+$/i,
                "Chassis number contains invalid characters"
            ),
        reg_number: z
            .string()
            .min(1, "Registration number is required")
            .max(20, "Registration number must be less than 20 characters")
            .regex(
                /^[A-Z0-9\s\-]+$/i,
                "Registration number contains invalid characters"
            ),
        bluetooth_mac: z
            .string()
            .regex(
                /^([0-9A-F]{2}[:\-]){5}([0-9A-F]{2})$/i,
                "Invalid Bluetooth MAC address format"
            )
            .optional(),
        vehicle_static: vehicleStaticSchema.optional(),
    }),
});
