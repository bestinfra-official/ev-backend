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
const PORT = parseInt(process.env.PORT || "7101");
const SERVICE_NAME = "vehicle-management";
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
            "Vehicle Management Service"
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

// Example protected route
v1Router.get(
    "/vehicles",
    verifyToken,
    asyncHandler(async (req, res) => {
        // TODO: Get vehicles from database
        const vehicles = []; // Replace with actual query

        res.json(successResponse(vehicles, "Vehicles retrieved successfully"));
    })
);

// Example route to add vehicle
v1Router.post(
    "/vehicles",
    verifyToken,
    asyncHandler(async (req, res) => {
        // TODO: Add vehicle validation and save to database
        const { make, model, year, vin } = req.body;

        res.status(201).json(
            successResponse(
                { make, model, year, vin },
                "Vehicle added successfully"
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
