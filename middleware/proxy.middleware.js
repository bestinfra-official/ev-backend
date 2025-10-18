/**
 * Proxy Middleware Configuration
 * Sets up proxy middleware for routing requests to microservices
 * Supports dynamic versioning from URL and headers
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import { DEFAULT_VERSION } from "../config/versions.config.js";

/**
 * Creates dynamic proxy middleware that handles versioning
 * Extracts version from request and forwards to appropriate service endpoint
 * @param {string} pathPattern - The API path pattern (e.g., /api/:version/auth)
 * @param {string} target - The target service URL
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
export const createVersionedProxyMiddleware = (
    pathPattern,
    target,
    options = {}
) => {
    const { serviceName = "unknown" } = options;

    return createProxyMiddleware({
        target,
        changeOrigin: true,
        logLevel: "silent",
        // Ensure body parsing is handled properly
        onProxyReq: (proxyReq, req, res) => {
            const version = req.apiVersion || DEFAULT_VERSION;
            const versionInfo = req.versionInfo || {};

            // Forward version information to service
            proxyReq.setHeader("X-API-Version", version);
            proxyReq.setHeader(
                "X-API-Version-Status",
                versionInfo.status || "unknown"
            );
            proxyReq.setHeader("X-Service-Name", serviceName);

            // Forward original request info
            proxyReq.setHeader("X-Forwarded-For", req.ip);
            proxyReq.setHeader("X-Forwarded-Host", req.hostname);
            proxyReq.setHeader("X-Forwarded-Proto", req.protocol);

            // Handle body for POST requests
            if (
                req.method === "POST" &&
                req.body &&
                Object.keys(req.body).length > 0
            ) {
                const bodyData = JSON.stringify(req.body);
                proxyReq.setHeader("Content-Type", "application/json");
                proxyReq.setHeader(
                    "Content-Length",
                    Buffer.byteLength(bodyData)
                );

                console.log(
                    `📤 [Proxy] Writing body for ${req.method} ${req.path}:`,
                    req.body
                );
                proxyReq.write(bodyData);
                proxyReq.end();
            } else {
                console.log(
                    `📤 [Proxy] No body to forward for ${req.method} ${req.path}`
                );
            }
        },

        // Dynamic path rewriting based on detected version
        pathRewrite: (path, req) => {
            // Get version from request (set by version middleware)
            const version = req.apiVersion || DEFAULT_VERSION;

            // Extract the service path after the version and service segment
            // e.g., /api/v1/auth/otp/status/1 -> /otp/status/1
            const versionPattern = /\/api\/v\d+\/[^/]+/;
            const servicePath = path.replace(versionPattern, "");

            // Rewrite to service's versioned endpoint
            // e.g., /api/v1/auth/otp/status/1 -> /v1/otp/status/1
            const newPath = `/${version}${servicePath}`;

            return newPath;
        },

        onProxyRes: (proxyRes, req, res) => {
            // Add gateway info to response
            proxyRes.headers["X-Gateway"] = "EV-Platform";
            proxyRes.headers["X-Service"] = serviceName;
        },

        onError: (err, req, res) => {
            console.error(`❌ [Proxy Error] ${serviceName}:`, err.message, {
                path: req.path,
                method: req.method,
                target,
                bodyExists: !!req.body,
                contentType: req.get("content-type"),
                bodyType: typeof req.body,
                errorCode: err.code,
                errorStack: err.stack,
            });

            res.status(503).json({
                success: false,
                error: "Service unavailable",
                message: `Unable to reach ${serviceName} service`,
                service: serviceName,
                version: req.apiVersion || DEFAULT_VERSION,
                hint: "Make sure the microservice is running",
                timestamp: new Date().toISOString(),
            });
        },
    });
};

/**
 * Creates proxy middleware for legacy routes with deprecation warnings
 * @param {string} path - The API path to proxy
 * @param {string} target - The target service URL
 * @returns {Function} Express middleware
 */
export const createLegacyProxyMiddleware = (path, target) => {
    return createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { [`^${path}`]: "/v1" },
        logLevel: "silent",
        onProxyReq: (proxyReq, req, res) => {
            // Add deprecation warning headers
            proxyReq.setHeader("X-API-Version", "v1");
            proxyReq.setHeader("X-API-Deprecated", "true");
            proxyReq.setHeader(
                "X-API-Deprecated-Message",
                "Please use /api/v1/* endpoints"
            );
        },
        onProxyRes: (proxyRes, req, res) => {
            // Add deprecation headers to response
            proxyRes.headers["X-API-Deprecated"] = "true";
            proxyRes.headers["X-API-Deprecated-Message"] =
                "This endpoint is deprecated. Please use /api/v1/* endpoints";
        },
        onError: (err, req, res) => {
            res.status(503).json({
                success: false,
                message: "Service unavailable",
                service: path,
                deprecated: true,
                hint: "Use /api/v1/* endpoints instead",
            });
        },
    });
};

/**
 * Sets up all proxy routes on the Express app with versioning support
 * @param {Express} app - Express application instance
 * @param {Array} routes - Array of route configurations
 * @param {Array} legacyRoutes - Array of legacy route configurations (optional)
 */
export const setupProxyRoutes = (app, routes, legacyRoutes = []) => {
    console.log("\n📍 Setting up proxy routes...");

    // Setup versioned API routes
    routes.forEach(
        ({ segment, target, serviceName, supportedVersions = [] }) => {
            if (!target) {
                console.warn(
                    `⚠️  Skipping route ${segment} - no target defined`
                );
                return;
            }

            // Build the route pattern: /api/:version/{segment}
            // This matches: /api/v1/auth, /api/v2/auth, /api/v3/auth, etc.
            const basePattern = `/api/:version/${segment}`;

            console.log(`  ✓ ${basePattern} -> ${target} [${serviceName}]`);
            console.log(`     Versions: ${supportedVersions.join(", ")}`);

            app.use(
                basePattern,
                createVersionedProxyMiddleware(basePattern, target, {
                    serviceName,
                    supportedVersions,
                })
            );
        }
    );

    // Setup legacy routes (redirect to v1 for backward compatibility)
    if (legacyRoutes.length > 0) {
        console.log("\n📍 Setting up legacy routes...");
        legacyRoutes.forEach(({ path, target, serviceName }) => {
            if (!target) {
                console.warn(
                    `⚠️  Skipping legacy route ${path} - no target defined`
                );
                return;
            }
            console.log(`  ⚠️  ${path} -> ${target} [DEPRECATED]`);
            app.use(path, createLegacyProxyMiddleware(path, target));
        });
    }

    console.log("\n✅ Proxy routes configured\n");
};
