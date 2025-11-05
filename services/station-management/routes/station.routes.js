/**
 * Station Discovery Routes
 * High-performance station discovery endpoints
 */

import express from "express";
import {
    findStations,
    healthCheck,
    findStationsNear,
    getStationDetails,
    getStationAvailability,
    getCachedAvailability,
} from "../controllers/station.controller.js";
import {
    findStationsSchema,
    healthCheckSchema,
    nearStationsSchema,
    getAvailabilitySchema,
} from "../validation/schemas/station.schema.js";
import {
    ipRateLimit,
    discoveryRateLimit,
} from "../middleware/rate-limit.middleware.js";
import { verifyToken, validate } from "@ev-platform/shared";

const router = express.Router();

/**
 * GET /stations/health
 * Health check endpoint
 * No rate limiting for monitoring
 */
router.get("/health", validate(healthCheckSchema), healthCheck);

/**
 * POST /stations/find
 * Find charging stations within vehicle range
 * Requires authentication and rate limited for expensive operations
 */
router.post(
    "/find",
    // ipRateLimit,
    // discoveryRateLimit,
    // verifyToken,
    validate(findStationsSchema),
    findStations
);

/**
 * POST /stations/near
 * Find nearby charging stations by user location
 */
router.post(
    "/nearby",
    // ipRateLimit,
    // discoveryRateLimit,
    // verifyToken,
    validate(nearStationsSchema),
    findStationsNear
);

/**
 * GET /stations/:id
 * Get station details with real-time connector status
 */
router.get(
    "/:id",
    // verifyToken,
    getStationDetails
);

/**
 * GET /stations/:id/availability
 * Get available time slots for a station
 */
router.get(
    "/:id/availability",
    verifyToken,
    validate(getAvailabilitySchema),
    getStationAvailability
);

/**
 * GET /stations/:id/availability/cached
 * Get cached availability (fast read)
 */
router.get("/:id/availability/cached", verifyToken, getCachedAvailability);

export default router;
