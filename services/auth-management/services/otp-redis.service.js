/**
 * Redis OTP Service
 * Handles OTP storage, retrieval, and rate limiting with Redis
 * Optimized for high-scale operations (1M+ requests/minute)
 */

import { createLogger, redis } from "@ev-platform/shared";
import {
    createOtpMetadata,
    parseOtpMetadata,
    isOtpExpired,
    isTooManyAttempts,
    OTP_CONFIG,
} from "../utils/otp.utils.js";

const logger = createLogger("otp-redis-service");

// Redis key prefixes (using ev: prefix from shared config)
const KEY_PREFIX = {
    OTP: "otp", // otp:{phone} -> metadata
    COOLDOWN: "otp:cooldown", // otp:cooldown:{phone} -> 1
    RATE_HOUR: "otp:rate:hour", // otp:rate:hour:{phone} -> count
    RATE_DAY: "otp:rate:day", // otp:rate:day:{phone} -> count
    VERIFY_ATTEMPTS: "otp:verify", // otp:verify:{phone} -> count
    IP_RATE: "otp:ip", // otp:ip:{ip} -> count
};

// Rate limiting configuration
const RATE_LIMITS = {
    COOLDOWN_SECONDS: parseInt(process.env.OTP_COOLDOWN_SECONDS || "60"),
    HOUR_LIMIT: parseInt(process.env.OTP_HOUR_LIMIT || "10"),
    DAY_LIMIT: parseInt(process.env.OTP_DAY_LIMIT || "20"),
    IP_LIMIT_10MIN: parseInt(process.env.OTP_IP_LIMIT_10MIN || "100"),
};

class OTPRedisService {
    constructor() {
        this.redisClient = null;
    }

    /**
     * Get Redis client (lazy initialization)
     * @private
     */
    _getClient() {
        if (!this.redisClient) {
            this.redisClient = redis.getClient();
        }
        return this.redisClient;
    }

    /**
     * Store OTP in Redis with TTL
     * @param {string} phone - Normalized phone number
     * @param {string} otpHmac - HMAC hash of OTP
     * @returns {Promise<boolean>} Success status
     */
    async storeOtp(phone, otpHmac) {
        try {
            const client = this._getClient();
            const key = `${KEY_PREFIX.OTP}:${phone}`;
            const metadata = createOtpMetadata(otpHmac, 0);
            const metadataJson = JSON.stringify(metadata);

            // Store with TTL
            await client.setex(key, OTP_CONFIG.TTL_SECONDS, metadataJson);

            logger.debug(`OTP stored for ${phone}`, {
                ttl: OTP_CONFIG.TTL_SECONDS,
            });
            return true;
        } catch (error) {
            logger.error("Failed to store OTP in Redis", {
                error: error.message,
                phone,
            });
            throw new Error("Failed to store OTP");
        }
    }

    /**
     * Retrieve OTP metadata from Redis
     * @param {string} phone - Normalized phone number
     * @returns {Promise<object|null>} OTP metadata or null if not found
     */
    async getOtp(phone) {
        try {
            const client = this._getClient();
            const key = `${KEY_PREFIX.OTP}:${phone}`;
            const data = await client.get(key);

            if (!data) {
                return null;
            }

            const metadata = parseOtpMetadata(data);

            // Check if expired
            if (isOtpExpired(metadata)) {
                await this.deleteOtp(phone);
                return null;
            }

            return metadata;
        } catch (error) {
            logger.error("Failed to get OTP from Redis", {
                error: error.message,
                phone,
            });
            return null;
        }
    }

    /**
     * Delete OTP from Redis
     * @param {string} phone - Normalized phone number
     * @returns {Promise<boolean>} Success status
     */
    async deleteOtp(phone) {
        try {
            const client = this._getClient();
            const key = `${KEY_PREFIX.OTP}:${phone}`;
            await client.del(key);

            logger.debug(`OTP deleted for ${phone}`);
            return true;
        } catch (error) {
            logger.error("Failed to delete OTP from Redis", {
                error: error.message,
                phone,
            });
            return false;
        }
    }

