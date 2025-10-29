/**
 * Proxy Middleware for API Gateway
 * Routes requests to appropriate microservices based on configuration
 */

import { createProxyMiddleware } from "http-proxy-middleware";
import { createLogger } from "@ev-platform/shared";
import { isServiceEnabled } from "../config/services.config.js";

const logger = createLogger("proxy-middleware");

/**
 * Setup proxy routes for all versioned and legacy routes
 * @param {Object} app - Express application instance
 * @param {Array} versionedRoutes - Routes with version support
 * @param {Array} legacyRoutes - Legacy routes for backward compatibility
 */
export function setupProxyRoutes(app, versionedRoutes, legacyRoutes) {
    // Build route map for fast lookup
    const enabledRoutes = versionedRoutes.filter((route) =>
        isServiceEnabled(route.serviceName)
    );
    const enabledLegacyRoutes = legacyRoutes.filter((route) =>
        isServiceEnabled(route.serviceName)
    );

    logger.info(
        `Setting up ${enabledRoutes.length} versioned routes and ${enabledLegacyRoutes.length} legacy routes`
    );

    // Create a unified proxy middleware that handles all routes
    const proxy = createProxyMiddleware({
        changeOrigin: true,
        filter: function (pathname, req) {
            // Match both versioned and legacy routes
            return pathname.startsWith("/api/");
        },
        router: function (req) {
            // Determine target based on path
            const pathname = req.path;

            // Try versioned routes first
            const vMatch = pathname.match(/^\/api\/v\d+\/([^/]+)/);
            if (vMatch) {
                const segment = vMatch[1];
                const route = enabledRoutes.find((r) => r.segment === segment);
                if (route) {
                    req.proxyTarget = route.target;
                    req.proxyServiceName = route.serviceName;
                    return route.target;
                }
            }

            // Try legacy routes
            for (const route of enabledLegacyRoutes) {
                if (
                    pathname === route.path ||
                    pathname.startsWith(`${route.path}/`)
                ) {
                    req.proxyTarget = route.target;
                    req.proxyServiceName = route.serviceName;
                    req.isLegacy = true;
                    return route.target;
                }
            }

            return false; // No matching route
        },
        pathRewrite: function (path, req) {
            const pathname = req.originalUrl || req.path;

            // Versioned routes: /api/v1/stations/test -> /v1/test
            const vMatch = pathname.match(
                /^\/api\/(v\d+)\/([^/]+)(?:\/(.*))?$/
            );
            if (vMatch) {
                const version = vMatch[1];
                const rest = vMatch[3] || "";
                const rewritten = rest ? `/${version}/${rest}` : `/${version}`;

                logger.info(`Rewriting path: ${pathname} -> ${rewritten}`);
                return rewritten;
            }

            // Legacy routes: /api/stations/test -> /v1/stations/test
            const lMatch = pathname.match(/^\/api\/([^/]+)(?:\/(.*))?$/);
            if (lMatch) {
                const rest = lMatch[2] || "";
                const rewritten = rest ? `/v1/${rest}` : "/v1";

                logger.info(
                    `Rewriting legacy path: ${pathname} -> ${rewritten}`
                );
                return rewritten;
            }

            return path; // Fallback
        },
        on: {
            proxyReq: async (proxyReq, req, res) => {
                const target = req.proxyTarget || "unknown";
                const serviceName = req.proxyServiceName || "unknown";
                logger.info(
                    `Proxying ${req.method} ${req.originalUrl} to ${target} (${serviceName})`
                );

                // Note: http-proxy-middleware will handle body forwarding automatically
                // We don't need to manually write the body here
            },
            proxyRes: (proxyRes, req, res) => {
                logger.info(
                    `Proxied ${req.method} ${req.originalUrl} - Status: ${proxyRes.statusCode}`
                );

                // Add deprecation headers for legacy routes
                if (req.isLegacy) {
                    res.setHeader("X-API-Deprecated", "true");
                    res.setHeader(
                        "X-API-Deprecation-Message",
                        "Legacy endpoint is deprecated. Please use versioned endpoint."
                    );
                }
            },
            error: (err, req, res) => {
                logger.error(
                    `Proxy error for ${req.originalUrl}:`,
                    err.message
                );
                res.status(502).json({
                    success: false,
                    error: "Bad Gateway",
                    message: `Failed to proxy request to ${
                        req.proxyServiceName || "unknown"
                    } service`,
                    service: req.proxyServiceName || "unknown",
                });
            },
        },
    });

    // Apply the unified proxy middleware
    app.use(proxy);

    // Log configured routes
    enabledRoutes.forEach((route) => {
        logger.info(
            `Proxy route configured: /api/vX/${route.segment}/* -> ${route.target} (${route.serviceName})`
        );
    });
    enabledLegacyRoutes.forEach((route) => {
        logger.info(
            `Legacy proxy route configured: ${route.path} -> ${route.target} (${route.serviceName})`
        );
    });

    logger.info("All proxy routes configured successfully");
}
