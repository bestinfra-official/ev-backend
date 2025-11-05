/**
 * Session Model
 * Handles charging session data operations
 */

import { database } from "@ev-platform/shared";

class SessionModel {
    /**
     * Find session by ID
     * @param {string} id - Session ID
     * @returns {Promise<object|null>} Session object or null
     */
    async findById(id) {
        const result = await database.query(
            `SELECT
                id, booking_id, user_id, station_id, connector_id,
                started_at, ended_at, energy_kwh,
                start_meter_reading, end_meter_reading,
                duration_minutes, cost_amount, cost_currency,
                status, vendor_session_id, meter_data,
                created_at, updated_at
            FROM charging_sessions
            WHERE id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Find session by booking ID
     * @param {string} bookingId - Booking ID
     * @returns {Promise<object|null>} Session object or null
     */
    async findByBookingId(bookingId) {
        const result = await database.query(
            `SELECT
                id, booking_id, user_id, station_id, connector_id,
                started_at, ended_at, energy_kwh,
                start_meter_reading, end_meter_reading,
                duration_minutes, cost_amount, cost_currency,
                status, vendor_session_id, meter_data,
                created_at, updated_at
            FROM charging_sessions
            WHERE booking_id = $1
            ORDER BY created_at DESC
            LIMIT 1`,
            [bookingId]
        );

        return result.rows[0] || null;
    }

    /**
     * Find active session for a connector
     * @param {string} connectorId - Connector ID
     * @returns {Promise<object|null>} Active session or null
     */
    async findActiveByConnectorId(connectorId) {
        const result = await database.query(
            `SELECT
                id, booking_id, user_id, station_id, connector_id,
                started_at, ended_at, energy_kwh,
                start_meter_reading, end_meter_reading,
                duration_minutes, cost_amount, cost_currency,
                status, vendor_session_id, meter_data,
                created_at, updated_at
            FROM charging_sessions
            WHERE connector_id = $1
                AND status IN ('STARTING', 'CHARGING', 'STOPPING')
            ORDER BY started_at DESC
            LIMIT 1`,
            [connectorId]
        );

        return result.rows[0] || null;
    }

    /**
     * Create a new session
     * @param {object} sessionData - Session data
     * @returns {Promise<object>} Created session
     */
    async create(sessionData) {
        const {
            bookingId,
            userId,
            stationId,
            connectorId,
            startMeterReading,
            vendorSessionId,
            meterData = {},
        } = sessionData;

        const result = await database.query(
            `INSERT INTO charging_sessions (
                booking_id, user_id, station_id, connector_id,
                started_at, start_meter_reading,
                status, vendor_session_id, meter_data
            ) VALUES ($1, $2, $3, $4, NOW(), $5, 'STARTING', $6, $7)
            RETURNING
                id, booking_id, user_id, station_id, connector_id,
                started_at, ended_at, energy_kwh,
                start_meter_reading, end_meter_reading,
                duration_minutes, cost_amount, cost_currency,
                status, vendor_session_id, meter_data,
                created_at, updated_at`,
            [
                bookingId,
                userId,
                stationId,
                connectorId,
                startMeterReading,
                vendorSessionId,
                JSON.stringify(meterData),
            ]
        );

        return result.rows[0];
    }

    /**
     * Update session status
     * @param {string} id - Session ID
     * @param {string} status - New status
     * @param {object} updates - Additional updates
     * @returns {Promise<object>} Updated session
     */
    async updateStatus(id, status, updates = {}) {
        const fields = ["status = $1"];
        const params = [status];

        if (updates.endMeterReading !== undefined) {
            fields.push(`end_meter_reading = $${params.length + 1}`);
            params.push(updates.endMeterReading);
        }

        if (updates.energyKwh !== undefined) {
            fields.push(`energy_kwh = $${params.length + 1}`);
            params.push(updates.energyKwh);
        }

        if (updates.costAmount !== undefined) {
            fields.push(`cost_amount = $${params.length + 1}`);
            params.push(updates.costAmount);
        }

        if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
            fields.push(`ended_at = NOW()`);
            if (updates.endMeterReading !== undefined && updates.startMeterReading !== undefined) {
                const duration = Math.round(
                    ((new Date() - new Date(updates.startedAt || Date.now())) / (1000 * 60))
                );
                fields.push(`duration_minutes = $${params.length + 1}`);
                params.push(duration);
            }
        }

        fields.push(`updated_at = NOW()`);
        params.push(id);

        const result = await database.query(
            `UPDATE charging_sessions
            SET ${fields.join(", ")}
            WHERE id = $${params.length}
            RETURNING
                id, booking_id, user_id, station_id, connector_id,
                started_at, ended_at, energy_kwh,
                start_meter_reading, end_meter_reading,
                duration_minutes, cost_amount, cost_currency,
                status, vendor_session_id, meter_data,
                created_at, updated_at`,
            params
        );

        return result.rows[0];
    }
}

export const Session = new SessionModel();

