/**
 * Shared Custom Error Classes
 * Consistent error handling across services
 */

/**
 * Base API Error
 */
export class ApiError extends Error {
    constructor(message, statusCode = 500, errorCode = "INTERNAL_ERROR") {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends ApiError {
    constructor(message = "Bad request") {
        super(message, 400, "BAD_REQUEST");
    }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends ApiError {
    constructor(message = "Unauthorized") {
        super(message, 401, "UNAUTHORIZED");
    }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends ApiError {
    constructor(message = "Forbidden") {
        super(message, 403, "FORBIDDEN");
    }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends ApiError {
    constructor(message = "Resource not found") {
        super(message, 404, "NOT_FOUND");
    }
}

/**
 * 409 Conflict
 */
export class ConflictError extends ApiError {
    constructor(message = "Resource conflict") {
        super(message, 409, "CONFLICT");
    }
}

/**
 * 422 Validation Error
 */
export class ValidationError extends ApiError {
    constructor(message = "Validation failed", errors = []) {
        super(message, 422, "VALIDATION_ERROR");
        this.errors = errors;
    }
}

/**
 * 500 Internal Server Error
 */
export class InternalServerError extends ApiError {
    constructor(message = "Internal server error") {
        super(message, 500, "INTERNAL_ERROR");
    }
}

/**
 * 503 Service Unavailable
 */
export class ServiceUnavailableError extends ApiError {
    constructor(message = "Service unavailable") {
        super(message, 503, "SERVICE_UNAVAILABLE");
    }
}
