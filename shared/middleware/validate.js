/**
 * Validation Middleware
 * Validates requests using Zod schemas
 * Shared across all microservices
 */

import { createLogger } from "../utils/logger.js";
import { errorResponse } from "../utils/response.js";

const logger = createLogger("validation-middleware");

/**
 * Validate request against Zod schema
 * @param {object} schema - Zod schema object with body/params/query
 * @returns {Function} Express middleware
 */
export function validate(schema) {
    return async (req, res, next) => {
        try {
            // Build validation object
            const toValidate = {};

            if (schema.shape.body) {
                toValidate.body = req.body;
            }

            if (schema.shape.params) {
                toValidate.params = req.params;
            }

            if (schema.shape.query) {
                toValidate.query = req.query;
            }

            // Validate
            const validated = await schema.parseAsync(toValidate);

            // Replace request data with validated (and transformed) data
            if (validated.body) {
                req.body = validated.body;
            }

            if (validated.params) {
                req.params = validated.params;
            }

            if (validated.query) {
                logger.info("Validated query params", {
                    before: req.query,
                    after: validated.query,
                });

                // Merge validated query params into req.query instead of replacing
                // req.query is read-only, so we need to set each property individually
                Object.keys(validated.query).forEach((key) => {
                    try {
                        // Use Object.defineProperty to force the update on read-only properties
                        Object.defineProperty(req.query, key, {
                            value: validated.query[key],
                            writable: true,
                            enumerable: true,
                            configurable: true,
                        });
                    } catch (e) {
                        // If that fails, try direct assignment as fallback
                        req.query[key] = validated.query[key];
                    }
                });

                logger.info("Merged query params", {
                    result: req.query,
                });
            }

            next();
        } catch (error) {
            if (error.name === "ZodError") {
                logger.warn(error, "Validation failed");

                // Handle cases where error.errors might be undefined
                const validationErrors =
                    error.errors && Array.isArray(error.errors)
                        ? error.errors.map((err) => ({
                              field: err.path ? err.path.join(".") : "unknown",
                              message: err.message || "Validation error",
                              code: err.code || "invalid_type",
                          }))
                        : [
                              {
                                  field: "unknown",
                                  message: error.message || "Validation failed",
                                  code: "validation_error",
                              },
                          ];

                logger.warn("Validation failed", {
                    errors: validationErrors,
                    path: req.path,
                    originalError: error.errors
                        ? "has errors array"
                        : "no errors array",
                });

                return res.status(400).json(
                    errorResponse("Validation failed", "VALIDATION_ERROR", {
                        errors: validationErrors,
                    })
                );
            }

            // Unexpected error
            logger.error("Validation middleware error", {
                error: error.message,
                stack: error.stack,
            });

            return res
                .status(500)
                .json(
                    errorResponse("Internal validation error", "INTERNAL_ERROR")
                );
        }
    };
}

export default validate;
