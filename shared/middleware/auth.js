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

        if (!authHeader) {
            throw new UnauthorizedError("No authorization header provided");
        }

        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : authHeader;

        if (!token) {
            throw new UnauthorizedError("No token provided");
        }

        // Use access token secret
        const accessSecret =
            process.env.JWT_ACCESS_SECRET ||
            process.env.JWT_SECRET ||
            "access-secret-key";
        const decoded = jwt.verify(token, accessSecret);

        // Check if it's an access token
        if (decoded.type !== "access") {
            logger.warn("Invalid token type", { type: decoded.type });
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

            if (isTokenRevoked) {
                logger.warn("Token revoked", { jti: decoded.jti });
                return res.status(401).json({
                    success: false,
                    error: "TOKEN_REVOKED",
                    message: "Token has been revoked",
                });
            }

            // Check user-level access token revocation
            const userRevokedKey = `revoked:user:${decoded.userId}`;
            const revokedTimestamp = await client.get(userRevokedKey);

            if (revokedTimestamp) {
                const revokedTime = parseInt(revokedTimestamp);
                const tokenIat = decoded.iat; // Both are now in seconds

                // If token was issued before revocation, it's invalid
                if (tokenIat < revokedTime) {
                    logger.warn("User access tokens revoked", {
                        userId: decoded.userId,
                        tokenIat,
                        revokedTime,
                        tokenJti: decoded.jti,
                    });
                    return res.status(401).json({
                        success: false,
                        error: "TOKEN_REVOKED",
                        message: "Token has been revoked due to logout",
                    });
                }
            }
        } catch (redisError) {
            // If Redis is unavailable, continue without revocation check
            logger.warn("Redis unavailable for token revocation check", {
                error: redisError.message,
            });
        }

        // Attach user info to request
        req.user = decoded;
        req.userId = decoded.userId || decoded.id;

        logger.debug("Token verified", { userId: req.userId });

        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            logger.warn("Invalid token", { error: error.message });
            return res.status(401).json({
                success: false,
                error: "INVALID_TOKEN",
                message: "Invalid authentication token",
            });
        }

        if (error.name === "TokenExpiredError") {
            logger.warn("Token expired", { error: error.message });
            return res.status(401).json({
                success: false,
                error: "TOKEN_EXPIRED",
                message: "Authentication token has expired",
                data: { shouldRefresh: true },
            });
        }

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
