/**
 * Advanced Rate Limiting Middleware
 * Redis-based rate limiting using rate-limiter-flexible
 * Protects against abuse at API level (separate from OTP-specific rate limits)
 */

import { RateLimiterRedis } from "rate-limiter-flexible";
import { createLogger, redis, errorResponse } from "@ev-platform/shared";

const logger = createLogger("rate-limit-middleware");

// Rate limiter instances (lazy initialized)
let ipRateLimiter = null;
let phoneRateLimiter = null;

/**
 * Initialize rate limiters
 */
function initializeRateLimiters() {
    if (ipRateLimiter && phoneRateLimiter) {
        return;
    }

    const redisClient = redis.getClient();

    // IP-based rate limiter (general API protection)
    ipRateLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: "rl:ip",
        points: parseInt(process.env.RATE_LIMIT_IP_POINTS || "100"), // Number of requests
        duration: parseInt(process.env.RATE_LIMIT_IP_DURATION || "60"), // Per 60 seconds
        blockDuration: parseInt(
            process.env.RATE_LIMIT_IP_BLOCK_DURATION || "300"
        ), // Block for 5 minutes
    });

    // Phone-based rate limiter (OTP endpoint specific)
    phoneRateLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: "rl:phone",
        points: parseInt(process.env.RATE_LIMIT_PHONE_POINTS || "5"), // Number of requests
        duration: parseInt(process.env.RATE_LIMIT_PHONE_DURATION || "60"), // Per 60 seconds
        blockDuration: parseInt(
            process.env.RATE_LIMIT_PHONE_BLOCK_DURATION || "600"
        ), // Block for 10 minutes
    });

    logger.info("Rate limiters initialized");
}

/**
 * IP-based rate limiting middleware
 * Limits requests per IP address
 */
export function ipRateLimit(req, res, next) {
    try {
        initializeRateLimiters();

        const ip = req.ip || req.connection.remoteAddress || "unknown";
        const key = ip.replace(/[^a-zA-Z0-9]/g, "_"); // Sanitize key

        ipRateLimiter
            .consume(key)
            .then(() => {
                // Success - allow request
                next();
            })
            .catch((rejRes) => {
                // Rate limit exceeded
                const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000);

                logger.warn("IP rate limit exceeded", {
                    ip,
                    retryAfter,
                    path: req.path,
                });

                res.set("Retry-After", String(retryAfter));

                return res
                    .status(429)
                    .json(
                        errorResponse(
                            `Too many requests. Please try again in ${retryAfter} seconds.`,
                            "RATE_LIMIT_EXCEEDED",
                            { retryAfter }
                        )
                    );
            });
    } catch (error) {
        logger.error("IP rate limiter error", {
            error: error.message,
            ip: req.ip,
        });

        // Fail open - allow request if rate limiter fails
        next();
    }
}

/**
 * Phone-based rate limiting middleware
 * Limits OTP requests per phone number
 * Extracts phone from request body
 */
export function phoneRateLimit(req, res, next) {
    try {
        initializeRateLimiters();

        const phone = req.body?.phone;

        if (!phone) {
            // No phone in request, skip rate limiting
            return next();
        }

        // Sanitize phone number for use as key
        const key = phone.replace(/[^0-9]/g, "");

        phoneRateLimiter
            .consume(key)
            .then(() => {
                // Success - allow request
                next();
            })
            .catch((rejRes) => {
                // Rate limit exceeded
                const retryAfter = Math.ceil(rejRes.msBeforeNext / 1000);

                logger.warn("Phone rate limit exceeded", {
                    phone: `***${key.slice(-4)}`, // Log only last 4 digits
                    retryAfter,
                    path: req.path,
                });

                res.set("Retry-After", String(retryAfter));

                return res
                    .status(429)
                    .json(
                        errorResponse(
                            `Too many OTP requests for this number. Please try again in ${Math.ceil(
                                retryAfter / 60
                            )} minutes.`,
                            "PHONE_RATE_LIMIT_EXCEEDED",
                            { retryAfter }
                        )
                    );
            });
    } catch (error) {
        logger.error("Phone rate limiter error", {
            error: error.message,
        });

        // Fail open - allow request if rate limiter fails
        next();
    }
}
