/**
 * Vehicle Pairing Routes
 * All pairing-related endpoints for vehicle-device management
 */

import express from "express";
import { verifyToken, validate } from "@ev-platform/shared";
import { pairingSchema } from "../validation/schemas/pairing.schema.js";
import { pairedDevicesQuerySchema } from "../validation/schemas/paired-devices.schema.js";
import {
    pairVehicle,
    getPairedDevices,
} from "../controllers/pairing.controller.js";

const router = express.Router();

/**
 * POST /pair
 * Pair a vehicle with a device
 */
router.post("/pair", verifyToken, validate(pairingSchema), pairVehicle);

/**
 * GET /paired-devices
 * Get paired devices for the authenticated user
 */
router.get(
    "/paired-devices",
    verifyToken,
    validate(pairedDevicesQuerySchema),
    getPairedDevices
);

export default router;
