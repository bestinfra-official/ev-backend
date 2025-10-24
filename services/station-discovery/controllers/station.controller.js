/**
 * Station Discovery Controller
 * Handles station discovery endpoints with range calculation
 */

import {
    createLogger,
    successResponse,
    errorResponse,
    asyncHandler,
} from "@ev-platform/shared";
import stationLookupService from "../services/station-lookup.service.js";

const logger = createLogger("station-discovery");

/**
 * Find stations within vehicle range
 * POST /stations/find
 * Body: { regNumber, userLocation: {lat, lng}, destination?: {lat, lng} }
 */
export const findStations = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 11)}`;

    try {
        const { regNumber, batteryPercentage, userLocation, destination } =
            req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get("user-agent");

        // Find stations within range with optimal charging strategy
        const serviceResult = await stationLookupService.findStationsInRange(
            regNumber,
            batteryPercentage,
            userLocation,
            destination
        );

        // Extract the actual result from the service response
        const result = serviceResult.googleMapsResponse;

        const duration = Date.now() - startTime;
        logger.info(
            "Route-optimized station discovery completed successfully",
            {
                requestId,
                regNumber,
                usableRangeKm: result.usableRangeKm,
                batteryPercentage: result.batteryPercentage,
                totalRouteDistance: result.totalRouteDistance,
                totalFound: result.totalFound,
                recommendedCount: result.allStations.stations.filter(
                    (s) => s.isRecommended
                ).length,
                urgency: result.recommendations.urgency,
                routeSafety: result.routeSafety?.level,
                hasRouteData: !!result.routeData,
                nextChargingStop:
                    result.recommendations.nextChargingStop?.stationId || null,
                duration: `${duration}ms`,
            }
        );

        // Return route-optimized response
        return res
            .status(200)
            .json(
                successResponse(
                    result,
                    "Route-optimized charging stations found successfully"
                )
            );
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error("Station discovery failed", {
            requestId,
            error: error.message,
            stack: error.stack,
            duration: `${duration}ms`,
        });

        // Handle specific error types
        if (error.message === "Vehicle not found") {
            return res
                .status(404)
                .json(errorResponse("Vehicle not found", "VEHICLE_NOT_FOUND"));
        }

        // Generic error response
        return res
            .status(500)
            .json(errorResponse("Failed to find stations", "INTERNAL_ERROR"));
    }
});

/**
 * Health check endpoint
 * GET /stations/health
 */
export const healthCheck = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 11)}`;

    try {
        logger.info("Health check request received", { requestId });

        // Basic health check - could be extended to check Redis, DB, etc.
        const health = {
            status: "healthy",
            timestamp: new Date().toISOString(),
            service: "station-discovery",
            version: "1.0.0",
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV || "development",
        };

        const duration = Date.now() - startTime;
        logger.info("Health check completed", {
            requestId,
            duration: `${duration}ms`,
        });

        return res
            .status(200)
            .json(successResponse(health, "Service is healthy"));
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error("Health check failed", {
            requestId,
            error: error.message,
            stack: error.stack,
            duration: `${duration}ms`,
        });

        return res
            .status(500)
            .json(errorResponse("Health check failed", "SERVICE_UNHEALTHY"));
    }
});
