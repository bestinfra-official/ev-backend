/**
 * Shared Module Exports
 * Infrastructure code shared across all microservices
 */

// Config
export { default as database } from "./config/database.js";
export { default as redis } from "./config/redis.js";

// Middleware
export { verifyToken, optionalAuth, requireRole } from "./middleware/auth.js";
export {
    errorHandler,
    notFoundHandler,
    asyncHandler,
} from "./middleware/errorHandler.js";
export {
    createRateLimiter,
    rateLimiters,
    optionalRateLimit,
} from "./middleware/rateLimit.js";
export { validate } from "./middleware/validate.js";

// Utils
export { default as logger, createLogger } from "./utils/logger.js";
export {
    successResponse,
    paginatedResponse,
    errorResponse,
    validationErrorResponse,
    notFoundResponse,
} from "./utils/response.js";
export {
    ApiError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ValidationError,
    InternalServerError,
    ServiceUnavailableError,
} from "./utils/errors.js";
