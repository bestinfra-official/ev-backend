/**
 * Shared Authentication Middleware
 * JWT verification for protected routes
 */

import jwt from "jsonwebtoken";
import { createLogger } from "../utils/logger.js";
import { UnauthorizedError } from "../utils/errors.js";

const logger = createLogger("auth-middleware");

/**
 * Verify JWT token from request headers
 */
export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        logger.debug({ authHeader }, "Authorization header received");

        if (!authHeader) {
            logger.warn(
                { path: req.path, ip: req.ip, headers: req.headers },
                "No authorization header provided"
            );
            throw new UnauthorizedError("No authorization header provided");
        }

        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : authHeader;

        logger.debug({ tokenPresent: !!token, path: req.path }, "Token parsed from header");

        if (!token) {
            logger.warn(
                { path: req.path, ip: req.ip, headers: req.headers, authHeader },
                "No token provided"
            );
            throw new UnauthorizedError("No token provided");
        }

        // Use access token secret
        const accessSecret =
            process.env.JWT_ACCESS_SECRET ||
            process.env.JWT_SECRET ||
            "access-secret-key";

        let decoded;
        try {
            decoded = jwt.verify(token, accessSecret);
            logger.debug({ decoded }, "JWT verified successfully");
        } catch (err) {
            logger.warn({ error: err.message, token }, "JWT verification failed");
            throw err;
        }

        // Check if it's an access token
        if (decoded.type !== "access") {
            logger.warn(
                { type: decoded.type, tokenJti: decoded.jti, userId: decoded.userId },
                "Invalid token type"
            );
            return res.status(401).json({
                success: false,
                error: "INVALID_TOKEN_TYPE",
                message: "Invalid token type",
            });
        }

        // Check if token is revoked (if Redis is available)
        try {
            const { redis } = await import("@ev-platform/shared");
            const client = redis.getClient();

            // Check individual token revocation
            const isTokenRevoked = await client.exists(
                `revoked:access:${decoded.jti}`
            );

            logger.debug(
                { jti: decoded.jti, isTokenRevoked },
                "Access token revocation status checked"
            );

            if (isTokenRevoked) {
                logger.warn(
                    { jti: decoded.jti, userId: decoded.userId },
                    "Token revoked"
                );
                return res.status(401).json({
                    success: false,
                    error: "TOKEN_REVOKED",
                    message: "Token has been revoked",
                });
            }

            // Check user-level access token revocation
            const userRevokedKey = `revoked:user:${decoded.userId}`;
            const revokedTimestamp = await client.get(userRevokedKey);

            logger.debug(
                { userId: decoded.userId, revokedTimestamp },
                "User-level token revocation status checked"
            );

            if (revokedTimestamp) {
                const revokedTime = parseInt(revokedTimestamp);
                const tokenIat = decoded.iat; // Both are now in seconds

                // If token was issued before revocation, it's invalid
                if (tokenIat < revokedTime) {
                    logger.warn(
                        {
                            userId: decoded.userId,
                            tokenIat,
                            revokedTime,
                            tokenJti: decoded.jti,
                        },
                        "User access tokens revoked (logout)"
                    );
                    return res.status(401).json({
                        success: false,
                        error: "TOKEN_REVOKED",
                        message: "Token has been revoked due to logout",
                    });
                }
            }
        } catch (redisError) {
            // If Redis is unavailable, continue without revocation check
            logger.warn(
                { error: redisError.message },
                "Redis unavailable for token revocation check"
            );
        }

        // Attach user info to request
        req.user = decoded;
        req.userId = decoded.userId || decoded.id;

        logger.debug({ userId: req.userId, user: decoded }, "Token verified and user attached");

        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            logger.warn(
                { error: error.message, path: req.path, headers: req.headers },
                "Invalid token"
            );
            return res.status(401).json({
                success: false,
                error: "INVALID_TOKEN",
                message: "Invalid authentication token",
            });
        }

        if (error.name === "TokenExpiredError") {
            logger.warn(
                { error: error.message, path: req.path, headers: req.headers },
                "Token expired"
            );
            return res.status(401).json({
                success: false,
                error: "TOKEN_EXPIRED",
                message: "Authentication token has expired",
                data: { shouldRefresh: true },
            });
        }

        logger.error({ error, path: req.path }, "Unexpected error in verifyToken");
        next(error);
    }
};

/**
 * Optional auth - attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return next();
        }

        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : authHeader;

        if (!token) {
            return next();
        }

        const secret = process.env.JWT_SECRET || "your-secret-key";
        const decoded = jwt.verify(token, secret);

        req.user = decoded;
        req.userId = decoded.userId || decoded.id;

        next();
    } catch (error) {
        // If token is invalid, just continue without user
        next();
    }
};

/**
 * Check if user has required role
 */
export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized",
                message: "Authentication required",
            });
        }

        const userRole = req.user.role;

        if (!allowedRoles.includes(userRole)) {
            logger.warn("Insufficient permissions", {
                userId: req.userId,
                requiredRoles: allowedRoles,
                userRole,
            });

            return res.status(403).json({
                success: false,
                error: "Forbidden",
                message: "Insufficient permissions",
            });
        }

        next();
    };
};
