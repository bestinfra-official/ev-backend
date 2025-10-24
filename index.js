/**
 * EV Platform - API Gateway
 * Proxies requests to independent microservices with version management
 */

// Suppress DEP0060 warning from http-proxy-middleware dependency
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, type, code) => {
    if (code === "DEP0060") return;
    return originalEmitWarning.call(process, warning, type, code);
};

import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./docs/swagger.config.js";
import { versionedRoutes, legacyRoutes } from "./config/routes.config.js";
import { setupProxyRoutes } from "./middleware/proxy.middleware.js";
import {
    versionDetectionMiddleware,
    serviceVersionValidationMiddleware,
} from "./middleware/version.middleware.js";
import { getAllVersions, DEFAULT_VERSION } from "./config/versions.config.js";
import { GATEWAY_PORT } from "./config/services.config.js";
import { redis } from "./shared/index.js";

dotenv.config({ silent: true });

const app = express();
const PORT = process.env.PORT || GATEWAY_PORT;

// Middleware
app.use(
    helmet({
        contentSecurityPolicy: false, // Disable CSP for Swagger UI
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

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    console.log("Headers:", req.headers);
    next();
});

// CORS middleware handles preflight OPTIONS requests automatically

// Swagger Documentation
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "EV Charging Platform API Documentation",
        customfavIcon: "/favicon.ico",
    })
);

// API Version info endpoint
app.get("/api/versions", (req, res) => {
    const versions = getAllVersions();
    res.json({
        success: true,
        data: {
            versions,
            default: DEFAULT_VERSION,
            documentation: {
                usage: "Include version in URL (e.g., /api/v1/...) or use X-API-Version header",
                example: {
                    url: `GET http://localhost:${PORT}/api/v1/auth/health`,
                    header: "X-API-Version: v1",
                },
                swagger: "API documentation available at /api-docs",
            },
        },
    });
});

// Test endpoint for CORS
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "CORS test successful",
        timestamp: new Date().toISOString(),
    });
});

// Apply version detection and validation for all API routes
// Using a regex pattern to match /api/v1, /api/v2, etc. followed by any path
app.use(/^\/api\/v\d+\/.*/, versionDetectionMiddleware);
app.use(/^\/api\/v\d+\/.*/, serviceVersionValidationMiddleware);

// Setup proxy routes for microservices
setupProxyRoutes(app, versionedRoutes, legacyRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
    });
});

// Initialize Redis connection
async function initializeRedis() {
    try {
        await redis.connect();
        console.log("Redis connected successfully");
    } catch (error) {
        console.error("Failed to connect to Redis:", error.message);
        process.exit(1);
    }
}

// Start server
async function startServer() {
    // Initialize Redis first
    await initializeRedis();

    app.listen(PORT, () => {
        console.log(`API Gateway running on http://localhost:${PORT}`);
    });
}

startServer();

// Graceful shutdown
const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down...`);
    try {
        await redis.disconnect();
        console.log("Redis disconnected");
    } catch (error) {
        console.error("Error disconnecting Redis:", error.message);
    }
    process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
