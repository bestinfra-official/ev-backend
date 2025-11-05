/**
 * Vehicle Controller
 * Handles vehicle-related endpoints
 */

import {
    createLogger,
    successResponse,
    errorResponse,
    asyncHandler,
} from "@ev-platform/shared";
import vehicleService from "../services/vehicle.service.js";

const logger = createLogger("vehicle-controller");

/**
 * Get vehicles for authenticated user
 * GET /data/all-vehicles
 */
export const getVehicles = asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
        return res
            .status(401)
            .json(
                errorResponse("User authentication required", "UNAUTHORIZED")
            );
    }

    const {
        active,
        limit = 10,
        cursor,
        sort = "last_seen_desc",
        selected_vehicle_id,
    } = req.query;

    try {
        const result = await vehicleService.getVehicles({
            userId,
            active,
            limit,
            cursor,
            sort,
            selectedVehicleId: selected_vehicle_id,
        });

        // Set cache headers
        res.set({
            "Cache-Control": "private, max-age=10",
            "X-Total-Active": result.counts.total_active.toString(),
            "X-Total-All": result.counts.total_all.toString(),
        });

        return res
            .status(200)
            .json(successResponse(result, "Vehicles retrieved successfully"));
    } catch (error) {
        logger.error("Failed to get vehicles", {
            error: error.message,
            stack: error.stack,
            userId,
        });

        // Handle specific errors
        if (error.message.includes("invalid cursor")) {
            return res
                .status(400)
                .json(
                    errorResponse("Invalid pagination cursor", "INVALID_CURSOR")
                );
        }

        if (error.message.includes("rate limit")) {
            return res
                .status(429)
                .json(errorResponse("Too many requests", "RATE_LIMITED"));
        }

        throw error; // Let asyncHandler handle generic errors
    }
});
