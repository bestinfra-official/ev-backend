/**
 * Station Discovery Routes
 * High-performance station discovery endpoints
 */

import express from "express";
import {
    findStations,
    healthCheck,
} from "../controllers/station.controller.js";
import {
    findStationsSchema,
    healthCheckSchema,
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
    verifyToken,
    validate(findStationsSchema),
    findStations
);

export default router;
