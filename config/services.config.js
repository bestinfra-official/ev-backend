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
    STATION_DISCOVERY: process.env.STATION_DISCOVERY_PORT || 7103,
    PAYMENT_WALLET: process.env.PAYMENT_SERVICE_PORT || 7106,
    NOTIFICATION_ALERTS: process.env.NOTIFICATION_SERVICE_PORT || 7108,
};

// Service port mapping for the orchestrator
export const SERVICE_PORTS = {
    "auth-management": BASE_PORTS.AUTH_MANAGEMENT,
    "vehicle-management": BASE_PORTS.VEHICLE_MANAGEMENT,
    "station-management": BASE_PORTS.STATION_DISCOVERY,
    "payment-wallet": BASE_PORTS.PAYMENT_WALLET,
    "notification-alerts": BASE_PORTS.NOTIFICATION_ALERTS,
};

// Service URLs with centralized ports
export const SERVICE_URLS = {
    AUTH_MANAGEMENT:
        process.env.AUTH_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.AUTH_MANAGEMENT}`,
    VEHICLE_MANAGEMENT:
        process.env.VEHICLE_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.VEHICLE_MANAGEMENT}`,
    STATION_DISCOVERY:
        process.env.STATION_DISCOVERY_URL ||
        `http://localhost:${BASE_PORTS.STATION_DISCOVERY}`,
    PAYMENT_WALLET:
        process.env.PAYMENT_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.PAYMENT_WALLET}`,
    NOTIFICATION_ALERTS:
        process.env.NOTIFICATION_SERVICE_URL ||
        `http://localhost:${BASE_PORTS.NOTIFICATION_ALERTS}`,
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
    "station-management": true,

    // Vehicle Services
    "vehicle-management": true,

    // Payment & Wallet Services
    "payment-wallet": false,

    // Communication Services
    "notification-alerts": false,
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
