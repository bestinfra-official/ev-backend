/**
 * Phone Verification Service
 * High-performance phone number existence verification using:
 * 1. Redis cache (O(1) fast path)
 * 2. Bloom filter (O(1) cheap rejection of non-existent phones)
 * 3. Database fallback (indexed query on cache miss)
 *
 * Optimized for 1M+ requests/minute with minimal database load
 */

import { createLogger, redis } from "@ev-platform/shared";
import bloomFilterService from "./bloom-filter.service.js";
import { User } from "../models/index.js";

const logger = createLogger("phone-verification-service");

// Configuration
const CACHE_CONFIG = {
    // Redis key prefix for user phone cache
    KEY_PREFIX: "user:phone",
    // Cache TTL in seconds (24 hours default)
    TTL_SECONDS: parseInt(process.env.PHONE_CACHE_TTL_SECONDS || "86400"),
    // Negative cache TTL (cache "not found" results to prevent repeated DB queries)
    NEGATIVE_TTL_SECONDS: parseInt(
        process.env.PHONE_NEGATIVE_CACHE_TTL || "300"
    ), // 5 minutes
    // Enable negative caching (cache "phone not found" results)
    ENABLE_NEGATIVE_CACHE: process.env.PHONE_ENABLE_NEGATIVE_CACHE !== "false",
};

class PhoneVerificationService {
    constructor() {
        this.stats = {
            totalChecks: 0,
            cacheHits: 0,
            cacheMisses: 0,
            bloomRejects: 0,
            dbQueries: 0,
            dbFound: 0,
            dbNotFound: 0,
        };
    }

    /**
     * Check if a phone number exists in the system
     * Uses 3-tier approach: Cache → Bloom Filter → Database
     *
     * @param {string} phone - Normalized phone number (E.164 format)
     * @returns {Promise<object>} { exists: boolean, user: object|null, source: string }
     */
    async checkPhoneExists(phone) {
        this.stats.totalChecks++;
        const startTime = Date.now();

        try {
            // TIER 1: Check Redis cache (fastest - O(1))
            const cached = await this._checkCache(phone);
            if (cached !== null) {
                this.stats.cacheHits++;
                const duration = Date.now() - startTime;

                logger.debug(`Phone check: cache hit`, {
                    phone,
                    exists: cached.exists,
                    duration: `${duration}ms`,
                });

                return {
                    exists: cached.exists,
                    user: cached.user,
                    source: "cache",
                    duration,
                };
            }

            this.stats.cacheMisses++;

            // TIER 2: Check Bloom filter (very fast - O(1), no network)
            const bloomResult = bloomFilterService.check(phone);

            if (!bloomResult.exists) {
                // Bloom filter says definitely NOT in database
                this.stats.bloomRejects++;

                // Cache the negative result
                if (CACHE_CONFIG.ENABLE_NEGATIVE_CACHE) {
                    await this._cacheNegativeResult(phone);
                }

                const duration = Date.now() - startTime;

                logger.debug(`Phone check: bloom reject`, {
                    phone,
                    duration: `${duration}ms`,
                });

                return {
                    exists: false,
                    user: null,
                    source: "bloom",
                    duration,
                };
            }

            // TIER 3: Bloom filter says "maybe exists" - query database
            this.stats.dbQueries++;
            const user = await this._queryDatabase(phone);

            const duration = Date.now() - startTime;

            if (user) {
                // User exists - cache positive result
                this.stats.dbFound++;
                await this._cachePositiveResult(phone, user);

                // Add to Bloom filter if not already there (shouldn't happen often)
                bloomFilterService.add(phone);

                logger.debug(`Phone check: db found`, {
                    phone,
                    userId: user.id,
                    duration: `${duration}ms`,
                });

                return {
                    exists: true,
                    user,
                    source: "database",
                    duration,
                };
            } else {
                // User NOT found - this is a Bloom filter false positive
                this.stats.dbNotFound++;
                bloomFilterService.recordFalsePositive();

                // Cache the negative result
                if (CACHE_CONFIG.ENABLE_NEGATIVE_CACHE) {
                    await this._cacheNegativeResult(phone);
                }

                logger.debug(
                    `Phone check: db not found (bloom false positive)`,
                    {
                        phone,
                        duration: `${duration}ms`,
                    }
                );

                return {
                    exists: false,
                    user: null,
                    source: "database",
                    duration,
                };
            }
        } catch (error) {
            logger.error("Phone verification check failed", {
                phone,
                error: error.message,
                stack: error.stack,
            });

            // On error, fail open (allow the request to continue)
            // This prevents service disruption if Redis or DB has issues
            return {
                exists: true, // Assume exists to prevent blocking users
                user: null,
                source: "error_failopen",
                error: error.message,
            };
        }
    }

    /**
     * Add a phone number to cache and Bloom filter
     * Call this when a new user is created
     *
     * @param {string} phone - Normalized phone number
     * @param {object} user - User object from database
     */
    async addPhone(phone, user) {
        try {
            // Add to cache
            await this._cachePositiveResult(phone, user);

            // Add to Bloom filter
            bloomFilterService.add(phone);

            logger.debug(`Phone added to verification system`, {
                phone,
                userId: user.id,
            });

            return true;
        } catch (error) {
            logger.error("Failed to add phone to verification system", {
                phone,
                error: error.message,
            });
            return false;
        }
    }

    // ========== PRIVATE METHODS ==========

    /**
     * Check Redis cache for phone
     * @private
     */
    async _checkCache(phone) {
        try {
            const client = redis.getClient();
            const key = `${CACHE_CONFIG.KEY_PREFIX}:${phone}`;
            const cached = await client.get(key);

            if (!cached) {
                return null;
            }

            const data = JSON.parse(cached);
            return data;
        } catch (error) {
            logger.error("Cache check failed", {
                phone,
                error: error.message,
            });
            return null;
        }
    }

    /**
     * Cache positive result (phone exists)
     * @private
     */
    async _cachePositiveResult(phone, user) {
        try {
            const client = redis.getClient();
            const key = `${CACHE_CONFIG.KEY_PREFIX}:${phone}`;
            const value = JSON.stringify({
                exists: true,
                user: {
                    id: user.id,
                    phone: user.phone,
                    country_code: user.country_code,
                    is_verified: user.is_verified,
                },
                cachedAt: Date.now(),
            });

            await client.setex(key, CACHE_CONFIG.TTL_SECONDS, value);
        } catch (error) {
            logger.error("Failed to cache positive result", {
                phone,
                error: error.message,
            });
        }
    }

    /**
     * Cache negative result (phone does not exist)
     * @private
     */
    async _cacheNegativeResult(phone) {
        try {
            const client = redis.getClient();
            const key = `${CACHE_CONFIG.KEY_PREFIX}:${phone}`;
            const value = JSON.stringify({
                exists: false,
                user: null,
                cachedAt: Date.now(),
            });

            // Use shorter TTL for negative results
            await client.setex(key, CACHE_CONFIG.NEGATIVE_TTL_SECONDS, value);
        } catch (error) {
            logger.error("Failed to cache negative result", {
                phone,
                error: error.message,
            });
        }
    }

    /**
     * Query database for phone
     * @private
     */
    async _queryDatabase(phone) {
        try {
            const user = await User.findByPhone(phone);
            return user;
        } catch (error) {
            logger.error("Database query failed", {
                phone,
                error: error.message,
            });
            throw error;
        }
    }
}

// Export singleton instance
const phoneVerificationService = new PhoneVerificationService();
export default phoneVerificationService;
