/**
 * Connector Model
 * Handles connector data operations
 */

import { database } from "@ev-platform/shared";

class ConnectorModel {
    /**
     * Find connector by ID
     * @param {string} id - Connector ID
     * @returns {Promise<object|null>} Connector object or null
     */
    async findById(id) {
        const result = await database.query(
            `SELECT
                id, station_id, connector_number, connector_type,
                power_kw, status, current_booking_id,
                vendor_connector_id, metadata,
                created_at, updated_at
            FROM connectors
            WHERE id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Find all connectors for a station
     * @param {string} stationId - Station ID
     * @returns {Promise<Array>} Array of connectors
     */
    async findByStationId(stationId) {
        const result = await database.query(
            `SELECT
                id, station_id, connector_number, connector_type,
                power_kw, status, current_booking_id,
                vendor_connector_id, metadata,
                created_at, updated_at
            FROM connectors
            WHERE station_id = $1
            ORDER BY connector_number`,
            [stationId]
        );

        return result.rows;
    }

    /**
     * Update connector status
     * @param {string} id - Connector ID
     * @param {string} status - New status
     * @param {string} bookingId - Optional booking ID
     * @returns {Promise<object>} Updated connector
     */
    async updateStatus(id, status, bookingId = null) {
        const result = await database.query(
            `UPDATE connectors
            SET status = $1,
                current_booking_id = $2,
                updated_at = NOW()
            WHERE id = $3
            RETURNING
                id, station_id, connector_number, connector_type,
                power_kw, status, current_booking_id,
                vendor_connector_id, metadata,
                created_at, updated_at`,
            [status, bookingId, id]
        );

        return result.rows[0];
    }

    /**
     * Create a new connector
     * @param {object} connectorData - Connector data
     * @returns {Promise<object>} Created connector
     */
    async create(connectorData) {
        const {
            stationId,
            connectorNumber,
            connectorType,
            powerKw,
            status = "AVAILABLE",
            vendorConnectorId,
            metadata = {},
        } = connectorData;

        const result = await database.query(
            `INSERT INTO connectors (
                station_id, connector_number, connector_type,
                power_kw, status, vendor_connector_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
                id, station_id, connector_number, connector_type,
                power_kw, status, current_booking_id,
                vendor_connector_id, metadata,
                created_at, updated_at`,
            [
                stationId,
                connectorNumber,
                connectorType,
                powerKw,
                status,
                vendorConnectorId,
                JSON.stringify(metadata),
            ]
        );

        return result.rows[0];
    }
}

export const Connector = new ConnectorModel();
