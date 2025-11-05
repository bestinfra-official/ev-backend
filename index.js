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
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ silent: true });

const app = express();
const PORT = process.env.PORT || GATEWAY_PORT;

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Create body parser middlewares
const jsonParser = express.json({ limit: "10mb" });
const urlencodedParser = express.urlencoded({ extended: true, limit: "10mb" });

// Skip body parsing for API routes to preserve stream for proxy
app.use((req, res, next) => {
    if (req.path && req.path.startsWith("/api/")) {
        // Skip body parsing for API routes - let proxy handle raw stream
        next();
    } else {
        jsonParser(req, res, next);
    }
});

app.use((req, res, next) => {
    if (req.path && req.path.startsWith("/api/")) {
        // Skip body parsing for API routes - let proxy handle raw stream
        next();
    } else {
        urlencodedParser(req, res, next);
    }
});

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    console.log("Content-Type:", req.headers["content-type"]);
    if (["POST", "PUT", "PATCH"].includes(req.method)) {
        if (req.body) {
            console.log("Request body:", req.body);
            console.log("Body type:", typeof req.body);
            console.log("Body keys:", Object.keys(req.body));
        } else {
            console.log("Request body: [not parsed - will be proxied]");
        }
    }
    next();
});

// Test POST route
app.post("/test", (req, res) => {
    console.log("Received POST request to /test");
    console.log("Request body:", req.body);
    res.status(200).json({
        success: true,
        message: "Test POST route successful",
        receivedData: req.body,
    });
});

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
