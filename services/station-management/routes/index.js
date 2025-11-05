/**
 * Main Station Routes
 * Aggregates all station discovery-related routes
 */

import express from "express";
import stationRoutes from "./station.routes.js";
import bookingRoutes from "./booking.routes.js";
import vendorRoutes from "./vendor.routes.js";
import { createLogger } from "@ev-platform/shared";

const router = express.Router();
const logger = createLogger("station-routes");

// Mount station discovery routes
router.use("/", stationRoutes);

// Mount booking routes
router.use("/bookings", bookingRoutes);

// Mount vendor integration routes
router.use("/vendor", vendorRoutes);

export default router;
