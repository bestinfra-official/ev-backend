/**
 * User Data Service
 * Handles bulk data operations for users, optimized for large datasets
 * Provides batching and pagination for memory-efficient data processing
 */

import { createLogger } from "@ev-platform/shared";
import { User } from "../models/index.js";

const logger = createLogger("user-data-service");

class UserDataService {
    constructor() {
        this.DEFAULT_BATCH_SIZE = 10000;
        this.SAFETY_LIMIT = 100000000; // 100M safety limit
    }

    /**
     * Fetch all phone numbers from database in batches
     * Uses cursor-based pagination for memory efficiency
     *
     * @param {number} batchSize - Number of records per batch
     * @returns {Promise<string[]>} Array of all phone numbers
     */
    async fetchAllPhones(batchSize = this.DEFAULT_BATCH_SIZE) {
        const phones = [];
        let offset = 0;
        let hasMore = true;

        try {
            logger.info("Fetching phone numbers from database...", {
                batchSize,
                safetyLimit: this.SAFETY_LIMIT,
            });

            while (hasMore) {
                // Use User model for data access (proper abstraction)
                const batchPhones = await User.getAllPhones(batchSize, offset);

                if (batchPhones.length === 0) {
                    hasMore = false;
                } else {
                    phones.push(...batchPhones);
                    offset += batchPhones.length;

                    logger.info(
                        `Fetched batch: ${batchPhones.length} phones (total: ${phones.length})`
                    );
                }

                // Prevent infinite loops
                if (offset > this.SAFETY_LIMIT) {
                    logger.warn("Safety limit reached, stopping fetch", {
                        offset,
                        safetyLimit: this.SAFETY_LIMIT,
                    });
                    hasMore = false;
                }
            }

            logger.info(`Total phones fetched: ${phones.length}`);
            return phones;
        } catch (error) {
            logger.error("Failed to fetch phones from database", {
                error: error.message,
                stack: error.stack,
                batchSize,
                offset,
            });
            throw error;
        }
    }

    /**
     * Get user count for planning purposes
     * @returns {Promise<number>} Total number of users
     */
    async getUserCount() {
        try {
            const stats = await User.getStats();
            return parseInt(stats.total_users) || 0;
        } catch (error) {
            logger.error("Failed to get user count", {
                error: error.message,
            });
            return 0;
        }
    }

    /**
     * Get estimated memory usage for fetching all phones
     * @returns {Promise<object>} Memory estimation
     */
    async getMemoryEstimate() {
        try {
            const userCount = await this.getUserCount();
            const avgPhoneLength = 15; // E.164 format average
            const estimatedBytes = userCount * avgPhoneLength;

            return {
                userCount,
                estimatedBytes,
                estimatedMB: Math.round(estimatedBytes / (1024 * 1024)),
                recommendedBatchSize: Math.min(
                    this.DEFAULT_BATCH_SIZE,
                    Math.max(1000, Math.floor(50000000 / userCount))
                ),
            };
        } catch (error) {
            logger.error("Failed to get memory estimate", {
                error: error.message,
            });
            return {
                userCount: 0,
                estimatedBytes: 0,
                estimatedMB: 0,
                recommendedBatchSize: this.DEFAULT_BATCH_SIZE,
            };
        }
    }
}

// Export singleton instance
export default new UserDataService();
