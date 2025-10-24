/**
 * BullMQ Queue Service for OTP Processing
 * Handles queueing and processing of OTP SMS jobs
 * Designed for high throughput (16k+ jobs/second)
 */

import { Queue, QueueEvents } from "bullmq";
import { createLogger, redis } from "@ev-platform/shared";

const logger = createLogger("otp-queue-service");

const QUEUE_NAME = process.env.OTP_QUEUE_NAME || "otp-send-queue";
const QUEUE_CONFIG = {
    // Job configuration
    defaultJobOptions: {
        attempts: parseInt(process.env.OTP_JOB_ATTEMPTS || "5"),
        backoff: {
            type: "exponential",
            delay: parseInt(process.env.OTP_JOB_BACKOFF_DELAY || "2000"),
        },
        removeOnComplete: {
            age: 3600, // Keep completed jobs for 1 hour
            count: 1000, // Keep max 1000 completed jobs
        },
        removeOnFail: {
            age: 86400, // Keep failed jobs for 24 hours
        },
        timeout: parseInt(process.env.OTP_JOB_TIMEOUT || "30000"), // 30 seconds
    },

    // Rate limiter configuration (optional, to control outbound rate)
    limiter:
        process.env.OTP_QUEUE_RATE_LIMIT_ENABLED === "true"
            ? {
                  max: parseInt(process.env.OTP_QUEUE_RATE_LIMIT_MAX || "1000"), // Max jobs per duration
                  duration: parseInt(
                      process.env.OTP_QUEUE_RATE_LIMIT_DURATION || "1000"
                  ), // Duration in ms
              }
            : undefined,
};

class OTPQueueService {
    constructor() {
        this.queue = null;
        this.queueEvents = null;
        this.initialized = false;
    }

    /**
     * Initialize the queue
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Get Redis connection from shared config
            const redisClient = redis.getClient();

            // Create connection config for BullMQ
            const connection = {
                host: redisClient.options.host,
                port: redisClient.options.port,
                password: redisClient.options.password,
                db: redisClient.options.db || 0,
                maxRetriesPerRequest: null, // Required for BullMQ
                enableReadyCheck: false,
            };

            // Initialize queue
            this.queue = new Queue(QUEUE_NAME, {
                connection,
                defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
                ...(QUEUE_CONFIG.limiter && { limiter: QUEUE_CONFIG.limiter }),
            });

            // Initialize queue events for monitoring
            this.queueEvents = new QueueEvents(QUEUE_NAME, { connection });

            // Set up event listeners
            this._setupEventListeners();

            this.initialized = true;
            logger.info(`OTP Queue initialized: ${QUEUE_NAME}`);
        } catch (error) {
            logger.error("Failed to initialize OTP queue", {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Set up event listeners for monitoring
     * @private
     */
    _setupEventListeners() {
        // Job completed
        this.queueEvents.on("completed", ({ jobId, returnvalue }) => {
            logger.debug(`Job ${jobId} completed`, { returnvalue });
        });

        // Job failed
        this.queueEvents.on("failed", ({ jobId, failedReason }) => {
            logger.error(`Job ${jobId} failed`, { failedReason });
        });

        // Job progress
        this.queueEvents.on("progress", ({ jobId, data }) => {
            logger.debug(`Job ${jobId} progress`, { data });
        });

        // Queue error
        this.queue.on("error", (error) => {
            logger.error("Queue error", { error: error.message });
        });
    }

    /**
     * Add OTP send job to queue
     * @param {object} jobData - Job data
     * @param {string} jobData.phone - Phone number
     * @param {string} jobData.otp - OTP code (plaintext, encrypted in Redis)
     * @param {string} jobData.message - SMS message
     * @param {string} jobData.requestId - Request tracking ID
     * @param {string} jobData.ip - User IP address
     * @param {object} options - Job options (optional)
     * @returns {Promise<object>} Job info
     */
    async addSendOtpJob(jobData, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        logger.info(jobData, "JOB DATA");

        try {
            const job = await this.queue.add("send-otp", jobData, {
                ...QUEUE_CONFIG.defaultJobOptions,
                ...options,
                // Use phone as job ID for deduplication (optional)
                jobId: options.jobId || `otp_${jobData.phone}_${Date.now()}`,
            });

            logger.info(`OTP send job queued`, {
                jobId: job.id,
                phone: jobData.phone,
                requestId: jobData.requestId,
            });

            return {
                jobId: job.id,
                name: job.name,
                data: job.data,
            };
        } catch (error) {
            logger.error("Failed to add job to queue", {
                error: error.message,
                phone: jobData.phone,
            });
            throw new Error("Failed to queue OTP send job");
        }
    }

    /**
     * Close queue connections
     */
    async close() {
        if (!this.initialized) return;

        try {
            await Promise.all([this.queue?.close(), this.queueEvents?.close()]);

            this.initialized = false;
            logger.info("Queue closed");
        } catch (error) {
            logger.error("Failed to close queue", { error: error.message });
        }
    }
}

// Export singleton instance
const otpQueueService = new OTPQueueService();
export default otpQueueService;
