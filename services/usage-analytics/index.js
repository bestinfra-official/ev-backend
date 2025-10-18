import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import {
    createLogger,
    database,
    errorHandler,
    notFoundHandler,
    successResponse,
    verifyToken,
    requireRole,
    asyncHandler,
} from "@ev-platform/shared";

dotenv.config({ silent: true });

const app = express();
const PORT = parseInt(process.env.PORT || "7109");
const SERVICE_NAME = "usage-analytics";
const logger = createLogger(SERVICE_NAME);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

// Routes
app.get("/", (req, res) => {
    res.json(
        successResponse(
            {
                service: SERVICE_NAME,
                port: PORT,
                environment: process.env.NODE_ENV || "development",
                versions: ["v1"],
                endpoints: {
                    v1: "/v1",
                    health: "/health",
                },
            },
            "Usage Analytics Service"
        )
    );
});

app.get("/health", async (req, res) => {
    const dbStats = database.getStats();

    res.json(
        successResponse({
            service: SERVICE_NAME,
            status: "healthy",
            database: dbStats
                ? {
                      connected: true,
                      ...dbStats,
                  }
                : { connected: false },
        })
    );
});

// V1 API routes
const v1Router = express.Router();

// Example route - Get user analytics
v1Router.get(
    "/analytics/user",
    verifyToken,
    asyncHandler(async (req, res) => {
        const userId = req.userId;

        // TODO: Get user analytics from database
        const analytics = {
            totalSessions: 0,
            totalEnergy: 0,
            totalCost: 0,
        };

        res.json(
            successResponse(analytics, "User analytics retrieved successfully")
        );
    })
);

// Example route - Get platform analytics (admin only)
v1Router.get(
    "/analytics/platform",
    verifyToken,
    requireRole("admin"),
    asyncHandler(async (req, res) => {
        // TODO: Get platform-wide analytics

        const analytics = {
            totalUsers: 0,
            totalStations: 0,
            activeSessions: 0,
            revenue: 0,
        };

        res.json(
            successResponse(
                analytics,
                "Platform analytics retrieved successfully"
            )
        );
    })
);

// Mount v1 routes
app.use("/v1", v1Router);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Connect to database
        await database.connect();
        logger.info("Database connected");

        app.listen(PORT, () => {
            logger.info(`${SERVICE_NAME} service running on port ${PORT}`);
        });
    } catch (error) {
        logger.error("Failed to start server", { error: error.message });
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    logger.info("Shutting down gracefully...");
    await database.disconnect();
    process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start the server
startServer();