    /**
     * Increment verification attempts for an OTP
     * @param {string} phone - Normalized phone number
     * @returns {Promise<number>} Current attempt count
     */
    async incrementVerifyAttempts(phone) {
        try {
            const client = this._getClient();
            const key = `${KEY_PREFIX.VERIFY_ATTEMPTS}:${phone}`;

            // Increment and set expiry if first attempt
            const attempts = await client.incr(key);
            if (attempts === 1) {
                await client.expire(key, OTP_CONFIG.TTL_SECONDS);
            }

            return attempts;
        } catch (error) {
            logger.error("Failed to increment verify attempts", {
                error: error.message,
                phone,
            });
            return 0;
        }
    }

    /**
     * Clear verification attempts
     * @param {string} phone - Normalized phone number
     */
    async clearVerifyAttempts(phone) {
        try {
            const client = this._getClient();
            const key = `${KEY_PREFIX.VERIFY_ATTEMPTS}:${phone}`;
            await client.del(key);
        } catch (error) {
            logger.error("Failed to clear verify attempts", {
                error: error.message,
                phone,
            });
        }
    }

    /**
     * Check and enforce rate limits
     * @param {string} phone - Normalized phone number
     * @param {string} ip - IP address
     * @returns {Promise<object>} Rate limit check result
     */
    async checkRateLimits(phone, ip) {
        try {
            const client = this._getClient();

            // 1. Check cooldown period (60 seconds between requests)
            const cooldownKey = `${KEY_PREFIX.COOLDOWN}:${phone}`;
            const inCooldown = await client.exists(cooldownKey);

            if (inCooldown) {
                const ttl = await client.ttl(cooldownKey);
                return {
                    allowed: false,
                    reason: "cooldown",
                    retryAfter: ttl,
                    message: `Please wait ${ttl} seconds before requesting another OTP`,
                };
            }

            // 2. Check hourly limit
            const hourKey = `${KEY_PREFIX.RATE_HOUR}:${phone}`;
            const hourCount = await client.get(hourKey);
            const hourCountInt = hourCount ? parseInt(hourCount) : 0;

            if (hourCountInt >= RATE_LIMITS.HOUR_LIMIT) {
                const ttl = await client.ttl(hourKey);
                return {
                    allowed: false,
                    reason: "hour_limit",
                    retryAfter: ttl,
                    message: `Hourly limit exceeded. Try again in ${Math.ceil(
                        ttl / 60
                    )} minutes`,
                };
            }

            // 3. Check daily limit
            const dayKey = `${KEY_PREFIX.RATE_DAY}:${phone}`;
            const dayCount = await client.get(dayKey);
            const dayCountInt = dayCount ? parseInt(dayCount) : 0;

            if (dayCountInt >= RATE_LIMITS.DAY_LIMIT) {
                const ttl = await client.ttl(dayKey);
                return {
                    allowed: false,
                    reason: "day_limit",
                    retryAfter: ttl,
                    message: `Daily limit exceeded. Try again in ${Math.ceil(
                        ttl / 3600
                    )} hours`,
                };
            }

            // 4. Check IP-based rate limit (prevent abuse)
            if (ip) {
                const ipKey = `${KEY_PREFIX.IP_RATE}:${ip}`;
                const ipCount = await client.get(ipKey);
                const ipCountInt = ipCount ? parseInt(ipCount) : 0;

                if (ipCountInt >= RATE_LIMITS.IP_LIMIT_10MIN) {
                    const ttl = await client.ttl(ipKey);
                    return {
                        allowed: false,
                        reason: "ip_limit",
                        retryAfter: ttl,
                        message:
                            "Too many requests from this IP. Please try again later",
                    };
                }
            }

            return {
                allowed: true,
                reason: null,
                message: "Rate limit check passed",
            };
        } catch (error) {
            logger.error("Failed to check rate limits", {
                error: error.message,
                phone,
                ip,
            });
            // Fail open - allow request if Redis is down
            return {
                allowed: true,
                reason: "redis_error",
                message: "Rate limit check unavailable",
            };
        }
    }

