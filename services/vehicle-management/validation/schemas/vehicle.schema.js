/**
 * Vehicle Validation Schemas
 * Input validation using Zod for type safety and validation
 */

import { z } from "zod";

/**
 * Vehicles query parameters schema
 */
export const vehiclesQuerySchema = z.object({
    query: z.object({
        active: z
            .string()
            .optional()
            .transform((val) => {
                if (val === undefined || val === null) return undefined;
                if (val === "true") return true;
                if (val === "false") return false;
                throw new Error("Active must be 'true' or 'false'");
            }),
        limit: z.coerce
            .number()
            .int()
            .min(1, "Limit must be at least 1")
            .max(100, "Limit cannot exceed 100")
            .default(10),
        cursor: z.string().optional(),
        sort: z
            .enum(["last_seen_desc", "make"])
            .default("last_seen_desc"),
        selected_vehicle_id: z.string().uuid().optional(),
    }),
});

