/**
 * Populate Bloom Filter Script
 * Populates the Bloom filter with all existing phone numbers from the database
 *
 * Usage:
 *   node scripts/populate-bloom-filter.js
 *
 * This should be run:
 * 1. On first deployment to populate the initial Bloom filter
 * 2. Periodically (e.g., daily via cron) to refresh the Bloom filter with new users
 * 3. After large data imports or migrations
 */

import { createLogger, database, redis } from "@ev-platform/shared";
import bloomFilterService from "../services/bloom-filter.service.js";
import userDataService from "../services/user-data.service.js";
import dotenv from "dotenv";

dotenv.config();

const logger = createLogger("bloom-populate");

/**
 * Get memory estimate before starting population
 */
async function logMemoryEstimate() {
    try {
        const estimate = await userDataService.getMemoryEstimate();
        logger.info("Memory estimation for Bloom filter population:", estimate);

        if (estimate.estimatedMB > 100) {
            logger.warn(
                "Large dataset detected, consider using batch processing",
                {
                    estimatedMB: estimate.estimatedMB,
                    recommendedBatchSize: estimate.recommendedBatchSize,
                }
            );
        }
    } catch (error) {
        logger.warn("Could not get memory estimate", { error: error.message });
    }
}

/**
 * Main population function
 * @param {boolean} isStandalone - If true, manages its own connections and exits process
 */
async function populateBloomFilter(isStandalone = false) {
    const startTime = Date.now();

    try {
        logger.info("=".repeat(60));
        logger.info("Starting Bloom Filter Population");
        logger.info("=".repeat(60));

        // Only connect if running standalone (not called from main app)
        if (isStandalone) {
            logger.info("Connecting to database...");
            await database.connect();

            logger.info("Connecting to Redis...");
            await redis.connect();

            logger.info("Initializing Bloom filter...");
            await bloomFilterService.initialize();
        }

        // Log memory estimate
        await logMemoryEstimate();

        // Fetch and populate using the service
        const fetchPhones = async () => await userDataService.fetchAllPhones();
        const count = await bloomFilterService.populateFromDatabase(
            fetchPhones
        );

        const duration = Date.now() - startTime;
        const durationSeconds = (duration / 1000).toFixed(2);

        logger.info("=".repeat(60));
        logger.info("Bloom Filter Population Complete!");
        logger.info("=".repeat(60));
        logger.info(`Total phones added: ${count}`);
        logger.info(`Duration: ${durationSeconds}s`);
        logger.info(`Rate: ${(count / durationSeconds).toFixed(0)} phones/sec`);

        // Show Bloom filter stats
        const stats = bloomFilterService.getStats();
        logger.info("Bloom Filter Stats:", stats);

        // Only cleanup and exit if running standalone
        if (isStandalone) {
            await database.disconnect();
            await redis.disconnect();
            process.exit(0);
        }

        return count;
    } catch (error) {
        logger.error("Bloom filter population failed", {
            error: error.message,
            stack: error.stack,
        });

        // Only cleanup and exit if running standalone
        if (isStandalone) {
            try {
                await database.disconnect();
                await redis.disconnect();
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            process.exit(1);
        }

        throw error;
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    populateBloomFilter(true);
}

export default populateBloomFilter;
