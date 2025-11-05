/**
 * Station Service
 * Handles station-related operations including availability computation and caching
 */

import { redis, createLogger, database } from "@ev-platform/shared";
import connectorStatusService from "./connector-status.service.js";
import bookingRedisService from "./booking-redis.service.js";
import { Connector, Booking } from "../models/index.js";

const logger = createLogger("station-service");

// Cache TTL for availability data
const AVAILABILITY_CACHE_TTL = 60; // 1 minute

class StationService {
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
     * Compute available time slots for a station
     * @param {string} stationId - Station ID
     * @param {Date} startDate - Start date for slot computation
     * @param {Date} endDate - End date for slot computation
     * @param {number} slotDurationMinutes - Slot duration in minutes
     * @returns {Promise<Array>} Array of available slots
     */
    async computeAvailableSlots(
        stationId,
        startDate = new Date(),
        endDate = new Date(Date.now() + 24 * 60 * 60 * 1000), // Next 24 hours
        slotDurationMinutes = 60
    ) {
        const cacheKey = `availability:${stationId}:${Math.floor(startDate.getTime() / (60 * 1000))}:${Math.floor(endDate.getTime() / (60 * 1000))}`;

        try {
            // Try cache first
            const cached = await this._getClient().get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (error) {
            logger.warn("Cache read failed, computing fresh", {
                error: error.message,
            });
        }

        try {
            // Get all connectors for the station
            const connectors = await Connector.findByStationId(stationId);
            const slots = [];

            for (const connector of connectors) {
                // Skip offline/maintenance connectors
                if (connector.status === "OFFLINE" || connector.status === "MAINTENANCE") {
                    continue;
                }

                // Get Redis connector status
                const redisStatus = await connectorStatusService.getConnectorStatus(
                    stationId,
                    connector.id
                );

                // Get active holds from Redis
                const holds = await bookingRedisService.getConnectorHolds(connector.id);

                // Get confirmed bookings from DB
                const bookings = await Booking.findOverlappingBookings(
                    connector.id,
                    startDate,
                    endDate
                );

                // Generate time slots
                const connectorSlots = this._generateTimeSlots(
                    startDate,
                    endDate,
                    slotDurationMinutes,
                    connector,
                    redisStatus,
                    holds,
                    bookings
                );

                slots.push(...connectorSlots);
            }

            // Cache the result
            try {
                await this._getClient().setex(
                    cacheKey,
                    AVAILABILITY_CACHE_TTL,
                    JSON.stringify(slots)
                );
            } catch (error) {
                logger.warn("Cache write failed", { error: error.message });
            }

            return slots;
        } catch (error) {
            logger.error("Failed to compute available slots", {
                error: error.message,
                stationId,
            });
            throw error;
        }
    }

    /**
     * Generate time slots for a connector
     * @private
     */
    _generateTimeSlots(
        startDate,
        endDate,
        slotDurationMinutes,
        connector,
        redisStatus,
        holds,
        bookings
    ) {
        const slots = [];
        const slotDurationMs = slotDurationMinutes * 60 * 1000;
        let currentTime = new Date(startDate);

        // Build set of occupied time ranges
        const occupiedRanges = new Set();

        // Add bookings
        for (const booking of bookings) {
            if (booking.status === "CONFIRMED" || booking.status === "ACTIVE") {
                const start = new Date(booking.start_ts).getTime();
                const end = new Date(booking.end_ts).getTime();
                for (let t = start; t < end; t += slotDurationMs) {
                    occupiedRanges.add(Math.floor(t / slotDurationMs));
                }
            }
        }

        // Add holds (parse from hold keys)
        for (const holdKey of holds) {
            const parts = holdKey.split(":");
            if (parts.length >= 3) {
                const start = parseInt(parts[parts.length - 2]) * 1000;
                const end = parseInt(parts[parts.length - 1]) * 1000;
                for (let t = start; t < end; t += slotDurationMs) {
                    occupiedRanges.add(Math.floor(t / slotDurationMs));
                }
            }
        }

        // Check current connector status
        const isCurrentlyOccupied =
            redisStatus?.status === "OCCUPIED" || redisStatus?.status === "RESERVED";

        // Generate slots
        while (currentTime < endDate) {
            const slotStart = new Date(currentTime);
            const slotEnd = new Date(currentTime.getTime() + slotDurationMs);
            const slotKey = Math.floor(slotStart.getTime() / slotDurationMs);

            let isAvailable = true;

            // Check if slot is occupied
            if (occupiedRanges.has(slotKey)) {
                isAvailable = false;
            }

            // Check if connector is currently occupied and slot is within next 30 minutes
            if (
                isCurrentlyOccupied &&
                slotStart.getTime() - Date.now() < 30 * 60 * 1000
            ) {
                isAvailable = false;
            }

            if (isAvailable) {
                slots.push({
                    connectorId: connector.id,
                    connectorNumber: connector.connector_number,
                    connectorType: connector.connector_type,
                    powerKw: parseFloat(connector.power_kw),
                    start: slotStart.toISOString(),
                    end: slotEnd.toISOString(),
                    durationMinutes: slotDurationMinutes,
                });
            }

            currentTime = slotEnd;
        }

        return slots;
    }

    /**
     * Get cached availability for a station (fast read)
     * @param {string} stationId - Station ID
     * @returns {Promise<Array|null>} Cached availability or null
     */
    async getCachedAvailability(stationId) {
        try {
            // Try to get most recent cache (simple implementation)
            // In production, you might want to use a pattern match
            const pattern = `availability:${stationId}:*`;
            const keys = await this._getClient().keys(pattern);

            if (keys.length === 0) {
                return null;
            }

            // Get the most recent key
            const mostRecentKey = keys.sort().reverse()[0];
            const cached = await this._getClient().get(mostRecentKey);

            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            logger.error("Failed to get cached availability", {
                error: error.message,
                stationId,
            });
            return null;
        }
    }

    /**
     * Invalidate availability cache for a station
     * @param {string} stationId - Station ID
     * @returns {Promise<void>}
     */
    async invalidateCache(stationId) {
        try {
            const pattern = `availability:${stationId}:*`;
            const keys = await this._getClient().keys(pattern);

            if (keys.length > 0) {
                await this._getClient().del(...keys);
            }
        } catch (error) {
            logger.error("Failed to invalidate cache", {
                error: error.message,
                stationId,
            });
        }
    }
}

export default new StationService();

