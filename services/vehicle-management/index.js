/**
 * Vehicle Management Service
 * Main application entry point for the vehicle management microservice
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import {
    createLogger,
    database,
    redis,
    errorHandler,
    notFoundHandler,
} from "@ev-platform/shared";
import vehicleRoutes from "./routes/index.js";

dotenv.config({ silent: true });

const app = express();
const PORT = parseInt(process.env.PORT || "7101");
const SERVICE_NAME = "vehicle-management";
const logger = createLogger(SERVICE_NAME);

// Middleware
app.use(
    helmet({
        contentSecurityPolicy: false, // Disable CSP for development
    })
);

// CORS configuration for development
app.use(
    cors({
        origin: true, // Allow all origins in development
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Version"],
    })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Log incoming requests for debugging
app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
        logger.info(`Incoming ${req.method} ${req.path}`, {
            contentType: req.headers["content-type"],
            contentLength: req.headers["content-length"],
            bodyKeys: req.body ? Object.keys(req.body).length : 0,
        });
    }
    next();
});

// API Routes - V1 (Stable)
app.use("/v1", vehicleRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Connect to database
        await database.connect();
        logger.info("Database connected");

        // Redis is now initialized at the root level
        await redis.connect();
        logger.info("Using shared Redis connection");

        app.listen(PORT, () => {
            logger.info(`${SERVICE_NAME} service running on port ${PORT}`);
            logger.info("Vehicle management service ready", {
                port: PORT,
                environment: process.env.NODE_ENV || "development",
            });
        });
    } catch (error) {
        logger.error("Failed to start server", {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    logger.info("Shutting down gracefully...");

    // Disconnect from database
    await database.disconnect();

    await redis.disconnect();

    logger.info("Shutdown complete");
    process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the server
startServer();
