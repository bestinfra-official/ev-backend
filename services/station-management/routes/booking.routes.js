/**
 * Booking Routes
 * Routes for booking management
 */

import express from "express";
import {
    createHold,
    confirmBooking,
    cancelBooking,
    getUserBookings,
} from "../controllers/booking.controller.js";
import {
    createHoldSchema,
    confirmBookingSchema,
} from "../validation/schemas/station.schema.js";
import { verifyToken, validate } from "@ev-platform/shared";

const router = express.Router();

/**
 * POST /bookings/holds
 * Create a hold for a booking slot
 */
router.post(
    "/holds",
    verifyToken,
    validate(createHoldSchema),
    createHold
);

/**
 * POST /bookings/confirm
 * Confirm a booking from a hold
 */
router.post(
    "/confirm",
    verifyToken,
    validate(confirmBookingSchema),
    confirmBooking
);

/**
 * POST /bookings/:id/cancel
 * Cancel a booking
 */
router.post("/:id/cancel", verifyToken, cancelBooking);

/**
 * GET /bookings
 * Get user bookings
 */
router.get("/", verifyToken, getUserBookings);

export default router;