    /**
     * Apply rate limits after OTP request
     * @param {string} phone - Normalized phone number
     * @param {string} ip - IP address
     */
    async applyRateLimits(phone, ip) {
        try {
            const client = this._getClient();

            // Set cooldown
            const cooldownKey = `${KEY_PREFIX.COOLDOWN}:${phone}`;
            await client.setex(cooldownKey, RATE_LIMITS.COOLDOWN_SECONDS, "1");

            // Increment hourly counter
            const hourKey = `${KEY_PREFIX.RATE_HOUR}:${phone}`;
            const hourCount = await client.incr(hourKey);
            if (hourCount === 1) {
                await client.expire(hourKey, 3600); // 1 hour
            }

            // Increment daily counter
            const dayKey = `${KEY_PREFIX.RATE_DAY}:${phone}`;
            const dayCount = await client.incr(dayKey);
            if (dayCount === 1) {
                await client.expire(dayKey, 86400); // 24 hours
            }

            // Increment IP counter if provided
            if (ip) {
                const ipKey = `${KEY_PREFIX.IP_RATE}:${ip}`;
                const ipCount = await client.incr(ipKey);
                if (ipCount === 1) {
                    await client.expire(ipKey, 600); // 10 minutes
                }
            }

            logger.debug("Rate limits applied", {
                phone,
                ip,
                hourCount,
                dayCount,
            });
        } catch (error) {
            logger.error("Failed to apply rate limits", {
                error: error.message,
                phone,
                ip,
            });
            // Don't throw - rate limiting failure shouldn't block OTP
        }
    }

    /**
     * Check verification rate limits (separate from request rate limits)
     * @param {string} phone - Normalized phone number
     * @param {string} ip - IP address
     * @returns {Promise<object>} Rate limit check result
     */
    async checkVerificationRateLimits(phone, ip) {
        try {
            const client = this._getClient();

            // Check if account is locked
            const lockKey = `${KEY_PREFIX.OTP}:lock:${phone}`;
            const isLocked = await client.exists(lockKey);

            if (isLocked) {
                const ttl = await client.ttl(lockKey);
                return {
                    allowed: false,
                    reason: "account_locked",
                    retryAfter: ttl,
                    message: `Account temporarily locked. Try again in ${Math.ceil(
                        ttl / 60
                    )} minutes`,
                };
            }

            // Check verification attempts per phone (5 attempts per 5 minutes)
            const verifyKey = `${KEY_PREFIX.VERIFY_ATTEMPTS}:${phone}`;
            const verifyCount = await client.get(verifyKey);
            const verifyCountInt = verifyCount ? parseInt(verifyCount) : 0;

            if (verifyCountInt >= 5) {
                const ttl = await client.ttl(verifyKey);
                return {
                    allowed: false,
                    reason: "verify_limit",
                    retryAfter: ttl,
                    message: `Too many verification attempts. Try again in ${Math.ceil(
                        ttl / 60
                    )} minutes`,
                };
            }

            // Check IP-based verification rate limit
            if (ip) {
                const ipVerifyKey = `${KEY_PREFIX.IP_RATE}:verify:${ip}`;
                const ipVerifyCount = await client.get(ipVerifyKey);
                const ipVerifyCountInt = ipVerifyCount
                    ? parseInt(ipVerifyCount)
                    : 0;

                if (ipVerifyCountInt >= 50) {
                    // 50 verification attempts per IP per 10 minutes
                    const ttl = await client.ttl(ipVerifyKey);
                    return {
                        allowed: false,
                        reason: "ip_verify_limit",
                        retryAfter: ttl,
                        message:
                            "Too many verification attempts from this IP. Please try again later",
                    };
                }
            }

            return {
                allowed: true,
                reason: null,
                message: "Verification rate limit check passed",
            };
        } catch (error) {
            logger.error("Failed to check verification rate limits", {
                error: error.message,
                phone,
                ip,
            });
            // Fail open - allow verification if Redis is down
            return {
                allowed: true,
                reason: "redis_error",
                message: "Verification rate limit check unavailable",
            };
        }
    }

    /**
     * Apply verification rate limits after verification attempt
     * @param {string} phone - Normalized phone number
     * @param {string} ip - IP address
     */
    async applyVerificationRateLimits(phone, ip) {
        try {
            const client = this._getClient();

            // Increment IP verification counter if provided
            if (ip) {
                const ipVerifyKey = `${KEY_PREFIX.IP_RATE}:verify:${ip}`;
                const ipVerifyCount = await client.incr(ipVerifyKey);
                if (ipVerifyCount === 1) {
                    await client.expire(ipVerifyKey, 600); // 10 minutes
                }
            }

            logger.debug("Verification rate limits applied", {
                phone,
                ip,
            });
        } catch (error) {
            logger.error("Failed to apply verification rate limits", {
                error: error.message,
                phone,
                ip,
            });
        }
    }

