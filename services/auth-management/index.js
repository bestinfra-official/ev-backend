import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import dotenv from "dotenv";
import {
    createLogger,
    database,
    redis,
    errorHandler,
    notFoundHandler,
    successResponse,
} from "@ev-platform/shared";
import authRoutesV1 from "./routes/auth.routes.js";
import otpQueueService from "./services/otp-queue.service.js";
import smsService from "./services/sms.service.js";
import bloomFilterService from "./services/bloom-filter.service.js";
import phoneVerificationService from "./services/phone-verification.service.js";
import { startWorker } from "./workers/otp.worker.js";

dotenv.config({ silent: true });

const app = express();
const PORT = parseInt(process.env.PORT || "7100");
const SERVICE_NAME = "auth-management";
const logger = createLogger(SERVICE_NAME);

// Middleware
app.use(
    helmet({
        contentSecurityPolicy: false, // Disable CSP for development
    })
);

// CORS configuration for development
app.use(
    cors({
        origin: true, // Allow all origins in development
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Version"],
    })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Configure multer for form-data support
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5, // Maximum 5 files
        fields: 20, // Maximum 20 fields
        fieldNameSize: 100, // Maximum field name size
        fieldSize: 1024 * 1024, // 1MB field value limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types for authentication (documents, images)
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
    },
});

// Apply multer middleware for form-data support
app.use(upload.any());

// API Routes - V1 (Stable)
app.use("/v1", authRoutesV1);

app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Connect to database
        await database.connect();
        logger.info("Database connected");

        // Connect to Redis (required for OTP system)
        await redis.connect();
        logger.info("Redis connected");

        // Initialize OTP queue service
        await otpQueueService.initialize();
        logger.info("OTP Queue service initialized");

        // Initialize SMS service with providers
        await smsService.initialize();
        logger.info("SMS service initialized");

        // Start OTP worker (if enabled)
        if (process.env.ENABLE_OTP_WORKER !== "false") {
            logger.info("Starting OTP worker...");
            await startWorker();
            logger.info("OTP Worker started");
        } else {
            logger.info("OTP Worker disabled via ENABLE_OTP_WORKER=false");
        }

        // Initialize Bloom filter for phone verification
        // This is critical for high-scale operations (1M+ requests/min)
        logger.info("Initializing Bloom filter for phone verification...");
        await bloomFilterService.initialize();

        // Auto-populate Bloom filter if enabled and not already populated
        if (process.env.BLOOM_AUTO_POPULATE === "true") {
            const stats = bloomFilterService.getStats();
            // if (!stats.lastRefresh) {
            logger.info(
                "Bloom filter not populated, running initial population..."
            );
            try {
                // Import population script
                const { default: populateBloomFilter } = await import(
                    "./scripts/populate-bloom-filter.js"
                );
                // Note: This runs in background, doesn't block startup
                populateBloomFilter().catch((err) => {
                    logger.error("Background Bloom filter population failed", {
                        error: err.message,
                    });
                });
            } catch (err) {
                logger.warn("Could not auto-populate Bloom filter", {
                    error: err.message,
                    hint: "Run manually: node scripts/populate-bloom-filter.js",
                });
            }
            // } else {
            //     logger.info("Bloom filter already populated", {
            //         lastRefresh: stats.lastRefresh,
            //         age: stats.lastRefreshAge,
            //     });
            // }
        }

        logger.info("Phone verification system initialized");

        app.listen(PORT, () => {
            logger.info(`${SERVICE_NAME} service running on port ${PORT}`);
            logger.info("High-performance phone verification enabled", {
                cacheEnabled: true,
                bloomFilterEnabled: true,
                antiEnumeration:
                    process.env.SECURITY_ANTI_ENUMERATION !== "false",
                otpWorkerEnabled: process.env.ENABLE_OTP_WORKER !== "false",
            });
        });
    } catch (error) {
        logger.error("Failed to start server", { error: error.message });
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    logger.info("Shutting down gracefully...");

    // Close queue connections
    await otpQueueService.close();
    logger.info("Queue closed");

    // Disconnect from database and Redis
    await database.disconnect();
    await redis.disconnect();

    logger.info("Shutdown complete");
    process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the server
startServer();
