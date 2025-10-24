/**
 * Shared Rate Limiting Middleware
 * Provides consistent rate limiting across all services
 */

import rateLimit from "express-rate-limit";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("shared-rate-limit");

/**
 * Create a rate limiter with consistent configuration
 * @param {Object} options - Rate limiting options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message
 * @param {string} options.name - Rate limiter name for logging
 * @returns {Function} Express rate limiting middleware
 */
export function createRateLimiter({
    windowMs = 60 * 1000, // 1 minute default
    max = 100, // 100 requests default
    message = "Too many requests, please try again later",
    name = "rate-limiter",
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
}) {
    return rateLimit({
        windowMs,
        max,
        message: {
            success: false,
            error: "RATE_LIMIT_EXCEEDED",
            message,
            timestamp: new Date().toISOString(),
        },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        skipFailedRequests,
        handler: (req, res) => {
            logger.warn("Rate limit exceeded", {
                name,
                ip: req.ip,
                path: req.path,
                userAgent: req.get("user-agent"),
            });

            res.status(429).json({
                success: false,
                error: "RATE_LIMIT_EXCEEDED",
                message,
                timestamp: new Date().toISOString(),
            });
        },
    });
}

/**
 * Predefined rate limiters for common use cases
 */
export const rateLimiters = {
    // General API protection - moderate limits
    general: createRateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        message: "Too many requests, please try again later",
        name: "general-api",
    }),

    // Strict limits for expensive operations
    strict: createRateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 50, // 50 requests per minute
        message: "Too many requests for this operation, please try again later",
        name: "strict-api",
    }),

    // Very strict limits for authentication endpoints
    auth: createRateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 20, // 20 requests per minute
        message: "Too many authentication requests, please try again later",
        name: "auth-api",
    }),

    // Lenient limits for health checks and monitoring
    monitoring: createRateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 200, // 200 requests per minute
        message: "Too many monitoring requests",
        name: "monitoring-api",
    }),

    // Discovery/search endpoints - balanced limits
    discovery: createRateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 100, // 100 requests per minute
        message: "Too many discovery requests, please try again later",
        name: "discovery-api",
    }),
};

/**
 * Optional rate limiting - only applies if Redis is available
 * Falls back to no rate limiting if Redis is unavailable
 */
export function optionalRateLimit(rateLimiter) {
    return (req, res, next) => {
        // For now, always apply rate limiting
        // In the future, this could check Redis availability
        return rateLimiter(req, res, next);
    };
}
