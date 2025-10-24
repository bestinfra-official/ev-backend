/**
 * Enhanced Logger Configuration
 * Beautiful, readable logging with Pino
 */

import pino from "pino";
import path from "path";
import fs from "fs";

// Set default environment variables if not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = "development";
}
if (!process.env.LOG_LEVEL) {
    process.env.LOG_LEVEL = "debug";
}

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const isProduction = process.env.NODE_ENV === "production";

const baseConfig = {
    level: process.env.LOG_LEVEL || "debug",
    timestamp: pino.stdTimeFunctions.isoTime,
};

// Development configuration with pretty printing
const devConfig = {
    ...baseConfig,
    transport: {
        targets: [
            {
                target: "pino-pretty",
                level: "debug",
                options: {
                    destination: path.join(process.cwd(), "logs", "dev.log"),
                    colorize: false,
                    translateTime: "yyyy-mm-dd HH:MM:ss",
                    ignore: "pid,hostname",
                    messageFormat: "[{service}] {msg}",
                },
            },
            {
                target: "pino-pretty",
                level: "debug",
                options: {
                    colorize: true,
                    translateTime: "yyyy-mm-dd HH:MM:ss",
                    ignore: "pid,hostname",
                    messageFormat: "[{service}] {msg}",
                },
            },
        ],
    },
};

// Production configuration - structured JSON
const prodConfig = {
    ...baseConfig,
    level: "info",
    formatters: {
        level: (label) => {
            return { level: label };
        },
        log: (object) => {
            // Add request correlation ID if available
            if (object.req && object.req.id) {
                object.requestId = object.req.id;
            }
            return object;
        },
    },
    redact: {
        paths: [
            "password",
            "token",
            "authorization",
            "cookie",
            "req.headers.authorization",
        ],
        censor: "[REDACTED]",
    },
};

const defaultLogger = pino(isProduction ? prodConfig : devConfig);

/**
 * Create a child logger with service context and enhanced formatting
 */
export const createLogger = (serviceName) => {
    const childLogger = defaultLogger.child({
        service: serviceName || process.env.SERVICE_NAME || "unknown",
    });

    // Create a proxy to intercept method calls
    return new Proxy(childLogger, {
        get(target, prop) {
            // If it's one of our custom methods, return it
            if (
                prop === "error" ||
                prop === "request" ||
                prop === "response" ||
                prop === "db" ||
                prop === "cache" ||
                prop === "performance"
            ) {
                return getCustomMethod(prop, childLogger);
            }
            // Otherwise return the original method
            return target[prop];
        },
    });
};

// Helper function to get custom methods
function getCustomMethod(methodName, childLogger) {
    switch (methodName) {
        case "error":
            return (obj, msg) => {
                if (typeof obj === "string") {
                    childLogger.error({ message: obj }, msg);
                } else {
                    const errorObj = {
                        ...obj,
                        timestamp: new Date().toISOString(),
                    };

                    // Format stack trace for better readability
                    if (obj.error && obj.error.stack) {
                        errorObj.stack = obj.error.stack
                            .split("\n")
                            .slice(0, 5)
                            .join("\n");
                    }

                    childLogger.error(errorObj, msg);
                }
            };

        case "request":
            return (req, msg = "Request received") => {
                childLogger.info(
                    {
                        method: req.method,
                        url: req.url,
                        userAgent: req.get("User-Agent"),
                        ip: req.ip || req.connection.remoteAddress,
                        requestId: req.id || req.headers["x-request-id"],
                    },
                    msg
                );
            };

        case "response":
            return (req, res, duration, msg = "Request completed") => {
                childLogger.info(
                    {
                        method: req.method,
                        url: req.url,
                        statusCode: res.statusCode,
                        duration: `${duration}ms`,
                        requestId: req.id || req.headers["x-request-id"],
                    },
                    msg
                );
            };

        case "db":
            return (operation, table, duration, msg) => {
                childLogger.debug(
                    {
                        operation,
                        table,
                        duration: `${duration}ms`,
                    },
                    msg
                );
            };

        case "cache":
            return (operation, key, hit, duration, msg) => {
                childLogger.debug(
                    {
                        operation,
                        key,
                        hit,
                        duration: `${duration}ms`,
                    },
                    msg
                );
            };

        case "performance":
            return (operation, duration, metadata = {}) => {
                childLogger.info(
                    {
                        operation,
                        duration: `${duration}ms`,
                        ...metadata,
                    },
                    `Performance: ${operation}`
                );
            };

        default:
            return childLogger[methodName];
    }
}

/**
 * Export default logger
 */
export default defaultLogger;
