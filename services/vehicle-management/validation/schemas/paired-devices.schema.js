/**
 * Paired Devices Validation Schemas
 * Input validation using Zod for type safety and validation
 */

import { z } from "zod";

/**
 * Paired devices query parameters schema
 */
export const pairedDevicesQuerySchema = z.object({
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
        include: z
            .string()
            .optional()
            .default("vehicle,latest_status")
            .transform((val) => {
                if (!val) return ["vehicle", "latest_status"];
                return val.split(",").map((item) => item.trim());
            })
            .refine(
                (val) => {
                    const allowedIncludes = ["vehicle", "latest_status"];
                    return val.every((item) => allowedIncludes.includes(item));
                },
                {
                    message:
                        "Include must be one or more of: vehicle, latest_status",
                }
            ),
        limit: z.coerce
            .number()
            .int()
            .min(1, "Limit must be at least 1")
            .max(100, "Limit cannot exceed 100")
            .default(20),
        cursor: z.string().optional(),
        sort: z
            .enum(["last_seen_desc", "connected_at_desc"])
            .default("last_seen_desc"),
    }),
});
