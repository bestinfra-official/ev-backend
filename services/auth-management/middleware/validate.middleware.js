/**
 * Validation Middleware
 * Validates requests using Zod schemas
 */

import { createLogger, errorResponse } from "@ev-platform/shared";

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
                req.query = validated.query;
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
