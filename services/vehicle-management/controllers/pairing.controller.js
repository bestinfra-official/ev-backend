/**
 * Vehicle Pairing Controller
 * Handles all vehicle pairing operations including pairing and listing
 */

import {
    createLogger,
    successResponse,
    errorResponse,
    asyncHandler,
} from "@ev-platform/shared";
import pairingService from "../services/pairing.service.js";

const logger = createLogger("vehicle-pairing");

/**
 * Pair a vehicle with a device
 * POST /pair
 */
export const pairVehicle = asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.user?.userId;
    const idempotencyKey =
        req.headers["idempotency-key"] || req.headers["idempotency_key"];

    const {
        chassis_number,
        reg_number,
        bluetooth_mac,
        vehicle_static = {},
    } = req.body;

    if (!userId) {
        return res
            .status(401)
            .json(
                errorResponse("User authentication required", "UNAUTHORIZED")
            );
    }

    try {
        const pairingResult = await pairingService.pairVehicle({
            userId,
            chassisNumber: chassis_number,
            regNumber: reg_number,
            bluetoothMac: bluetooth_mac,
            vehicleStatic: vehicle_static,
            idempotencyKey,
        });

        return res.status(201).json(
            successResponse(
                {
                    paired_device_id: pairingResult.pairedDeviceId,
                    vehicle_id: pairingResult.vehicleId,
                    message: "Vehicle paired successfully",
                    paired_devices_count: pairingResult.pairedDevicesCount,
                },
                "Pairing completed successfully"
            )
        );
    } catch (error) {
        logger.error("Vehicle pairing failed", {
            error: error.message,
            stack: error.stack,
        });

        // Handle specific errors
        if (error.message.includes("Resource is locked")) {
            return res
                .status(503)
                .json(
                    errorResponse(
                        "Resource is locked, please try again",
                        "RESOURCE_LOCKED"
                    )
                );
        }

        if (error.message.includes("unique constraint")) {
            return res
                .status(409)
                .json(
                    errorResponse(
                        "Vehicle or device already exists",
                        "CONFLICT"
                    )
                );
        }

        if (error.message.includes("violates foreign key")) {
            return res
                .status(400)
                .json(
                    errorResponse(
                        "Invalid user or vehicle reference",
                        "INVALID_REFERENCE"
                    )
                );
        }

        throw error; // Let asyncHandler handle generic errors
    }
});

/**
 * Get paired devices for the authenticated user
 * GET /paired-devices
 */
export const getPairedDevices = asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
        return res
            .status(401)
            .json(
                errorResponse("User authentication required", "UNAUTHORIZED")
            );
    }

    const { active, include, limit, cursor, sort } = req.query;

    try {
        const result = await pairingService.getPairedDevices({
            userId,
            active,
            include,
            limit,
            cursor,
            sort,
        });

        res.set({
            "Cache-Control": "private, max-age=0",
            "X-Total-Active": result.total_active.toString(),
            "X-Total-All": result.total_all.toString(),
        });

        return res
            .status(200)
            .json(
                successResponse(result, "Paired devices retrieved successfully")
            );
    } catch (error) {
        logger.error("Failed to get paired devices", {
            error: error.message,
            stack: error.stack,
            userId,
        });

        // Handle specific errors
        if (error.message.includes("invalid cursor")) {
            return res
                .status(400)
                .json(
                    errorResponse("Invalid pagination cursor", "INVALID_CURSOR")
                );
        }

        if (error.message.includes("rate limit")) {
            return res
                .status(429)
                .json(errorResponse("Too many requests", "RATE_LIMITED"));
        }

        throw error; // Let asyncHandler handle generic errors
    }
});
