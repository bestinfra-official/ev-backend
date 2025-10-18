/**
 * Bloom Filter Service
 * Manages a Bloom filter for fast phone number existence checks
 * Optimized for 1M+ requests/minute with minimal false positives
 *
 * A Bloom filter is a space-efficient probabilistic data structure that can:
 * - Tell us with certainty that a phone DOES NOT exist (no false negatives)
 * - Tell us that a phone MIGHT exist (some false positives, tunable via error rate)
 */

import bloomFiltersPackage from "bloom-filters";
const { BloomFilter } = bloomFiltersPackage;
import { createLogger, redis } from "@ev-platform/shared";

const logger = createLogger("bloom-filter-service");

// Configuration
const BLOOM_CONFIG = {
    // Expected number of phones in the system
    EXPECTED_ELEMENTS: parseInt(
        process.env.BLOOM_EXPECTED_PHONES || "10000000"
    ), // 10M users
    // False positive rate (0.001 = 0.1% false positive rate)
    ERROR_RATE: parseFloat(process.env.BLOOM_ERROR_RATE || "0.001"),
    // Redis key for persisting the Bloom filter
    REDIS_KEY: "phone:bloom:filter",
    // Refresh interval in seconds (rebuild from DB periodically)
    REFRESH_INTERVAL_HOURS: parseInt(process.env.BLOOM_REFRESH_HOURS || "24"),
};

class BloomFilterService {
    constructor() {
        this.bloomFilter = null;
        this.lastRefresh = null;
        this.stats = {
            totalChecks: 0,
            definitelyNotFound: 0,
            maybeFound: 0,
            falsePositives: 0,
        };
    }

