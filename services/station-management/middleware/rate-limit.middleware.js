/**
 * Rate Limiting Middleware for Station Discovery
 * Uses shared rate limiting utilities for consistency
 */

import { createLogger, rateLimiters } from "@ev-platform/shared";

const logger = createLogger("station-rate-limit-middleware");

/**
 * IP-based rate limiting middleware for general API protection
 * Uses shared rate limiting utilities
 */
export function ipRateLimit(req, res, next) {
    return rateLimiters.general(req, res, next);
}

/**
 * Discovery-specific rate limiting middleware
 * Stricter limits for expensive station discovery operations
 */
export function discoveryRateLimit(req, res, next) {
    return rateLimiters.discovery(req, res, next);
}

/**
 * Strict rate limiting for high-cost operations
 */
export function strictRateLimit(req, res, next) {
    return rateLimiters.strict(req, res, next);
}
