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
    asyncHandler,
} from "@ev-platform/shared";

dotenv.config({ silent: true });

const app = express();
const PORT = parseInt(process.env.PORT || "7107");
const SERVICE_NAME = "charging-session";
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
            "Charging Session Service"
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

// Example route - Start charging session
v1Router.post(
    "/sessions/start",
    verifyToken,
    asyncHandler(async (req, res) => {
        const userId = req.userId;
        const { stationId, vehicleId } = req.body;

        // TODO: Start charging session

        res.status(201).json(
            successResponse(
                { userId, stationId, vehicleId, status: "active" },
                "Charging session started"
            )
        );
    })
);

// Example route - Stop charging session
v1Router.post(
    "/sessions/:sessionId/stop",
    verifyToken,
    asyncHandler(async (req, res) => {
        const { sessionId } = req.params;

        // TODO: Stop charging session

        res.json(
            successResponse(
                { sessionId, status: "completed" },
                "Charging session stopped"
            )
        );
    })
);

// Example route - Get active session
v1Router.get(
    "/sessions/active",
    verifyToken,
    asyncHandler(async (req, res) => {
        const userId = req.userId;

        // TODO: Get active session from database

        res.json(successResponse(null, "No active session"));
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