    /**
     * Lock account temporarily
     * @param {string} phone - Normalized phone number
     * @param {number} seconds - Lock duration in seconds
     */
    async lockAccount(phone, seconds) {
        try {
            const client = this._getClient();
            const lockKey = `${KEY_PREFIX.OTP}:lock:${phone}`;
            await client.setex(lockKey, seconds, "1");

            logger.warn(`Account locked`, {
                phone,
                duration: seconds,
            });
        } catch (error) {
            logger.error("Failed to lock account", {
                error: error.message,
                phone,
            });
        }
    }

    /**
     * Update OTP attempts in metadata
     * @param {string} phone - Normalized phone number
     * @param {number} attempts - Current attempt count
     */
    async updateOtpAttempts(phone, attempts) {
        try {
            const client = this._getClient();
            const key = `${KEY_PREFIX.OTP}:${phone}`;
            const data = await client.get(key);

            if (data) {
                const metadata = JSON.parse(data);
                metadata.attempts = attempts;
                await client.setex(
                    key,
                    OTP_CONFIG.TTL_SECONDS,
                    JSON.stringify(metadata)
                );
            }
        } catch (error) {
            logger.error("Failed to update OTP attempts", {
                error: error.message,
                phone,
            });
        }
    }

    /**
     * Store user session data in Redis
     * @param {string} userId - User ID
     * @param {object} sessionData - Session data
     */
    async storeUserSession(userId, sessionData) {
        try {
            const client = this._getClient();
            const key = `session:${userId}`;
            const value = JSON.stringify({
                ...sessionData,
                createdAt: Date.now(),
            });

            // Store session for 7 days
            await client.setex(key, 7 * 24 * 3600, value);

            logger.debug(`User session stored`, {
                userId,
            });
        } catch (error) {
            logger.error("Failed to store user session", {
                error: error.message,
                userId,
            });
        }
    }

    /**
     * Get user session data from Redis
     * @param {string} userId - User ID
     * @returns {Promise<object|null>} Session data or null
     */
    async getUserSession(userId) {
        try {
            const client = this._getClient();
            const key = `session:${userId}`;
            const data = await client.get(key);

            if (!data) {
                return null;
            }

            return JSON.parse(data);
        } catch (error) {
            logger.error("Failed to get user session", {
                error: error.message,
                userId,
            });
            return null;
        }
    }

    /**
     * Store refresh token for validation and revocation
     * @param {string} jti - JWT ID
     * @param {string} userId - User ID
     * @param {string} refreshToken - Refresh token
     */
    async storeRefreshToken(jti, userId, refreshToken) {
        try {
            const client = this._getClient();
            const key = `refresh:${jti}`;
            const value = JSON.stringify({
                userId,
                token: refreshToken,
                createdAt: Date.now(),
            });

            // Store for 7 days (same as refresh token expiry)
            await client.setex(key, 7 * 24 * 3600, value);

            logger.debug(`Refresh token stored`, {
                jti,
                userId,
            });
        } catch (error) {
            logger.error("Failed to store refresh token", {
                error: error.message,
                jti,
                userId,
            });
        }
    }

    /**
     * Get refresh token from Redis
     * @param {string} jti - JWT ID
     * @returns {Promise<object|null>} Refresh token data or null
     */
    async getRefreshToken(jti) {
        try {
            const client = this._getClient();
            const key = `refresh:${jti}`;
            const data = await client.get(key);

            if (!data) {
                return null;
            }

            return JSON.parse(data);
        } catch (error) {
            logger.error("Failed to get refresh token", {
                error: error.message,
                jti,
            });
            return null;
        }
    }

    /**
     * Revoke refresh token
     * @param {string} jti - JWT ID
     */
    async revokeRefreshToken(jti) {
        try {
            const client = this._getClient();
            const key = `refresh:${jti}`;
            await client.del(key);

            logger.debug(`Refresh token revoked`, {
                jti,
            });
        } catch (error) {
            logger.error("Failed to revoke refresh token", {
                error: error.message,
                jti,
            });
        }
    }

