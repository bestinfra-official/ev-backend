/**
 * Main Station Routes
 * Aggregates all station discovery-related routes
 */

import express from "express";
import stationRoutes from "./station.routes.js";

const router = express.Router();

// Mount station routes
router.use("/", stationRoutes);

export default router;
