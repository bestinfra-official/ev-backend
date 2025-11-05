/**
 * Booking Model
 * Handles booking data operations
 */

import { database } from "@ev-platform/shared";

class BookingModel {
    /**
     * Find booking by ID
     * @param {string} id - Booking ID
     * @returns {Promise<object|null>} Booking object or null
     */
    async findById(id) {
        const result = await database.query(
            `SELECT
                b.id, b.user_id, b.station_id, b.connector_id,
                b.start_ts, b.end_ts, b.status,
                b.hold_token, b.payment_id, b.payment_status,
                b.vendor_booking_id, b.vendor_sync_status,
                b.metadata, b.created_at, b.updated_at,
                c.connector_number, c.connector_type, c.power_kw,
                s.name as station_name, s.address as station_address
            FROM bookings b
            JOIN connectors c ON b.connector_id = c.id
            JOIN charging_stations s ON b.station_id = s.id
            WHERE b.id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Find booking by hold token
     * @param {string} holdToken - Hold token
     * @returns {Promise<object|null>} Booking object or null
     */
    async findByHoldToken(holdToken) {
        const result = await database.query(
            `SELECT
                id, user_id, station_id, connector_id,
                start_ts, end_ts, status,
                hold_token, payment_id, payment_status,
                vendor_booking_id, vendor_sync_status,
                metadata, created_at, updated_at
            FROM bookings
            WHERE hold_token = $1`,
            [holdToken]
        );

        return result.rows[0] || null;
    }

    /**
     * Find bookings for a user
     * @param {number} userId - User ID
     * @param {object} options - Query options
     * @returns {Promise<Array>} Array of bookings
     */
    async findByUserId(userId, options = {}) {
        const { limit = 50, offset = 0, status } = options;
        let query = `SELECT
                b.id, b.user_id, b.station_id, b.connector_id,
                b.start_ts, b.end_ts, b.status,
                b.hold_token, b.payment_id, b.payment_status,
                b.vendor_booking_id, b.vendor_sync_status,
                b.metadata, b.created_at, b.updated_at,
                c.connector_number, c.connector_type, c.power_kw,
                s.name as station_name, s.address as station_address
            FROM bookings b
            JOIN connectors c ON b.connector_id = c.id
            JOIN charging_stations s ON b.station_id = s.id
            WHERE b.user_id = $1`;
        const params = [userId];

        if (status) {
            query += ` AND b.status = $2`;
            params.push(status);
        }

        query += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await database.query(query, params);
        return result.rows;
    }

    /**
     * Check for overlapping bookings on a connector
     * @param {string} connectorId - Connector ID
     * @param {Date} startTs - Start timestamp
     * @param {Date} endTs - End timestamp
     * @param {string} excludeBookingId - Booking ID to exclude from check
     * @returns {Promise<Array>} Array of conflicting bookings
     */
    async findOverlappingBookings(connectorId, startTs, endTs, excludeBookingId = null) {
        let query = `SELECT
                id, user_id, connector_id,
                start_ts, end_ts, status
            FROM bookings
            WHERE connector_id = $1
                AND status IN ('PENDING', 'CONFIRMED', 'ACTIVE')
                AND tsrange(start_ts, end_ts) && tsrange($2, $3)`;
        const params = [connectorId, startTs, endTs];

        if (excludeBookingId) {
            query += ` AND id != $4`;
            params.push(excludeBookingId);
        }

        const result = await database.query(query, params);
        return result.rows;
    }

    /**
     * Create a new booking
     * @param {object} bookingData - Booking data
     * @returns {Promise<object>} Created booking
     */
    async create(bookingData) {
        const {
            userId,
            stationId,
            connectorId,
            startTs,
            endTs,
            holdToken,
            paymentId,
            paymentStatus = "PENDING",
            metadata = {},
        } = bookingData;

        const result = await database.query(
            `INSERT INTO bookings (
                user_id, station_id, connector_id,
                start_ts, end_ts, hold_token,
                payment_id, payment_status, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING
                id, user_id, station_id, connector_id,
                start_ts, end_ts, status,
                hold_token, payment_id, payment_status,
                vendor_booking_id, vendor_sync_status,
                metadata, created_at, updated_at`,
            [
                userId,
                stationId,
                connectorId,
                startTs,
                endTs,
                holdToken,
                paymentId,
                paymentStatus,
                JSON.stringify(metadata),
            ]
        );

        return result.rows[0];
    }

    /**
     * Update booking status
     * @param {string} id - Booking ID
     * @param {string} status - New status
     * @param {object} updates - Additional updates
     * @returns {Promise<object>} Updated booking
     */
    async updateStatus(id, status, updates = {}) {
        const fields = ["status = $1"];
        const params = [status];

        if (updates.paymentStatus) {
            fields.push(`payment_status = $${params.length + 1}`);
            params.push(updates.paymentStatus);
        }

        if (updates.vendorBookingId) {
            fields.push(`vendor_booking_id = $${params.length + 1}`);
            params.push(updates.vendorBookingId);
        }

        if (updates.vendorSyncStatus) {
            fields.push(`vendor_sync_status = $${params.length + 1}`);
            params.push(updates.vendorSyncStatus);
        }

        fields.push(`updated_at = NOW()`);
        params.push(id);

        const result = await database.query(
            `UPDATE bookings
            SET ${fields.join(", ")}
            WHERE id = $${params.length}
            RETURNING
                id, user_id, station_id, connector_id,
                start_ts, end_ts, status,
                hold_token, payment_id, payment_status,
                vendor_booking_id, vendor_sync_status,
                metadata, created_at, updated_at`,
            params
        );

        return result.rows[0];
    }

    /**
     * Find no-show bookings (confirmed but past start time)
     * @param {number} gracePeriodMinutes - Grace period in minutes
     * @returns {Promise<Array>} Array of no-show bookings
     */
    async findNoShowBookings(gracePeriodMinutes = 15) {
        const result = await database.query(
            `SELECT
                id, user_id, station_id, connector_id,
                start_ts, end_ts, status
            FROM bookings
            WHERE status = 'CONFIRMED'
                AND start_ts + interval '${gracePeriodMinutes} minutes' < NOW()
                AND start_ts > NOW() - interval '1 hour'`,
            []
        );

        return result.rows;
    }
}

export const Booking = new BookingModel();

