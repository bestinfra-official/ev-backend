/**
 * Proxy Routes Configuration
 * Defines all API route mappings for the gateway with version support
 */

import { SERVICE_URLS } from "./services.config.js";
import { SERVICE_VERSION_SUPPORT } from "./versions.config.js";

/**
 * Versioned API Routes
 * These routes support dynamic versioning (v1, v2, etc.)
 * The gateway will detect the version from URL or headers
 * and route to the appropriate service endpoint
 *
 * Note: The 'segment' field defines the service path (e.g., 'auth', 'vehicles')
 * The actual route pattern will be: /api/:version/{segment}
 * This matches: /api/v1/auth, /api/v2/auth, /api/v3/auth, etc.
 */
export const versionedRoutes = [
    {
        segment: "auth",
        target: SERVICE_URLS.AUTH_MANAGEMENT,
        serviceName: "auth-management",
        supportedVersions: SERVICE_VERSION_SUPPORT["auth-management"],
    },
    {
        segment: "vehicles",
        target: SERVICE_URLS.VEHICLE_MANAGEMENT,
        serviceName: "vehicle-management",
        supportedVersions: SERVICE_VERSION_SUPPORT["vehicle-management"],
    },
    {
        segment: "stations",
        target: SERVICE_URLS.STATION_DISCOVERY,
        serviceName: "station-management",
        supportedVersions: SERVICE_VERSION_SUPPORT["station-management"],
    },
    {
        segment: "payments",
        target: SERVICE_URLS.PAYMENT_WALLET,
        serviceName: "payment-wallet",
        supportedVersions: SERVICE_VERSION_SUPPORT["payment-wallet"],
    },
    {
        segment: "notifications",
        target: SERVICE_URLS.NOTIFICATION_ALERTS,
        serviceName: "notification-alerts",
        supportedVersions: SERVICE_VERSION_SUPPORT["notification-alerts"],
    },
];

/**
 * Legacy routes (for backward compatibility)
 * These routes are deprecated and will be removed in future versions
 * They redirect to v1 endpoints with deprecation warnings
 */
export const legacyRoutes = [
    {
        path: "/api/auth",
        target: SERVICE_URLS.AUTH_MANAGEMENT,
        serviceName: "auth-management",
    },
    {
        path: "/api/vehicles",
        target: SERVICE_URLS.VEHICLE_MANAGEMENT,
        serviceName: "vehicle-management",
    },
    {
        path: "/api/stations",
        target: SERVICE_URLS.STATION_DISCOVERY,
        serviceName: "station-management",
    },
    {
        path: "/api/payments",
        target: SERVICE_URLS.PAYMENT_WALLET,
        serviceName: "payment-wallet",
    },
    {
        path: "/api/notifications",
        target: SERVICE_URLS.NOTIFICATION_ALERTS,
        serviceName: "notification-alerts",
    },
];

// Backward compatibility aliases
export const proxyRoutesV1 = versionedRoutes;
