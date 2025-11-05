/**
 * Booking Controller
 * Handles booking-related endpoints
 */

import {
    createLogger,
    successResponse,
    errorResponse,
    asyncHandler,
} from "@ev-platform/shared";
import bookingService from "../services/booking.service.js";

const logger = createLogger("booking-controller");

/**
 * Create a hold for a booking slot
 * POST /bookings/holds
 */
export const createHold = asyncHandler(async (req, res) => {
    const { stationId, connectorId, startTs, endTs } = req.body;
    const userId = req.user?.id || req.userId; // From JWT middleware

    if (!userId) {
        return res.status(401).json(errorResponse("Unauthorized", "UNAUTHORIZED"));
    }

    try {
        const hold = await bookingService.createHold({
            stationId,
            connectorId,
            startTs,
            endTs,
            userId,
        });

        return res.status(201).json(
            successResponse(
                {
                    token: hold.token,
                    expiresIn: hold.expiresIn,
                },
                "Hold created successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to create hold", {
            error: error.message,
            userId,
            stationId,
            connectorId,
        });

        if (error.message.includes("not available") || error.message.includes("already booked")) {
            return res
                .status(409)
                .json(errorResponse(error.message, "SLOT_UNAVAILABLE"));
        }

        return res
            .status(500)
            .json(errorResponse("Failed to create hold", "INTERNAL_ERROR"));
    }
});

/**
 * Confirm a booking from a hold
 * POST /bookings/confirm
 */
export const confirmBooking = asyncHandler(async (req, res) => {
    const { holdToken, paymentId } = req.body;
    const userId = req.user?.id || req.userId;

    if (!userId) {
        return res.status(401).json(errorResponse("Unauthorized", "UNAUTHORIZED"));
    }

    try {
        const booking = await bookingService.confirmBooking({
            holdToken,
            userId,
            paymentId,
        });

        return res.status(201).json(
            successResponse(
                {
                    id: booking.id,
                    stationId: booking.station_id,
                    connectorId: booking.connector_id,
                    startTs: booking.start_ts,
                    endTs: booking.end_ts,
                    status: booking.status,
                },
                "Booking confirmed successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to confirm booking", {
            error: error.message,
            userId,
            holdToken,
        });

        if (
            error.message.includes("Invalid") ||
            error.message.includes("expired") ||
            error.message.includes("no longer available")
        ) {
            return res
                .status(400)
                .json(errorResponse(error.message, "INVALID_HOLD"));
        }

        return res
            .status(500)
            .json(errorResponse("Failed to confirm booking", "INTERNAL_ERROR"));
    }
});

/**
 * Cancel a booking
 * POST /bookings/:id/cancel
 */
export const cancelBooking = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id || req.userId;

    if (!userId) {
        return res.status(401).json(errorResponse("Unauthorized", "UNAUTHORIZED"));
    }

    try {
        const booking = await bookingService.cancelBooking(id, userId);

        return res.status(200).json(
            successResponse(
                {
                    id: booking.id,
                    status: booking.status,
                },
                "Booking cancelled successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to cancel booking", {
            error: error.message,
            userId,
            bookingId: id,
        });

        if (error.message.includes("not found")) {
            return res.status(404).json(errorResponse(error.message, "NOT_FOUND"));
        }

        if (error.message.includes("Unauthorized")) {
            return res.status(403).json(errorResponse(error.message, "UNAUTHORIZED"));
        }

        if (error.message.includes("cannot be cancelled")) {
            return res.status(400).json(errorResponse(error.message, "INVALID_STATE"));
        }

        return res
            .status(500)
            .json(errorResponse("Failed to cancel booking", "INTERNAL_ERROR"));
    }
});

/**
 * Get user bookings
 * GET /bookings
 */
export const getUserBookings = asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    if (!userId) {
        return res.status(401).json(errorResponse("Unauthorized", "UNAUTHORIZED"));
    }

    try {
        const bookings = await bookingService.getUserBookings(userId, {
            status,
            limit: parseInt(limit),
            offset: parseInt(offset),
        });

        return res.status(200).json(
            successResponse(
                {
                    bookings,
                    total: bookings.length,
                },
                "Bookings fetched successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to get user bookings", {
            error: error.message,
            userId,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to fetch bookings", "INTERNAL_ERROR"));
    }
});

