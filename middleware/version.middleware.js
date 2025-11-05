/**
 * Version Detection and Validation Middleware
 * Extracts API version from URL or headers and validates it
 */

import {
    DEFAULT_VERSION,
    getVersionInfo,
    isVersionSupported,
    isVersionDeprecated,
    isVersionSunset,
    getDeprecationMessage,
    serviceSupportsVersion,
    getAllVersions,
} from "../config/versions.config.js";

/**
 * Extract version from request URL
 * Supports patterns like: /api/v1/service, /api/v2/service
 * @param {string} path - Request path
 * @returns {string|null} - Extracted version or null
 */
const extractVersionFromUrl = (path) => {
    const versionMatch = path.match(/\/api\/(v\d+)(?:\/|$)/);
    return versionMatch ? versionMatch[1] : null;
};

/**
 * Extract version from request headers
 * Checks headers: X-API-Version, Accept-Version, API-Version
 * @param {Object} headers - Request headers
 * @returns {string|null} - Extracted version or null
 */
const extractVersionFromHeaders = (headers) => {
    return (
        headers["x-api-version"] ||
        headers["accept-version"] ||
        headers["api-version"] ||
        null
    );
};

/**
 * Get service name from path
 * Extracts service name from path like /api/v1/auth -> auth
 * @param {string} path - Request path
 * @returns {string|null}
 */
const extractServiceName = (path) => {
    const serviceMatch = path.match(/\/api\/v\d+\/([^/]+)/);
    if (!serviceMatch) return null;

    // Map path segments to actual service names
    const serviceMap = {
        auth: "auth-management",
        vehicles: "vehicle-management",
        stations: "station-management",
        payments: "payment-wallet",
        notifications: "notification-alerts",
    };

    return serviceMap[serviceMatch[1]] || serviceMatch[1];
};

/**
 * Version detection middleware
 * Extracts and validates API version from URL or headers
 * Attaches version info to request object
 */
export const versionDetectionMiddleware = (req, res, next) => {
    // Use originalUrl to get the full path (req.path is relative to mounted middleware)
    const fullPath = req.originalUrl || req.url;

    // Extract version from URL (priority 1)
    let version = extractVersionFromUrl(fullPath);

    // If not in URL, check headers (priority 2)
    if (!version) {
        version = extractVersionFromHeaders(req.headers);
    }

    // If still no version, use default
    if (!version) {
        version = DEFAULT_VERSION;
    }

    // Validate version format (must be v followed by number)
    if (!/^v\d+$/.test(version)) {
        return res.status(400).json({
            success: false,
            error: "Invalid API version format",
            message: `Version "${version}" is not valid. Expected format: v1, v2, etc.`,
            requestedVersion: version,
        });
    }

    // Check if version exists
    if (!isVersionSupported(version)) {
        return res.status(404).json({
            success: false,
            error: "Unsupported API version",
            message: `API version "${version}" is not supported`,
            requestedVersion: version,
        });
    }

    // Check if version is sunset (no longer available)
    if (isVersionSunset(version)) {
        return res.status(410).json({
            success: false,
            error: "API version sunset",
            message: `API version "${version}" has been sunset and is no longer available`,
            requestedVersion: version,
        });
    }

    // Get version info
    const versionInfo = getVersionInfo(version);

    // Attach version information to request
    req.apiVersion = version;
    req.versionInfo = versionInfo;

    // Check for deprecation and add warning headers
    if (isVersionDeprecated(version)) {
        const deprecationMessage = getDeprecationMessage(version);
        res.setHeader("X-API-Deprecated", "true");
        res.setHeader("X-API-Deprecation-Message", deprecationMessage);
        res.setHeader("X-API-Sunset-Date", versionInfo.sunsetDate || "TBD");

        // Log deprecation warning
        console.warn(
            `⚠️  Deprecated API version used: ${version} - ${req.method} ${req.path}`
        );
    }

    // Add version info headers to response
    res.setHeader("X-API-Version", version);
    res.setHeader("X-API-Version-Status", versionInfo.status);

    next();
};

/**
 * Service version validation middleware
 * Validates that the requested service supports the API version
 */
export const serviceVersionValidationMiddleware = (req, res, next) => {
    const version = req.apiVersion || DEFAULT_VERSION;
    const fullPath = req.originalUrl || req.url;
    const serviceName = extractServiceName(fullPath);

    if (!serviceName) {
        // Can't determine service, let proxy handle it
        return next();
    }

    // Check if service supports this version
    if (!serviceSupportsVersion(serviceName, version)) {
        return res.status(404).json({
            success: false,
            error: "Version not supported by service",
            message: `Service "${serviceName}" does not support API version "${version}"`,
            service: serviceName,
            requestedVersion: version,
        });
    }

    next();
};

/**
 * Version info endpoint middleware
 * Returns information about available API versions
 */
export const versionInfoHandler = (req, res) => {
    const versions = getAllVersions();

    res.json({
        success: true,
        data: {
            versions,
            default: DEFAULT_VERSION,
            current: req.apiVersion || DEFAULT_VERSION,
        },
    });
};
