/**
 * Main Vehicle Routes
 * Aggregates all vehicle management-related routes
 */

import express from "express";
import pairingRoutes from "./pairing.routes.js";
import vehicleRoutes from "./vehicle.routes.js";

const router = express.Router();

// Mount all route modules
router.use("/", pairingRoutes);
router.use("/", vehicleRoutes);

export default router;
