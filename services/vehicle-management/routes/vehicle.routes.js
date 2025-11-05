/**
 * Vehicle Routes
 * All vehicle-related endpoints
 */

import express from "express";
import { verifyToken, validate } from "@ev-platform/shared";
import { vehiclesQuerySchema } from "../validation/schemas/vehicle.schema.js";
import { getVehicles } from "../controllers/vehicle.controller.js";

const router = express.Router();

/**
 * GET /data/all-vehicles
 * Get vehicles for authenticated user
 */
router.get("/all", verifyToken, validate(vehiclesQuerySchema), getVehicles);

export default router;