    /**
     * Revoke all refresh tokens for a user
     * @param {string} userId - User ID
     */
    async revokeAllUserTokens(userId) {
        try {
            const client = this._getClient();
            const pattern = `refresh:*`;
            const keys = await client.keys(pattern);

            let revokedCount = 0;
            for (const key of keys) {
                const data = await client.get(key);
                if (data) {
                    const tokenData = JSON.parse(data);
                    if (tokenData.userId === userId) {
                        await client.del(key);
                        revokedCount++;
                    }
                }
            }

            // Also revoke user session
            await client.del(`session:${userId}`);

            logger.info(`All refresh tokens revoked for user`, {
                userId,
                revokedCount,
            });
        } catch (error) {
            logger.error("Failed to revoke all user tokens", {
                error: error.message,
                userId,
            });
        }
    }

    /**
     * Set the current valid access token JTI for a user
     * @param {string} userId - User ID
     * @param {string} jti - JWT ID of the valid token
     * @param {number} ttl - Time to live in seconds (default 15 minutes)
     */
    async setValidAccessTokenJti(userId, jti, ttl = 900) {
        try {
            const client = this._getClient();
            const key = `valid:access:${userId}`;
            await client.setex(key, ttl, jti);

            logger.debug(`Valid access token JTI set for user`, {
                userId,
                jti,
                ttl,
            });
        } catch (error) {
            logger.error("Failed to set valid access token JTI", {
                error: error.message,
                userId,
                jti,
            });
        }
    }

    /**
     * Revoke all access tokens for a user by storing them in a revoked list
     * Since access tokens are stateless, we'll store a user-level revocation marker
     * @param {string} userId - User ID
     * @param {number} ttl - Time to live in seconds (default 15 minutes)
     */
    async revokeAllUserAccessTokens(userId, ttl = 900) {
        try {
            const client = this._getClient();
            const key = `revoked:user:${userId}`;
            // Use seconds precision to match JWT iat format
            const timestamp = Math.floor(Date.now() / 1000);

            // Store user revocation with timestamp
            await client.setex(key, ttl, timestamp.toString());

            logger.info(`All access tokens revoked for user`, {
                userId,
                ttl,
                timestamp,
            });
        } catch (error) {
            logger.error("Failed to revoke all user access tokens", {
                error: error.message,
                userId,
            });
        }
    }

    /**
     * Clear user revocation timestamp
     * @param {string} userId - User ID
     */
    async clearUserRevocation(userId) {
        try {
            const client = this._getClient();
            const key = `revoked:user:${userId}`;
            await client.del(key);

            logger.debug(`User revocation cleared`, {
                userId,
            });
        } catch (error) {
            logger.error("Failed to clear user revocation", {
                error: error.message,
                userId,
            });
        }
    }

    /**
     * Check if user's access tokens are revoked
     * @param {string} userId - User ID
     * @param {number} tokenIat - Token issued at timestamp
     * @returns {Promise<boolean>} True if revoked
     */
    async isUserAccessTokensRevoked(userId, tokenIat) {
        try {
            const client = this._getClient();
            const key = `revoked:user:${userId}`;
            const revokedTimestamp = await client.get(key);

            if (!revokedTimestamp) {
                return false; // No revocation found
            }

            // Check if token was issued before revocation
            const revokedTime = parseInt(revokedTimestamp);
            return tokenIat < revokedTime;
        } catch (error) {
            logger.error("Failed to check user access token revocation", {
                error: error.message,
                userId,
            });
            return false; // If check fails, allow access
        }
    }

    /**
     * Check if access token is revoked
     * @param {string} jti - JWT ID
     * @returns {Promise<boolean>} True if revoked
     */
    async isAccessTokenRevoked(jti) {
        try {
            const client = this._getClient();
            const key = `revoked:access:${jti}`;
            const exists = await client.exists(key);
            return exists === 1;
        } catch (error) {
            logger.error("Failed to check access token revocation", {
                error: error.message,
                jti,
            });
            return false;
        }
    }

    /**
     * Revoke access token
     * @param {string} jti - JWT ID
     * @param {number} ttl - Time to live in seconds
     */
    async revokeAccessToken(jti, ttl = 900) {
        try {
            const client = this._getClient();
            const key = `revoked:access:${jti}`;
            await client.setex(key, ttl, "1");

            logger.debug(`Access token revoked`, {
                jti,
                ttl,
            });
        } catch (error) {
            logger.error("Failed to revoke access token", {
                error: error.message,
                jti,
            });
        }
    }
}

// Export singleton instance
const otpRedisService = new OTPRedisService();
export default otpRedisService;
