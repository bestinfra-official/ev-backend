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
import stationService from "../services/station.service.js";
import { Station, Connector } from "../models/index.js";
import connectorStatusService from "../services/connector-status.service.js";

const logger = createLogger("station-management");

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
            service: "station-management",
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

/**
 * Find stations near a given user location
 * POST /stations/near
 * Body: { userLocation: {lat, lng}, radiusKm?: number, limit?: number }
 */
export const findStationsNear = asyncHandler(async (req, res) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 11)}`;

    try {
        const { userLocation, radiusKm = 20 } = req.body || {};

        const stations = await stationLookupService.findStationsNearLocation(
            userLocation,
            radiusKm
        );

        const duration = Date.now() - startTime;
        return res
            .status(200)
            .json(
                successResponse(
                    { stations },
                    "Nearby stations fetched successfully"
                )
            );
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error("Nearby stations fetch failed", {
            requestId,
            error: error.message,
            stack: error.stack,
            duration: `${duration}ms`,
        });
        return res
            .status(500)
            .json(
                errorResponse(
                    "Failed to fetch nearby stations",
                    "INTERNAL_ERROR"
                )
            );
    }
});

/**
 * Get station details with real-time connector status
 * GET /stations/:id
 */
export const getStationDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        // Get station from DB
        const station = await Station.findById(id);
        if (!station) {
            return res.status(404).json(errorResponse("Station not found", "NOT_FOUND"));
        }

        // Get connectors from DB
        const connectors = await Connector.findByStationId(id);

        // Get real-time status from Redis
        const connectorsWithStatus = await Promise.all(
            connectors.map(async (connector) => {
                const redisStatus = await connectorStatusService.getConnectorStatus(
                    id,
                    connector.id
                );

                return {
                    id: connector.id,
                    connectorNumber: connector.connector_number,
                    connectorType: connector.connector_type,
                    powerKw: parseFloat(connector.power_kw),
                    status: redisStatus?.status || connector.status,
                    updatedAt: redisStatus?.updated_at
                        ? new Date(redisStatus.updated_at * 1000).toISOString()
                        : connector.updated_at,
                    currentBookingId: connector.current_booking_id,
                };
            })
        );

        return res.status(200).json(
            successResponse(
                {
                    id: station.id,
                    name: station.name,
                    latitude: parseFloat(station.latitude),
                    longitude: parseFloat(station.longitude),
                    address: station.address,
                    city: station.city,
                    state: station.state,
                    operatorName: station.operator_name,
                    pricingInfo: station.pricing_info,
                    amenities: station.amenities,
                    certified: station.certified,
                    connectors: connectorsWithStatus,
                },
                "Station details fetched successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to get station details", {
            error: error.message,
            stationId: id,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to fetch station details", "INTERNAL_ERROR"));
    }
});

/**
 * Get available time slots for a station
 * GET /stations/:id/availability
 */
export const getStationAvailability = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
        startDate = new Date().toISOString(),
        endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        slotDurationMinutes = 60,
    } = req.query;

    try {
        // Verify station exists
        const station = await Station.findById(id);
        if (!station) {
            return res.status(404).json(errorResponse("Station not found", "NOT_FOUND"));
        }

        // Compute available slots
        const slots = await stationService.computeAvailableSlots(
            id,
            new Date(startDate),
            new Date(endDate),
            parseInt(slotDurationMinutes)
        );

        return res.status(200).json(
            successResponse(
                {
                    stationId: id,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    slotDurationMinutes: parseInt(slotDurationMinutes),
                    availableSlots: slots,
                    total: slots.length,
                },
                "Availability fetched successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to get station availability", {
            error: error.message,
            stationId: id,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to fetch availability", "INTERNAL_ERROR"));
    }
});

/**
 * Get cached availability (fast read)
 * GET /stations/:id/availability/cached
 */
export const getCachedAvailability = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
        const availability = await stationService.getCachedAvailability(id);

        if (!availability) {
            // Fallback to computing fresh
            const slots = await stationService.computeAvailableSlots(id);
            return res.status(200).json(
                successResponse(
                    {
                        stationId: id,
                        availableSlots: slots,
                        total: slots.length,
                        cached: false,
                    },
                    "Availability computed"
                )
            );
        }

        return res.status(200).json(
            successResponse(
                {
                    stationId: id,
                    availableSlots: availability,
                    total: availability.length,
                    cached: true,
                },
                "Cached availability fetched successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to get cached availability", {
            error: error.message,
            stationId: id,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to fetch availability", "INTERNAL_ERROR"));
    }
});
