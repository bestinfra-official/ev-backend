/**
 * Event Publisher Service
 * Publishes events to Redis Pub/Sub for real-time updates
 */

import { redis, createLogger } from "@ev-platform/shared";

const logger = createLogger("event-publisher-service");

// Event channels
const CHANNELS = {
    STATION_UPDATES: "station_updates",
    CONNECTOR_STATUS: "connector_status_update",
    SLOT_HOLD: "slot_hold_created",
    HOLD_EXPIRED: "slot_hold_expired",
    BOOKING_CONFIRMED: "booking_confirmed",
    SESSION_STARTED: "session_started",
    SESSION_ENDED: "session_ended",
    STATION_OFFLINE: "station_offline",
};

// Event types
const EVENT_TYPES = {
    CONNECTOR_STATUS_UPDATE: "connector_status_update",
    SLOT_HOLD_CREATED: "slot_hold_created",
    SLOT_HOLD_EXPIRED: "slot_hold_expired",
    BOOKING_CONFIRMED: "booking_confirmed",
    SESSION_STARTED: "session_started",
    SESSION_ENDED: "session_ended",
    STATION_OFFLINE: "station_offline",
};

class EventPublisherService {
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
     * Publish event to a channel
     * @param {string} channel - Channel name
     * @param {object} event - Event data
     * @returns {Promise<number>} Number of subscribers that received the message
     */
    async publish(channel, event) {
        try {
            const message = JSON.stringify({
                type: event.type,
                timestamp: Math.floor(Date.now() / 1000),
                data: event.data,
            });

            const subscribers = await this._getClient().publish(channel, message);

            logger.debug("Published event", {
                channel,
                type: event.type,
                subscribers,
            });

            return subscribers;
        } catch (error) {
            logger.error("Failed to publish event", {
                error: error.message,
                channel,
                eventType: event.type,
            });
            // Don't throw - event publishing should be best-effort
            return 0;
        }
    }

    /**
     * Publish connector status update
     * @param {string} stationId - Station ID
     * @param {string} connectorId - Connector ID
     * @param {object} statusData - Status data
     * @returns {Promise<number>}
     */
    async publishConnectorStatusUpdate(stationId, connectorId, statusData) {
        const channel = `${CHANNELS.CONNECTOR_STATUS}:${stationId}`;
        return this.publish(channel, {
            type: EVENT_TYPES.CONNECTOR_STATUS_UPDATE,
            data: {
                stationId,
                connectorId,
                status: statusData.status,
                updatedAt: statusData.updatedAt || Math.floor(Date.now() / 1000),
                bookingId: statusData.bookingId || null,
            },
        });
    }

    /**
     * Publish station-wide update
     * @param {string} stationId - Station ID
     * @param {object} updateData - Update data
     * @returns {Promise<number>}
     */
    async publishStationUpdate(stationId, updateData) {
        const channel = `${CHANNELS.STATION_UPDATES}:${stationId}`;
        return this.publish(channel, {
            type: updateData.type || EVENT_TYPES.CONNECTOR_STATUS_UPDATE,
            data: {
                stationId,
                ...updateData,
            },
        });
    }

    /**
     * Publish slot hold created
     * @param {string} stationId - Station ID
     * @param {string} connectorId - Connector ID
     * @param {object} holdData - Hold data
     * @returns {Promise<number>}
     */
    async publishSlotHoldCreated(stationId, connectorId, holdData) {
        const channel = `${CHANNELS.STATION_UPDATES}:${stationId}`;
        return this.publish(channel, {
            type: EVENT_TYPES.SLOT_HOLD_CREATED,
            data: {
                stationId,
                connectorId,
                token: holdData.token,
                startTs: holdData.startTs,
                endTs: holdData.endTs,
                expiresIn: holdData.expiresIn,
            },
        });
    }

    /**
     * Publish booking confirmed
     * @param {string} stationId - Station ID
     * @param {string} bookingId - Booking ID
     * @param {object} bookingData - Booking data
     * @returns {Promise<number>}
     */
    async publishBookingConfirmed(stationId, bookingId, bookingData) {
        const channel = `${CHANNELS.STATION_UPDATES}:${stationId}`;
        return this.publish(channel, {
            type: EVENT_TYPES.BOOKING_CONFIRMED,
            data: {
                stationId,
                bookingId,
                connectorId: bookingData.connectorId,
                startTs: bookingData.startTs,
                endTs: bookingData.endTs,
                status: bookingData.status,
            },
        });
    }

    /**
     * Publish session started
     * @param {string} stationId - Station ID
     * @param {string} sessionId - Session ID
     * @param {object} sessionData - Session data
     * @returns {Promise<number>}
     */
    async publishSessionStarted(stationId, sessionId, sessionData) {
        const channel = `${CHANNELS.STATION_UPDATES}:${stationId}`;
        return this.publish(channel, {
            type: EVENT_TYPES.SESSION_STARTED,
            data: {
                stationId,
                sessionId,
                connectorId: sessionData.connectorId,
                bookingId: sessionData.bookingId,
                startedAt: sessionData.startedAt,
            },
        });
    }

    /**
     * Publish session ended
     * @param {string} stationId - Station ID
     * @param {string} sessionId - Session ID
     * @param {object} sessionData - Session data
     * @returns {Promise<number>}
     */
    async publishSessionEnded(stationId, sessionId, sessionData) {
        const channel = `${CHANNELS.STATION_UPDATES}:${stationId}`;
        return this.publish(channel, {
            type: EVENT_TYPES.SESSION_ENDED,
            data: {
                stationId,
                sessionId,
                connectorId: sessionData.connectorId,
                energyKwh: sessionData.energyKwh,
                costAmount: sessionData.costAmount,
                endedAt: sessionData.endedAt,
            },
        });
    }
}

export default new EventPublisherService();

// Export event types for use in other modules
export { EVENT_TYPES, CHANNELS };

