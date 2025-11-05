/**
 * Connector Status Service (Redis)
 * Manages real-time connector status in Redis for sub-millisecond reads
 */

import { redis, createLogger } from "@ev-platform/shared";

const logger = createLogger("connector-status-service");

// Redis key patterns
const KEY_PATTERNS = {
    CONNECTOR_STATUS: "station:{station_id}:connectors:{connector_id}",
    STATION_CONNECTORS: "station:{station_id}:connectors",
    CONNECTOR_HOLDS: "slot_hold:{connector_id}:{start}:{end}",
};

class ConnectorStatusService {
    constructor() {
        this.client = null;
    }

    _getClient() {
        if (!this.client) {
            this.client = redis.getClient();
        }
        return this.client;
    }

    /**
     * Update connector status in Redis
     * @param {string} stationId - Station ID
     * @param {string} connectorId - Connector ID
     * @param {object} statusData - Status data
     * @returns {Promise<void>}
     */
    async updateConnectorStatus(stationId, connectorId, statusData) {
        try {
            const key = KEY_PATTERNS.CONNECTOR_STATUS
                .replace("{station_id}", stationId)
                .replace("{connector_id}", connectorId);

            const data = {
                status: statusData.status || "AVAILABLE",
                updated_at: Math.floor(Date.now() / 1000),
                booking_id: statusData.bookingId || null,
                vendor_connector_id: statusData.vendorConnectorId || null,
            };

            await this._getClient().hset(key, data);
            await this._getClient().expire(key, 3600); // 1 hour TTL

            // Also update station connectors hash
            const stationKey = KEY_PATTERNS.STATION_CONNECTORS.replace(
                "{station_id}",
                stationId
            );
            await this._getClient().hset(
                stationKey,
                connectorId,
                JSON.stringify(data)
            );
            await this._getClient().expire(stationKey, 3600);

            logger.debug("Updated connector status", {
                stationId,
                connectorId,
                status: data.status,
            });
        } catch (error) {
            logger.error("Failed to update connector status", {
                error: error.message,
                stationId,
                connectorId,
            });
            throw error;
        }
    }

    /**
     * Get connector status from Redis
     * @param {string} stationId - Station ID
     * @param {string} connectorId - Connector ID
     * @returns {Promise<object|null>} Connector status or null
     */
    async getConnectorStatus(stationId, connectorId) {
        try {
            const key = KEY_PATTERNS.CONNECTOR_STATUS
                .replace("{station_id}", stationId)
                .replace("{connector_id}", connectorId);

            const data = await this._getClient().hgetall(key);
            if (!data || Object.keys(data).length === 0) {
                return null;
            }

            return {
                status: data.status || "AVAILABLE",
                updated_at: parseInt(data.updated_at || 0),
                booking_id: data.booking_id || null,
                vendor_connector_id: data.vendor_connector_id || null,
            };
        } catch (error) {
            logger.error("Failed to get connector status", {
                error: error.message,
                stationId,
                connectorId,
            });
            return null;
        }
    }

    /**
     * Get all connectors for a station from Redis
     * @param {string} stationId - Station ID
     * @returns {Promise<Array>} Array of connector statuses
     */
    async getStationConnectors(stationId) {
        try {
            const stationKey = KEY_PATTERNS.STATION_CONNECTORS.replace(
                "{station_id}",
                stationId
            );

            const data = await this._getClient().hgetall(stationKey);
            if (!data || Object.keys(data).length === 0) {
                return [];
            }

            return Object.entries(data).map(([connectorId, jsonData]) => {
                const parsed = JSON.parse(jsonData);
                return {
                    connector_id: connectorId,
                    ...parsed,
                };
            });
        } catch (error) {
            logger.error("Failed to get station connectors", {
                error: error.message,
                stationId,
            });
            return [];
        }
    }

    /**
     * Batch update multiple connector statuses
     * @param {Array} updates - Array of {stationId, connectorId, statusData}
     * @returns {Promise<void>}
     */
    async batchUpdateConnectorStatuses(updates) {
        const pipeline = this._getClient().pipeline();

        for (const update of updates) {
            const key = KEY_PATTERNS.CONNECTOR_STATUS
                .replace("{station_id}", update.stationId)
                .replace("{connector_id}", update.connectorId);

            const data = {
                status: update.statusData.status || "AVAILABLE",
                updated_at: Math.floor(Date.now() / 1000),
                booking_id: update.statusData.bookingId || null,
                vendor_connector_id: update.statusData.vendorConnectorId || null,
            };

            pipeline.hset(key, data);
            pipeline.expire(key, 3600);

            // Update station connectors hash
            const stationKey = KEY_PATTERNS.STATION_CONNECTORS.replace(
                "{station_id}",
                update.stationId
            );
            pipeline.hset(stationKey, update.connectorId, JSON.stringify(data));
            pipeline.expire(stationKey, 3600);
        }

        await pipeline.exec();
    }
}

export default new ConnectorStatusService();

