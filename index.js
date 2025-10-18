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
import { versionedRoutes, legacyRoutes } from "./config/routes.config.js";
import { setupProxyRoutes } from "./middleware/proxy.middleware.js";
import {
    versionDetectionMiddleware,
    serviceVersionValidationMiddleware,
} from "./middleware/version.middleware.js";
import { getAllVersions, DEFAULT_VERSION } from "./config/versions.config.js";
import { GATEWAY_PORT } from "./config/ports.config.js";

dotenv.config({ silent: true });

const app = express();
const PORT = process.env.PORT || GATEWAY_PORT;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});

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
                    url: "GET /api/v1/auth/health",
                    header: "X-API-Version: v1",
                },
            },
        },
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

// Start server
app.listen(PORT, () => {
    console.log(`API Gateway running on http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
