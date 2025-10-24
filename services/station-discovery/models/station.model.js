/**
 * Station Discovery Models
 * Database models for stations and vehicles
 */

import { database } from "@ev-platform/shared";

/**
 * Station Model
 * Handles charging station data operations
 */
class StationModel {
    /**
     * Find station by ID
     * @param {string} id - Station ID
     * @returns {Promise<object|null>} Station object or null
     */
    async findById(id) {
        const result = await database.query(
            `SELECT
                id, name, latitude, longitude,
                power_kw, plugs, availability_status,
                operator_name, address, city, state,
                pricing_info, amenities, created_at, updated_at
            FROM charging_stations
            WHERE id = $1`,
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Find stations within radius using PostGIS
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} radiusKm - Radius in kilometers
     * @param {number} limit - Maximum results
     * @returns {Promise<Array>} Array of stations with distance
     */
    async findWithinRadius(lat, lng, radiusKm, limit = 50) {
        // Ensure limit is an integer and radiusKm is a number
        const intLimit = parseInt(limit, 10);
        const numRadiusKm = parseFloat(radiusKm);
        const numLat = parseFloat(lat);
        const numLng = parseFloat(lng);

        const result = await database.query(
            `SELECT
                id, name, latitude, longitude,
                power_kw, plugs, availability_status,
                operator_name, address, city, state,
                pricing_info, amenities,
                ST_Distance(
                    ST_MakePoint(longitude, latitude)::geography,
                    ST_MakePoint($1, $2)::geography
                ) / 1000 as distance_km
            FROM charging_stations
            WHERE ST_DWithin(
                ST_MakePoint(longitude, latitude)::geography,
                ST_MakePoint($1, $2)::geography,
                $3::numeric * 1000
            )
            AND availability_status = 'available'
            ORDER BY distance_km ASC
            LIMIT $4`,
            [numLng, numLat, numRadiusKm, intLimit]
        );

        return result.rows;
    }

    /**
     * Get station metadata for Redis caching
     * @param {Array} stationIds - Array of station IDs
     * @returns {Promise<Array>} Array of station metadata
     */
    async getStationMetadata(stationIds) {
        if (!stationIds || stationIds.length === 0) {
            return [];
        }

        const result = await database.query(
            `SELECT
                id, name, latitude, longitude, power_kw, plugs, availability_status,
                operator_name, address, city, state,
                pricing_info, amenities
            FROM charging_stations
            WHERE id = ANY($1)`,
            [stationIds]
        );

        return result.rows;
    }

    /**
     * Get all stations for Redis geo indexing
     * @returns {Promise<Array>} Array of stations with coordinates
     */
    async getAllStationsForGeoIndex() {
        const result = await database.query(
            `SELECT id, latitude, longitude, name, power_kw, plugs, availability_status
            FROM charging_stations
            WHERE availability_status = 'available'`
        );

        return result.rows;
    }
}

// Export singleton instance
export const Station = new StationModel();