    /**
     * Initialize Bloom filter
     * Loads from Redis if exists, otherwise creates new one
     */
    async initialize() {
        try {
            // Try to load from Redis first
            const loaded = await this.loadFromRedis();

            if (loaded) {
                logger.info("Bloom filter loaded from Redis", {
                    expectedElements: BLOOM_CONFIG.EXPECTED_ELEMENTS,
                    errorRate: BLOOM_CONFIG.ERROR_RATE,
                });
            } else {
                // Create new Bloom filter
                this.bloomFilter = BloomFilter.create(
                    BLOOM_CONFIG.EXPECTED_ELEMENTS,
                    BLOOM_CONFIG.ERROR_RATE
                );

                logger.info("New Bloom filter created", {
                    expectedElements: BLOOM_CONFIG.EXPECTED_ELEMENTS,
                    errorRate: BLOOM_CONFIG.ERROR_RATE,
                    size: this.bloomFilter.size,
                });

                // Mark as needing population
                this.lastRefresh = null;
            }

            return true;
        } catch (error) {
            logger.error("Failed to initialize Bloom filter", {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Check if a phone number might exist
     * @param {string} phone - Normalized phone number (E.164 format)
     * @returns {object} { exists: boolean, confidence: string }
     */
    check(phone) {
        if (!this.bloomFilter) {
            logger.warn(
                "Bloom filter not initialized, assuming phone might exist"
            );
            return { exists: true, confidence: "bloom_not_initialized" };
        }

        this.stats.totalChecks++;

        const exists = this.bloomFilter.has(phone);

        if (!exists) {
            // Definitely does NOT exist
            this.stats.definitelyNotFound++;
            return { exists: false, confidence: "definitely_not" };
        } else {
            // Might exist (could be false positive)
            this.stats.maybeFound++;
            return { exists: true, confidence: "maybe" };
        }
    }

    /**
     * Add a phone number to the Bloom filter
     * @param {string} phone - Normalized phone number (E.164 format)
     */
    add(phone) {
        if (!this.bloomFilter) {
            logger.warn("Bloom filter not initialized, cannot add phone");
            return false;
        }

        this.bloomFilter.add(phone);
        logger.debug(`Phone added to Bloom filter: ${phone}`);
        return true;
    }

    /**
     * Add multiple phone numbers in bulk (optimized)
     * @param {string[]} phones - Array of normalized phone numbers
     */
    addBulk(phones) {
        if (!this.bloomFilter) {
            logger.warn("Bloom filter not initialized, cannot add phones");
            return 0;
        }

        let added = 0;
        for (const phone of phones) {
            this.bloomFilter.add(phone);
            added++;
        }

        logger.info(`Bulk added ${added} phones to Bloom filter`);
        return added;
    }

    /**
     * Save Bloom filter to Redis for persistence
     */
    async saveToRedis() {
        if (!this.bloomFilter) {
            logger.warn("No Bloom filter to save");
            return false;
        }

        try {
            const client = redis.getClient();

            // Export Bloom filter to JSON
            const exported = this.bloomFilter.saveAsJSON();
            const serialized = JSON.stringify(exported);

            // Save to Redis (no expiry - persist until manually refreshed)
            await client.set(BLOOM_CONFIG.REDIS_KEY, serialized);

            // Save metadata
            await client.set(
                `${BLOOM_CONFIG.REDIS_KEY}:meta`,
                JSON.stringify({
                    lastRefresh: Date.now(),
                    expectedElements: BLOOM_CONFIG.EXPECTED_ELEMENTS,
                    errorRate: BLOOM_CONFIG.ERROR_RATE,
                    size: this.bloomFilter.size,
                })
            );

            this.lastRefresh = Date.now();

            logger.info("Bloom filter saved to Redis", {
                size: serialized.length,
                elements: BLOOM_CONFIG.EXPECTED_ELEMENTS,
            });

            return true;
        } catch (error) {
            logger.error("Failed to save Bloom filter to Redis", {
                error: error.message,
            });
            return false;
        }
    }

    /**
     * Load Bloom filter from Redis
     */
    async loadFromRedis() {
        try {
            const client = redis.getClient();
            const serialized = await client.get(BLOOM_CONFIG.REDIS_KEY);

            if (!serialized) {
                logger.info("No Bloom filter found in Redis");
                return false;
            }

            // Load metadata
            const metaStr = await client.get(`${BLOOM_CONFIG.REDIS_KEY}:meta`);
            const meta = metaStr ? JSON.parse(metaStr) : null;

            // Check if needs refresh (older than REFRESH_INTERVAL_HOURS)
            if (meta && meta.lastRefresh) {
                const ageHours =
                    (Date.now() - meta.lastRefresh) / (1000 * 60 * 60);
                if (ageHours > BLOOM_CONFIG.REFRESH_INTERVAL_HOURS) {
                    logger.warn(
                        `Bloom filter is ${ageHours.toFixed(
                            1
                        )} hours old, needs refresh`
                    );
                    // Don't return false, still use it but log warning
                }
            }

            // Import from JSON
            const data = JSON.parse(serialized);
            this.bloomFilter = BloomFilter.fromJSON(data);
            this.lastRefresh = meta?.lastRefresh || null;

            logger.info("Bloom filter loaded from Redis", {
                size: this.bloomFilter.size,
                lastRefresh: this.lastRefresh
                    ? new Date(this.lastRefresh).toISOString()
                    : "unknown",
            });

            return true;
        } catch (error) {
            logger.error("Failed to load Bloom filter from Redis", {
                error: error.message,
            });
            return false;
        }
    }

    /**
     * Populate Bloom filter from database
     * @param {Function} fetchPhones - Async function that returns array of phone numbers
     */
    async populateFromDatabase(fetchPhones) {
        if (!this.bloomFilter) {
            await this.initialize();
        }

        try {
            logger.info("Starting Bloom filter population from database...");
            const startTime = Date.now();

            // Fetch all phone numbers from database
            const phones = await fetchPhones();

            if (!phones || phones.length === 0) {
                logger.warn("No phones to populate in Bloom filter");
                return 0;
            }

            // Add all phones to Bloom filter
            const added = this.addBulk(phones);

            // Save to Redis
            await this.saveToRedis();

            const duration = Date.now() - startTime;
            logger.info(`Bloom filter populated successfully`, {
                phones: added,
                duration: `${duration}ms`,
                avgPerPhone: `${(duration / added).toFixed(2)}ms`,
            });

            return added;
        } catch (error) {
            logger.error("Failed to populate Bloom filter from database", {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Get Bloom filter statistics
     */
    getStats() {
        const hitRate =
            this.stats.totalChecks > 0
                ? (
                      (this.stats.maybeFound / this.stats.totalChecks) *
                      100
                  ).toFixed(2)
                : 0;

        const rejectRate =
            this.stats.totalChecks > 0
                ? (
                      (this.stats.definitelyNotFound / this.stats.totalChecks) *
                      100
                  ).toFixed(2)
                : 0;

        return {
            initialized: this.bloomFilter !== null,
            lastRefresh: this.lastRefresh,
            lastRefreshAge: this.lastRefresh
                ? `${(
                      (Date.now() - this.lastRefresh) /
                      (1000 * 60 * 60)
                  ).toFixed(1)} hours`
                : "never",
            config: {
                expectedElements: BLOOM_CONFIG.EXPECTED_ELEMENTS,
                errorRate: BLOOM_CONFIG.ERROR_RATE,
            },
            size: this.bloomFilter?.size || 0,
            checks: {
                total: this.stats.totalChecks,
                definitelyNotFound: this.stats.definitelyNotFound,
                maybeFound: this.stats.maybeFound,
                falsePositives: this.stats.falsePositives,
                hitRate: `${hitRate}%`,
                rejectRate: `${rejectRate}%`,
            },
        };
    }

    /**
     * Record a false positive (for accuracy tracking)
     * Call this when Bloom says "maybe" but DB says "no"
     */
    recordFalsePositive() {
        this.stats.falsePositives++;
    }
}

// Export singleton instance
const bloomFilterService = new BloomFilterService();
export default bloomFilterService;
