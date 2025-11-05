/**
 * Booking Service
 * Orchestrates booking operations with Redis holds and DB transactions
 */

import { database, createLogger } from "@ev-platform/shared";
import bookingRedisService from "./booking-redis.service.js";
import connectorStatusService from "./connector-status.service.js";
import eventPublisherService from "./event-publisher.service.js";
import stationService from "./station.service.js";
import { Booking, Connector } from "../models/index.js";

const logger = createLogger("booking-service");

class BookingService {
    /**
     * Create a hold for a booking slot
     * @param {object} holdData - Hold data
     * @returns {Promise<{token: string, expiresIn: number}>}
     */
    async createHold(holdData) {
        const { stationId, connectorId, startTs, endTs, userId } = holdData;

        try {
            // Verify connector exists and is available
            const connector = await Connector.findById(connectorId);
            if (!connector || connector.station_id !== stationId) {
                throw new Error("Connector not found");
            }

            if (connector.status === "OFFLINE" || connector.status === "MAINTENANCE") {
                throw new Error("Connector is not available");
            }

            // Check for overlapping bookings
            const overlapping = await Booking.findOverlappingBookings(
                connectorId,
                new Date(startTs),
                new Date(endTs)
            );

            if (overlapping.length > 0) {
                throw new Error("Slot is already booked");
            }

            // Create hold in Redis (atomic)
            const hold = await bookingRedisService.createHold(
                connectorId,
                new Date(startTs).getTime() / 1000,
                new Date(endTs).getTime() / 1000,
                {
                    userId,
                    stationId,
                }
            );

            // Publish event
            await eventPublisherService.publishSlotHoldCreated(stationId, connectorId, {
                token: hold.token,
                startTs: Math.floor(new Date(startTs).getTime() / 1000),
                endTs: Math.floor(new Date(endTs).getTime() / 1000),
                expiresIn: hold.expiresIn,
            });

            // Invalidate availability cache
            await stationService.invalidateCache(stationId);

            return hold;
        } catch (error) {
            logger.error("Failed to create hold", {
                error: error.message,
                ...holdData,
            });
            throw error;
        }
    }

    /**
     * Confirm a booking from a hold
     * @param {object} confirmData - Confirmation data
     * @returns {Promise<object>} Created booking
     */
    async confirmBooking(confirmData) {
        const { holdToken, userId, paymentId } = confirmData;

        // Verify hold
        const hold = await bookingRedisService.verifyHold(holdToken);
        if (!hold) {
            throw new Error("Invalid or expired hold token");
        }

        // Verify user matches
        if (hold.userId && hold.userId !== userId.toString()) {
            throw new Error("Hold belongs to a different user");
        }

        const { stationId, connectorId, startTs, endTs } = hold;

        // Check for overlapping bookings again (race condition protection)
        const overlapping = await Booking.findOverlappingBookings(
                connectorId,
                new Date(startTs * 1000),
                new Date(endTs * 1000)
            );

        if (overlapping.length > 0) {
            // Release hold and throw error
            await bookingRedisService.releaseHold(holdToken);
            throw new Error("Slot is no longer available");
        }

        // Create booking in DB transaction
        let booking;
        try {
            booking = await database.transaction(async (client) => {
                const bookingResult = await client.query(
                    `INSERT INTO bookings (
                        user_id, station_id, connector_id,
                        start_ts, end_ts, hold_token,
                        payment_id, payment_status, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING *`,
                    [
                        userId,
                        stationId,
                        connectorId,
                        new Date(startTs * 1000),
                        new Date(endTs * 1000),
                        holdToken,
                        paymentId,
                        "AUTHORIZED",
                        "CONFIRMED",
                    ]
                );

                const newBooking = bookingResult.rows[0];

                // Update connector status
                await Connector.updateStatus(connectorId, "RESERVED", newBooking.id);

                // Update Redis connector status
                await connectorStatusService.updateConnectorStatus(stationId, connectorId, {
                    status: "RESERVED",
                    bookingId: newBooking.id,
                });

                return newBooking;
            });
        } catch (error) {
            // Release hold on failure
            await bookingRedisService.releaseHold(holdToken);
            logger.error("Failed to confirm booking", {
                error: error.message,
                holdToken,
            });
            throw error;
        }

        // Release hold (booking is confirmed)
        await bookingRedisService.releaseHold(holdToken);

        // Publish event
        await eventPublisherService.publishBookingConfirmed(stationId, booking.id, {
            connectorId,
            startTs: startTs,
            endTs: endTs,
            status: booking.status,
        });

        // Invalidate availability cache
        await stationService.invalidateCache(stationId);

        return booking;
    }

    /**
     * Cancel a booking
     * @param {string} bookingId - Booking ID
     * @param {number} userId - User ID (for authorization)
     * @returns {Promise<object>} Cancelled booking
     */
    async cancelBooking(bookingId, userId) {
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            throw new Error("Booking not found");
        }

        if (booking.user_id !== userId) {
            throw new Error("Unauthorized");
        }

        if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
            throw new Error("Booking cannot be cancelled");
        }

        // Update booking status
        const updated = await Booking.updateStatus(bookingId, "CANCELLED");

        // Update connector status
        if (booking.connector_id) {
            await Connector.updateStatus(booking.connector_id, "AVAILABLE", null);
            await connectorStatusService.updateConnectorStatus(
                booking.station_id,
                booking.connector_id,
                {
                    status: "AVAILABLE",
                    bookingId: null,
                }
            );
        }

        // Invalidate cache
        await stationService.invalidateCache(booking.station_id);

        return updated;
    }

    /**
     * Get user bookings
     * @param {number} userId - User ID
     * @param {object} options - Query options
     * @returns {Promise<Array>} Array of bookings
     */
    async getUserBookings(userId, options = {}) {
        return Booking.findByUserId(userId, options);
    }
}

export default new BookingService();

