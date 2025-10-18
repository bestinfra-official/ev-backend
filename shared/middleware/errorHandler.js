/**
 * Shared Error Handler Middleware
 * Centralized error handling for all services
 */

import { createLogger } from "../utils/logger.js";
import { ApiError } from "../utils/errors.js";

const logger = createLogger("error-handler");

/**
 * Global error handler
 */
export const errorHandler = (err, req, res, next) => {
    // Log the error
    logger.error("Error occurred", {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        statusCode: err.statusCode || 500,
    });

    // Handle known API errors
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.errorCode,
            message: err.message,
            ...(err.errors && { errors: err.errors }),
            timestamp: new Date().toISOString(),
        });
    }

    // Handle JWT errors
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            success: false,
            error: "INVALID_TOKEN",
            message: "Invalid authentication token",
            timestamp: new Date().toISOString(),
        });
    }

    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            success: false,
            error: "TOKEN_EXPIRED",
            message: "Authentication token has expired",
            timestamp: new Date().toISOString(),
        });
    }

    // Handle validation errors (Joi, Zod, etc.)
    if (err.name === "ValidationError") {
        return res.status(422).json({
            success: false,
            error: "VALIDATION_ERROR",
            message: "Validation failed",
            errors: err.details || err.errors,
            timestamp: new Date().toISOString(),
        });
    }

    // Handle database errors
    if (err.code && err.code.startsWith("23")) {
        // PostgreSQL error codes
        let message = "Database error";

        if (err.code === "23505") {
            message = "Resource already exists";
        } else if (err.code === "23503") {
            message = "Referenced resource not found";
        }

        return res.status(409).json({
            success: false,
            error: "DATABASE_ERROR",
            message,
            timestamp: new Date().toISOString(),
        });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    const message =
        process.env.NODE_ENV === "production"
            ? "Internal server error"
            : err.message;

    res.status(statusCode).json({
        success: false,
        error: "INTERNAL_ERROR",
        message,
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
        timestamp: new Date().toISOString(),
    });
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: "Route not found",
        path: req.path,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Async handler wrapper
 * Catches async errors and passes to error middleware
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
