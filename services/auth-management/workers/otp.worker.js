/**
 * BullMQ Worker for OTP SMS Processing
 * Standalone process for sending SMS via MSG91
 * Horizontally scalable - run multiple instances for high throughput
 *
 * Usage: node workers/otp.worker.js or npm run worker
 * For production: PM2 or Kubernetes deployment with autoscaling
 */

import { Worker, Job } from "bullmq";
import dotenv from "dotenv";
import { createLogger, redis } from "@ev-platform/shared";
import smsService from "../services/sms.service.js";
import { OtpAudit } from "../models/index.js";

dotenv.config({ silent: true });

const logger = createLogger("otp-worker");

const QUEUE_NAME = process.env.OTP_QUEUE_NAME || "otp-send-queue";
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "10");
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

/**
 * Process OTP send job
 * @param {Job} job - BullMQ job
 */
async function processOtpJob(job) {
    const { phone, otp, requestId, ip } = job.data;
    const startTime = Date.now();

    logger.info(`Processing OTP job`, {
        jobId: job.id,
        phone,
        requestId,
        workerId: WORKER_ID,
        attempt: job.attemptsMade + 1,
    });

    try {
        // Update job progress
        await job.updateProgress(10);

        // Validate job data
        if (!phone || !otp) {
            throw new Error("Invalid job data: missing required fields");
        }

        await job.updateProgress(20);

        // Send SMS via multi-provider service with failover
        // Note: SMS service uses templates, so message parameter is not needed
        const result = await smsService.sendSms(phone, otp);

        await job.updateProgress(80);


        await job.updateProgress(100);

        const totalDuration = Date.now() - startTime;
        logger.info(`OTP job completed successfully`, {
            jobId: job.id,
            phone,
            provider: result.provider,
            messageId: result.messageId,
            duration: `${totalDuration}ms`,
            workerId: WORKER_ID,
        });

        return {
            success: true,
            provider: result.provider,
            messageId: result.messageId,
            duration: totalDuration,
            workerId: WORKER_ID,
        };
    } catch (error) {
        const duration = Date.now() - startTime;

        logger.error(`OTP job failed`, {
            jobId: job.id,
            phone,
            error: error.message,
            attempt: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts,
            duration: `${duration}ms`,
            workerId: WORKER_ID,
        });

        // Create audit log for failed send
        await OtpAudit.create({
            phone,
            eventType: "sent_failed",
            provider: error.provider || null,
            providerResponse: {
                requestId,
                jobId: job.id,
                error: error.message,
                errorCode: error.code,
                attempt: job.attemptsMade + 1,
                duration,
                workerId: WORKER_ID,
            },
            ip,
        });

        // Re-throw to let BullMQ handle retry logic
        throw error;
    }
}

/**
 * Initialize and start worker
 */
async function startWorker() {
    try {
        // Connect to Redis
        await redis.connect();
        logger.info("Redis connected");

        // Initialize SMS service
        await smsService.initialize();
        logger.info("SMS service initialized");

        // Get Redis connection config
        const redisClient = redis.getClient();
        const connection = {
            host: redisClient.options.host,
            port: redisClient.options.port,
            password: redisClient.options.password,
            db: redisClient.options.db || 0,
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
        };

        // Create worker
        const worker = new Worker(QUEUE_NAME, processOtpJob, {
            connection,
            concurrency: WORKER_CONCURRENCY,
            limiter: {
                max: parseInt(process.env.WORKER_RATE_LIMIT_MAX || "100"),
                duration: parseInt(
                    process.env.WORKER_RATE_LIMIT_DURATION || "1000"
                ),
            },
            // Advanced settings for high throughput
            settings: {
                lockDuration: 30000, // 30 seconds
                stalledInterval: 30000,
                maxStalledCount: 2,
            },
        });

        // Worker event handlers
        worker.on("completed", (job, result) => {
            logger.debug(`Job ${job.id} completed`, {
                result,
                workerId: WORKER_ID,
            });
        });

        worker.on("failed", (job, error) => {
            logger.error(`Job ${job?.id} failed`, {
                error: error.message,
                attemptsMade: job?.attemptsMade,
                workerId: WORKER_ID,
            });
        });

        worker.on("error", (error) => {
            logger.error("Worker error", {
                error: error.message,
                workerId: WORKER_ID,
            });
        });

        worker.on("stalled", (jobId) => {
            logger.warn(`Job ${jobId} stalled`, { workerId: WORKER_ID });
        });

        // Graceful shutdown
        const shutdown = async (signal) => {
            logger.info(`${signal} received, shutting down gracefully...`, {
                workerId: WORKER_ID,
            });

            try {
                // Close worker (waits for active jobs to complete)
                await worker.close();
                logger.info("Worker closed");

                // Disconnect from Redis
                await redis.disconnect();

                logger.info("Shutdown complete");
                process.exit(0);
            } catch (error) {
                logger.error("Error during shutdown", {
                    error: error.message,
                });
                process.exit(1);
            }
        };

        process.on("SIGTERM", () => shutdown("SIGTERM"));
        process.on("SIGINT", () => shutdown("SIGINT"));

        logger.info(`OTP Worker started`, {
            workerId: WORKER_ID,
            queue: QUEUE_NAME,
            concurrency: WORKER_CONCURRENCY,
            pid: process.pid,
        });

        // Health check endpoint (optional - can be served via HTTP in production)
        setInterval(async () => {
            const metrics = {
                workerId: WORKER_ID,
                pid: process.pid,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString(),
            };
            logger.debug("Worker health check", metrics);
        }, 60000); // Every minute
    } catch (error) {
        logger.error("Failed to start worker", {
            error: error.message,
            stack: error.stack,
            workerId: WORKER_ID,
        });
        process.exit(1);
    }
}

// Export the startWorker function for external use
export { startWorker };

// Handle uncaught errors
process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection", {
        reason,
        promise,
        workerId: WORKER_ID,
    });
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", {
        error: error.message,
        stack: error.stack,
        workerId: WORKER_ID,
    });
    process.exit(1);
});

// If this file is run directly, start the worker
if (import.meta.url === `file://${process.argv[1]}`) {
    startWorker();
}
