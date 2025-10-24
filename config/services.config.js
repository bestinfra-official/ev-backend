/**
 * Combined Service Configuration
 * Centralized configuration for service enablement, ports, and URLs
 */

// Base port configuration
const BASE_PORTS = {
    // API Gateway
    GATEWAY: process.env.PORT || 7000,

    // Microservices (using 7100-7109 range)
    AUTH_MANAGEMENT: process.env.AUTH_SERVICE_PORT || 7100,
    VEHICLE_MANAGEMENT: process.env.VEHICLE_SERVICE_PORT || 7101,
    BLUETOOTH_PAIRING: process.env.BLUETOOTH_SERVICE_PORT || 7102,
    STATION_DISCOVERY: process.env.STATION_DISCOVERY_PORT || 7103,
    STATION_MANAGEMENT: process.env.STATION_MANAGEMENT_PORT || 7104,
    BOOKING_SCHEDULING: process.env.BOOKING_SERVICE_PORT || 7105,
    PAYMENT_WALLET: process.env.PAYMENT_SERVICE_PORT || 7106,
    CHARGING_SESSION: process.env.CHARGING_SERVICE_PORT || 7107,
    NOTIFICATION_ALERTS: process.env.NOTIFICATION_SERVICE_PORT || 7108,
    USAGE_ANALYTICS: process.env.ANALYTICS_SERVICE_PORT || 7109,
};

// Service port mapping for the orchestrator
export const SERVICE_PORTS = {
    "auth-management": BASE_PORTS.AUTH_MANAGEMENT,
    "vehicle-management": BASE_PORTS.VEHICLE_MANAGEMENT,
    "bluetooth-pairing": BASE_PORTS.BLUETOOTH_PAIRING,
    "station-discovery": BASE_PORTS.STATION_DISCOVERY,
    "station-management": BASE_PORTS.STATION_MANAGEMENT,
    "booking-scheduling": BASE_PORTS.BOOKING_SCHEDULING,
    "payment-wallet": BASE_PORTS.PAYMENT_WALLET,
    "charging-session": BASE_PORTS.CHARGING_SESSION,
    "notification-alerts": BASE_PORTS.NOTIFICATION_ALERTS,
    "usage-analytics": BASE_PORTS.USAGE_ANALYTICS,
};

// Service URLs with centralized ports
export const SERVICE_URLS = {
    AUTH_MANAGEMENT:
        process.env.AUTH_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.AUTH_MANAGEMENT}`,
    VEHICLE_MANAGEMENT:
        process.env.VEHICLE_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.VEHICLE_MANAGEMENT}`,
    BLUETOOTH_PAIRING:
        process.env.BLUETOOTH_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.BLUETOOTH_PAIRING}`,
    STATION_DISCOVERY:
        process.env.STATION_DISCOVERY_URL ||
        `http://localhost:${BASE_PORTS.STATION_DISCOVERY}`,
    STATION_MANAGEMENT:
        process.env.STATION_MANAGEMENT_URL ||
        `http://localhost:${BASE_PORTS.STATION_MANAGEMENT}`,
    BOOKING_SCHEDULING:
        process.env.BOOKING_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.BOOKING_SCHEDULING}`,
    PAYMENT_WALLET:
        process.env.PAYMENT_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.PAYMENT_WALLET}`,
    CHARGING_SESSION:
        process.env.CHARGING_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.CHARGING_SESSION}`,
    NOTIFICATION_ALERTS:
        process.env.NOTIFICATION_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.NOTIFICATION_ALERTS}`,
    USAGE_ANALYTICS:
        process.env.ANALYTICS_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.USAGE_ANALYTICS}`,
};

// Gateway port
export const GATEWAY_PORT = process.env.GATEWAY_PORT || BASE_PORTS.GATEWAY;

// Export base ports for direct access if needed
export { BASE_PORTS };

// Service Enablement Configuration
// Control which services are enabled/disabled for startup
export const SERVICE_ENABLEMENT = {
    // Authentication & User Management
    "auth-management": true,

    // Station & Discovery Services
    "station-discovery": true,
    "station-management": false,

    // Vehicle Services
    "vehicle-management": false,

    // Charging & Booking Services
    "charging-session": false,
    "booking-scheduling": false,

    // Payment & Wallet Services
    "payment-wallet": false,

    // Communication Services
    "notification-alerts": false,
    "bluetooth-pairing": false,

    // Analytics Services
    "usage-analytics": false,
};

/**
 * Get enabled services
 * @returns {string[]} Array of enabled service names
 */
export function getEnabledServices() {
    return Object.entries(SERVICE_ENABLEMENT)
        .filter(([serviceName, isEnabled]) => isEnabled)
        .map(([serviceName]) => serviceName);
}

/**
 * Check if a service is enabled
 * @param {string} serviceName - Name of the service
 * @returns {boolean} True if service is enabled
 */
export function isServiceEnabled(serviceName) {
    return SERVICE_ENABLEMENT[serviceName] === true;
}

/**
 * Enable a service
 * @param {string} serviceName - Name of the service to enable
 */
export function enableService(serviceName) {
    if (SERVICE_ENABLEMENT.hasOwnProperty(serviceName)) {
        SERVICE_ENABLEMENT[serviceName] = true;
    }
}

/**
 * Disable a service
 * @param {string} serviceName - Name of the service to disable
 */
export function disableService(serviceName) {
    if (SERVICE_ENABLEMENT.hasOwnProperty(serviceName)) {
        SERVICE_ENABLEMENT[serviceName] = false;
    }
}
