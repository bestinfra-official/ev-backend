/**
 * Shared Response Formatters
 * Standardized API responses across all services
 */

/**
 * Success response
 */
export const successResponse = (data = null, message = "Success") => {
    return {
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    };
};

/**
 * Paginated response
 */
export const paginatedResponse = (data, pagination) => {
    return {
        success: true,
        data,
        pagination: {
            page: pagination.page || 1,
            limit: pagination.limit || 10,
            total: pagination.total || 0,
            totalPages: Math.ceil(
                (pagination.total || 0) / (pagination.limit || 10)
            ),
        },
        timestamp: new Date().toISOString(),
    };
};

/**
 * Error response
 */
export const errorResponse = (
    error,
    message = "An error occurred",
    statusCode = 500
) => {
    return {
        success: false,
        error: error || "INTERNAL_ERROR",
        message,
        statusCode,
        timestamp: new Date().toISOString(),
    };
};

/**
 * Validation error response
 */
export const validationErrorResponse = (errors) => {
    return {
        success: false,
        error: "VALIDATION_ERROR",
        message: "Validation failed",
        errors,
        timestamp: new Date().toISOString(),
    };
};

/**
 * Not found response
 */
export const notFoundResponse = (resource = "Resource") => {
    return {
        success: false,
        error: "NOT_FOUND",
        message: `${resource} not found`,
        timestamp: new Date().toISOString(),
    };
};
