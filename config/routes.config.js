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
        segment: "bluetooth",
        target: SERVICE_URLS.BLUETOOTH_PAIRING,
        serviceName: "bluetooth-pairing",
        supportedVersions: SERVICE_VERSION_SUPPORT["bluetooth-pairing"],
    },
    {
        segment: "stations",
        target: SERVICE_URLS.STATION_DISCOVERY,
        serviceName: "station-discovery",
        supportedVersions: SERVICE_VERSION_SUPPORT["station-discovery"],
    },
    {
        segment: "station-management",
        target: SERVICE_URLS.STATION_MANAGEMENT,
        serviceName: "station-management",
        supportedVersions: SERVICE_VERSION_SUPPORT["station-management"],
    },
    {
        segment: "bookings",
        target: SERVICE_URLS.BOOKING_SCHEDULING,
        serviceName: "booking-scheduling",
        supportedVersions: SERVICE_VERSION_SUPPORT["booking-scheduling"],
    },
    {
        segment: "payments",
        target: SERVICE_URLS.PAYMENT_WALLET,
        serviceName: "payment-wallet",
        supportedVersions: SERVICE_VERSION_SUPPORT["payment-wallet"],
    },
    {
        segment: "charging",
        target: SERVICE_URLS.CHARGING_SESSION,
        serviceName: "charging-session",
        supportedVersions: SERVICE_VERSION_SUPPORT["charging-session"],
    },
    {
        segment: "notifications",
        target: SERVICE_URLS.NOTIFICATION_ALERTS,
        serviceName: "notification-alerts",
        supportedVersions: SERVICE_VERSION_SUPPORT["notification-alerts"],
    },
    {
        segment: "analytics",
        target: SERVICE_URLS.USAGE_ANALYTICS,
        serviceName: "usage-analytics",
        supportedVersions: SERVICE_VERSION_SUPPORT["usage-analytics"],
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
        path: "/api/bluetooth",
        target: SERVICE_URLS.BLUETOOTH_PAIRING,
        serviceName: "bluetooth-pairing",
    },
    {
        path: "/api/stations",
        target: SERVICE_URLS.STATION_DISCOVERY,
        serviceName: "station-discovery",
    },
    {
        path: "/api/station-management",
        target: SERVICE_URLS.STATION_MANAGEMENT,
        serviceName: "station-management",
    },
    {
        path: "/api/bookings",
        target: SERVICE_URLS.BOOKING_SCHEDULING,
        serviceName: "booking-scheduling",
    },
    {
        path: "/api/payments",
        target: SERVICE_URLS.PAYMENT_WALLET,
        serviceName: "payment-wallet",
    },
    {
        path: "/api/charging",
        target: SERVICE_URLS.CHARGING_SESSION,
        serviceName: "charging-session",
    },
    {
        path: "/api/notifications",
        target: SERVICE_URLS.NOTIFICATION_ALERTS,
        serviceName: "notification-alerts",
    },
    {
        path: "/api/analytics",
        target: SERVICE_URLS.USAGE_ANALYTICS,
        serviceName: "usage-analytics",
    },
];

// Backward compatibility aliases
export const proxyRoutesV1 = versionedRoutes;
