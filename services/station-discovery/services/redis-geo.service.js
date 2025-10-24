/**
 * Redis Geo Service
 * High-performance geospatial operations using Redis GEO commands
 */

import { redis } from "@ev-platform/shared";
import { createLogger } from "@ev-platform/shared";

const logger = createLogger("redis-geo-service");

class RedisGeoService {
    constructor() {
        this.redisClient = null;
        this.GEO_KEY = "stations:geo";
        this.META_KEY_PREFIX = "station:meta:";
        this.CACHE_KEY_PREFIX = "stations:near:";
    }

    /**
     * Get Redis client (lazy initialization)
     * @private
     */
    _getClient() {
        if (!this.redisClient) {
            this.redisClient = redis.getClient();
        }
        return this.redisClient;
    }

    /**
     * Add station to geo index
     * @param {string} stationId - Station ID
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {object} metadata - Station metadata
     */
    async addStation(stationId, lat, lng, metadata) {
        try {
            // Add to geo index
            await this._getClient().geoadd(this.GEO_KEY, lng, lat, stationId);

            // Store metadata in hash
            const metaKey = `${this.META_KEY_PREFIX}${stationId}`;
            await this._getClient().hset(metaKey, {
                name: metadata.name || "",
                powerKw: metadata.power_kw || 0,
                plugs: metadata.plugs ? JSON.stringify(metadata.plugs) : "[]",
                availability: metadata.availability_status || "unknown",
                operator: metadata.operator_name || "",
                address: metadata.address || "",
                city: metadata.city || "",
                state: metadata.state || "",
                pricing: metadata.pricing_info
                    ? JSON.stringify(metadata.pricing_info)
                    : "{}",
                amenities: metadata.amenities
                    ? JSON.stringify(metadata.amenities)
                    : "[]",
            });

            // Set TTL for metadata (24 hours)
            await this._getClient().expire(metaKey, 86400);

            logger.debug("Station added to geo index", { stationId, lat, lng });
        } catch (error) {
            logger.error("Failed to add station to geo index", {
                stationId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Batch add stations to geo index
     * @param {Array} stations - Array of station objects
     */
    async batchAddStations(stations) {
        if (!stations || stations.length === 0) {
            return;
        }

        try {
            const pipeline = this._getClient().pipeline();

            // Add all stations to geo index
            for (const station of stations) {
                pipeline.geoadd(
                    this.GEO_KEY,
                    station.longitude,
                    station.latitude,
                    station.id
                );

                // Store metadata
                const metaKey = `${this.META_KEY_PREFIX}${station.id}`;
                pipeline.hset(metaKey, {
                    name: station.name || "",
                    powerKw: station.power_kw || 0,
                    plugs: station.plugs ? JSON.stringify(station.plugs) : "[]",
                    availability: station.availability_status || "unknown",
                    operator: station.operator_name || "",
                    address: station.address || "",
                    city: station.city || "",
                    state: station.state || "",
                    pricing: station.pricing_info
                        ? JSON.stringify(station.pricing_info)
                        : "{}",
                    amenities: station.amenities
                        ? JSON.stringify(station.amenities)
                        : "[]",
                });
                pipeline.expire(metaKey, 86400);
            }

            await pipeline.exec();
            logger.info(`Batch added ${stations.length} stations to geo index`);
        } catch (error) {
            logger.error("Failed to batch add stations", {
                count: stations.length,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Find stations within radius
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} radiusKm - Radius in kilometers
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Array of stations with distance
     */
    async findStationsWithinRadius(lat, lng, radiusKm, limit = 50) {
        try {
            // Use GEORADIUS to find stations within radius
            const results = await this._getClient().georadius(
                this.GEO_KEY,
                lng, // Redis expects longitude first
                lat,
                radiusKm,
                "km",
                "WITHDIST",
                "COUNT",
                limit
            );

            // Results format: [["station_id", "distance"], ...]
            return results.map(([stationId, distance]) => ({
                id: stationId,
                distanceKm: parseFloat(distance),
            }));
        } catch (error) {
            logger.error("Failed to find stations within radius", {
                lat,
                lng,
                radiusKm,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get station metadata
     * @param {string} stationId - Station ID
     * @returns {Promise<object|null>} Station metadata or null
     */
    async getStationMetadata(stationId) {
        try {
            const metaKey = `${this.META_KEY_PREFIX}${stationId}`;
            const metadata = await this._getClient().hgetall(metaKey);

            if (!metadata || Object.keys(metadata).length === 0) {
                return null;
            }

            // Parse JSON fields
            return {
                id: stationId,
                name: metadata.name,
                powerKw: parseFloat(metadata.powerKw) || 0,
                plugs: JSON.parse(metadata.plugs || "[]"),
                availability: metadata.availability,
                operator: metadata.operator,
                address: metadata.address,
                city: metadata.city,
                state: metadata.state,
                pricing: JSON.parse(metadata.pricing || "{}"),
                amenities: JSON.parse(metadata.amenities || "[]"),
            };
        } catch (error) {
            logger.error("Failed to get station metadata", {
                stationId,
                error: error.message,
            });
            return null;
        }
    }

    /**
     * Batch get station metadata
     * @param {Array} stationIds - Array of station IDs
     * @returns {Promise<Array>} Array of station metadata
     */
    async batchGetStationMetadata(stationIds) {
        if (!stationIds || stationIds.length === 0) {
            return [];
        }

        try {
            const pipeline = this._getClient().pipeline();

            // Add HGETALL commands for each station
            stationIds.forEach((stationId) => {
                const metaKey = `${this.META_KEY_PREFIX}${stationId}`;
                pipeline.hgetall(metaKey);
            });

            const results = await pipeline.exec();

            // Process results
            return results
                .map(([error, metadata], index) => {
                    if (
                        error ||
                        !metadata ||
                        Object.keys(metadata).length === 0
                    ) {
                        return null;
                    }

                    const stationId = stationIds[index];
                    return {
                        id: stationId,
                        name: metadata.name,
                        powerKw: parseFloat(metadata.powerKw) || 0,
                        plugs: JSON.parse(metadata.plugs || "[]"),
                        availability: metadata.availability,
                        operator: metadata.operator,
                        address: metadata.address,
                        city: metadata.city,
                        state: metadata.state,
                        pricing: JSON.parse(metadata.pricing || "{}"),
                        amenities: JSON.parse(metadata.amenities || "[]"),
                    };
                })
                .filter(Boolean);
        } catch (error) {
            logger.error("Failed to batch get station metadata", {
                count: stationIds.length,
                error: error.message,
            });
            return [];
        }
    }

    /**
     * Update station metadata
     * @param {string} stationId - Station ID
     * @param {object} metadata - Updated metadata
     */
    async updateStationMetadata(stationId, metadata) {
        try {
            const metaKey = `${this.META_KEY_PREFIX}${stationId}`;

            const updateData = {};
            if (metadata.name !== undefined) updateData.name = metadata.name;
            if (metadata.power_kw !== undefined)
                updateData.powerKw = metadata.power_kw;
            if (metadata.plugs !== undefined)
                updateData.plugs = JSON.stringify(metadata.plugs);
            if (metadata.availability_status !== undefined)
                updateData.availability = metadata.availability_status;
            if (metadata.operator_name !== undefined)
                updateData.operator = metadata.operator_name;
            if (metadata.address !== undefined)
                updateData.address = metadata.address;
            if (metadata.city !== undefined) updateData.city = metadata.city;
            if (metadata.state !== undefined) updateData.state = metadata.state;
            if (metadata.pricing_info !== undefined)
                updateData.pricing = JSON.stringify(metadata.pricing_info);
            if (metadata.amenities !== undefined)
                updateData.amenities = JSON.stringify(metadata.amenities);

            await this._getClient().hset(metaKey, updateData);
            await this._getClient().expire(metaKey, 86400); // Refresh TTL

            logger.debug("Station metadata updated", { stationId });
        } catch (error) {
            logger.error("Failed to update station metadata", {
                stationId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Remove station from geo index
     * @param {string} stationId - Station ID
     */
    async removeStation(stationId) {
        try {
            // Remove from geo index
            await this._getClient().zrem(this.GEO_KEY, stationId);

            // Remove metadata
            const metaKey = `${this.META_KEY_PREFIX}${stationId}`;
            await this._getClient().del(metaKey);

            logger.debug("Station removed from geo index", { stationId });
        } catch (error) {
            logger.error("Failed to remove station", {
                stationId,
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get geo index statistics
     * @returns {Promise<object>} Geo index statistics
     */
    async getStats() {
        try {
            const count = await this._getClient().zcard(this.GEO_KEY);
            return {
                totalStations: count,
                geoKey: this.GEO_KEY,
                metaKeyPrefix: this.META_KEY_PREFIX,
            };
        } catch (error) {
            logger.error("Failed to get geo index stats", {
                error: error.message,
            });
            return { totalStations: 0 };
        }
    }

    /**
     * Clear all geo data (for testing/reset)
     */
    async clearAll() {
        try {
            // Get all station IDs
            const stationIds = await this._getClient().zrange(
                this.GEO_KEY,
                0,
                -1
            );

            // Remove geo index
            await this._getClient().del(this.GEO_KEY);

            // Remove all metadata
            if (stationIds.length > 0) {
                const pipeline = this._getClient().pipeline();
                stationIds.forEach((stationId) => {
                    pipeline.del(`${this.META_KEY_PREFIX}${stationId}`);
                });
                await pipeline.exec();
            }

            logger.info("Cleared all geo data", {
                stationsRemoved: stationIds.length,
            });
        } catch (error) {
            logger.error("Failed to clear geo data", { error: error.message });
            throw error;
        }
    }
}

// Export singleton instance
export default new RedisGeoService();
