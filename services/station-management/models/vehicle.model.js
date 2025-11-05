/**
 * Vehicle Model
 * Handles vehicle data operations for station discovery service
 */

import { database } from "@ev-platform/shared";

/**
 * Vehicle Model
 * Handles vehicle data operations
 */
class VehicleModel {
    /**
     * Find vehicle by registration number
     * @param {string} regNumber - Vehicle registration number
     * @returns {Promise<object|null>} Vehicle object or null
     */
    async findByRegNumber(regNumber) {
        const result = await database.query(
            `SELECT
                id, reg_number, user_id, battery_capacity_kwh,
                efficiency_kwh_per_km, efficiency_factor, reserve_km,
                vehicle_type, make, model, year,
                created_at, updated_at
            FROM vehicles
            WHERE reg_number = $1`,
            [regNumber]
        );

        return result.rows[0] || null;
    }

    /**
     * Find vehicle by user ID
     * @param {string} userId - User ID
     * @returns {Promise<Array>} Array of vehicles owned by user
     */
    async findByUserId(userId) {
        const result = await database.query(
            `SELECT
                id, reg_number, user_id, battery_capacity_kwh,
                efficiency_kwh_per_km, efficiency_factor, reserve_km,
                vehicle_type, make, model, year,
                created_at, updated_at
            FROM vehicles
            WHERE user_id = $1
            ORDER BY created_at DESC`,
            [userId]
        );

        return result.rows;
    }

    /**
     * Create a new vehicle
     * @param {object} vehicleData - Vehicle data
     * @returns {Promise<object>} Created vehicle object
     */
    async create(vehicleData) {
        const {
            regNumber,
            userId,
            batteryCapacityKwh,
            efficiencyKwhPerKm,
            efficiencyFactor = 0.88,
            reserveKm = 7,
            vehicleType,
            make,
            model,
            year,
        } = vehicleData;

        const result = await database.query(
            `INSERT INTO vehicles (
                reg_number, user_id, battery_capacity_kwh,
                efficiency_kwh_per_km, efficiency_factor, reserve_km,
                vehicle_type, make, model, year
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING
                id, reg_number, user_id, battery_capacity_kwh,
                efficiency_kwh_per_km, efficiency_factor, reserve_km,
                vehicle_type, make, model, year,
                created_at, updated_at`,
            [
                regNumber,
                userId,
                batteryCapacityKwh,
                efficiencyKwhPerKm,
                efficiencyFactor,
                reserveKm,
                vehicleType,
                make,
                model,
                year,
            ]
        );

        return result.rows[0];
    }
}

// Export singleton instance
export const Vehicle = new VehicleModel();
