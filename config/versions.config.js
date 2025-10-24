/**
 * API Version Management Configuration
 * Defines supported versions, deprecation status, and sunset dates
 */

export const API_VERSIONS = {
    v1: {
        version: "v1",
        status: "stable",
        releaseDate: "2024-01-01",
        deprecationDate: null,
        sunsetDate: null,
        description: "Current stable version",
    },
    v2: {
        version: "v2",
        status: "beta",
        releaseDate: "2025-01-01",
        deprecationDate: null,
        sunsetDate: null,
        description: "Beta version with new features",
    },
};

// Default version when none is specified
export const DEFAULT_VERSION = "v1";

// Version status types
export const VERSION_STATUS = {
    STABLE: "stable",
    BETA: "beta",
    DEPRECATED: "deprecated",
    SUNSET: "sunset",
};

/**
 * Service-specific version support
 * Defines which versions each service supports
 */
export const SERVICE_VERSION_SUPPORT = {
    "auth-management": ["v1"],
    "vehicle-management": ["v1"],
    "bluetooth-pairing": ["v1"],
    "station-discovery": ["v1"],
    "station-management": ["v1"],
    "booking-scheduling": ["v1"],
    "payment-wallet": ["v1"],
    "charging-session": ["v1"],
    "notification-alerts": ["v1"],
    "usage-analytics": ["v1"],
};

/**
 * Get version info
 * @param {string} version - Version identifier (e.g., 'v1')
 * @returns {Object|null} Version configuration or null if not found
 */
export const getVersionInfo = (version) => {
    return API_VERSIONS[version] || null;
};

/**
 * Check if a version is supported
 * @param {string} version - Version identifier
 * @returns {boolean}
 */
export const isVersionSupported = (version) => {
    return !!API_VERSIONS[version];
};

/**
 * Check if version is deprecated
 * @param {string} version - Version identifier
 * @returns {boolean}
 */
export const isVersionDeprecated = (version) => {
    const versionInfo = getVersionInfo(version);
    return versionInfo?.status === VERSION_STATUS.DEPRECATED;
};

/**
 * Check if version is sunset (no longer available)
 * @param {string} version - Version identifier
 * @returns {boolean}
 */
export const isVersionSunset = (version) => {
    const versionInfo = getVersionInfo(version);
    return versionInfo?.status === VERSION_STATUS.SUNSET;
};

/**
 * Check if a service supports a specific version
 * @param {string} serviceName - Service name
 * @param {string} version - Version identifier
 * @returns {boolean}
 */
export const serviceSupportsVersion = (serviceName, version) => {
    const supportedVersions = SERVICE_VERSION_SUPPORT[serviceName] || [];
    return supportedVersions.includes(version);
};

/**
 * Get all supported versions for a service
 * @param {string} serviceName - Service name
 * @returns {Array<string>}
 */
export const getServiceSupportedVersions = (serviceName) => {
    return SERVICE_VERSION_SUPPORT[serviceName] || [];
};

/**
 * Get deprecation warning message
 * @param {string} version - Version identifier
 * @returns {string|null}
 */
export const getDeprecationMessage = (version) => {
    const versionInfo = getVersionInfo(version);
    if (!versionInfo || versionInfo.status !== VERSION_STATUS.DEPRECATED) {
        return null;
    }

    let message = `API version ${version} is deprecated.`;
    if (versionInfo.sunsetDate) {
        message += ` It will be sunset on ${versionInfo.sunsetDate}.`;
    }
    message += " Please upgrade to the latest version.";

    return message;
};

/**
 * Get all versions with their status
 * @returns {Array<Object>}
 */
export const getAllVersions = () => {
    return Object.values(API_VERSIONS);
};
