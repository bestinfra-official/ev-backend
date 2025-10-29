/**
 * Main Station Routes
 * Aggregates all station discovery-related routes
 */

import express from "express";
import stationRoutes from "./station.routes.js";
import { createLogger } from "@ev-platform/shared";

const router = express.Router();
const logger = createLogger("station-routes");

// Mount station routes
router.use("/", stationRoutes);

router.post("/test", (req, res) => {
    console.log("🔴 [Test Route] Handler called!");
    console.log("🔴 [Test Route] Request body:", req.body);
    logger.info("Test route handler called", { body: req.body });

    res.status(200).json({
        success: true,
        message: "Test POST route successful",
        receivedData: req.body,
    });
});

export default router;
