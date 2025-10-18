/**
 * Shared Logger Configuration
 * Structured logging with Pino
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

const baseConfig = {
    level: process.env.LOG_LEVEL || "info",
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
};

// Pretty print for development
const devConfig = {
    ...baseConfig,
    transport: {
        target: "pino-pretty",
        options: {
            destination: "./logs/dev.log",
            colorize: false,
            translateTime: false,
            ignore: "pid,hostname,service",
            // messageFormat: "{msg}",
            customPrettifiers: {},
        },
    },
};

// JSON for production
const prodConfig = {
    ...baseConfig,
};

// Completely disable Pino for debugging - all logger calls become no-ops
const defaultLogger = pino(isProduction ? prodConfig : devConfig);

/**
 * Create a child logger with service context
 */
export const createLogger = (serviceName) => {
    return defaultLogger.child({
        service: serviceName || process.env.SERVICE_NAME || "unknown",
    });
};

/**
 * Export default logger
 */
export default defaultLogger;
