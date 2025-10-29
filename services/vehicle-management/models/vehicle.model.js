/**
 * Vehicle Model
 * Database operations for vehicles
 */

import { database } from "@ev-platform/shared";

/**
 * Vehicle Model Class
 */
class VehicleModel {
    /**
     * Find vehicle by chassis number
     * @param {object} client - Database client
     * @param {string} chassisNumber - Chassis number
     * @returns {Promise<object|null>} Vehicle or null
     */
    async findByChassisNumber(client, chassisNumber) {
        if (!chassisNumber) return null;

        const result = await client.query(
            `SELECT * FROM vehicles WHERE chassis_number = $1`,
            [chassisNumber]
        );

        return result.rows[0] || null;
    }

    /**
     * Find vehicle by registration number
     * @param {object} client - Database client
     * @param {string} regNumber - Registration number
     * @returns {Promise<object|null>} Vehicle or null
     */
    async findByRegNumber(client, regNumber) {
        if (!regNumber) return null;

        const result = await client.query(
            `SELECT * FROM vehicles WHERE reg_number = $1`,
            [regNumber]
        );

        return result.rows[0] || null;
    }

    /**
     * Create a new vehicle
     * @param {object} client - Database client
     * @param {object} vehicleData - Vehicle data
     * @returns {Promise<object>} Created vehicle
     */
    async create(client, vehicleData) {
        const {
            regNumber,
            chassisNumber,
            userId,
            make,
            model,
            year,
            batteryCapacityKwh,
            efficiencyKwhPerKm,
        } = vehicleData;

        const result = await client.query(
            `INSERT INTO vehicles (
                id, reg_number, chassis_number, user_id, make, model, year,
                battery_capacity_kwh, efficiency_kwh_per_km,
                created_at, updated_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
            )
            RETURNING *`,
            [
                regNumber || null,
                chassisNumber || null,
                userId || null,
                make || null,
                model || null,
                year || null,
                batteryCapacityKwh || null,
                efficiencyKwhPerKm || null,
            ]
        );

        return result.rows[0];
    }

    /**
     * Update vehicle
     * @param {object} client - Database client
     * @param {string} vehicleId - Vehicle ID
     * @param {object} vehicleData - Vehicle data to update
     * @returns {Promise<object>} Updated vehicle
     */
    async update(client, vehicleId, vehicleData) {
        const {
            regNumber,
            chassisNumber,
            userId,
            make,
            model,
            year,
            batteryCapacityKwh,
            efficiencyKwhPerKm,
        } = vehicleData;

        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (regNumber !== undefined) {
            updateFields.push(`reg_number = $${paramIndex++}`);
            updateValues.push(regNumber);
        }

        if (chassisNumber !== undefined) {
            updateFields.push(`chassis_number = $${paramIndex++}`);
            updateValues.push(chassisNumber);
        }

        if (userId !== undefined) {
            updateFields.push(`user_id = $${paramIndex++}`);
            updateValues.push(userId);
        }

        if (make !== undefined) {
            updateFields.push(`make = $${paramIndex++}`);
            updateValues.push(make);
        }

        if (model !== undefined) {
            updateFields.push(`model = $${paramIndex++}`);
            updateValues.push(model);
        }

        if (year !== undefined) {
            updateFields.push(`year = $${paramIndex++}`);
            updateValues.push(year);
        }

        if (batteryCapacityKwh !== undefined) {
            updateFields.push(`battery_capacity_kwh = $${paramIndex++}`);
            updateValues.push(batteryCapacityKwh);
        }

        if (efficiencyKwhPerKm !== undefined) {
            updateFields.push(`efficiency_kwh_per_km = $${paramIndex++}`);
            updateValues.push(efficiencyKwhPerKm);
        }

        if (updateFields.length === 0) {
            // No fields to update, return existing
            const result = await client.query(
                `SELECT * FROM vehicles WHERE id = $1`,
                [vehicleId]
            );
            return result.rows[0];
        }

        updateFields.push(`updated_at = NOW()`);
        updateValues.push(vehicleId);

        const result = await client.query(
            `UPDATE vehicles
            SET ${updateFields.join(", ")}
            WHERE id = $${paramIndex}
            RETURNING *`,
            updateValues
        );

        return result.rows[0];
    }

    /**
     * Find vehicles by IDs
     * @param {Array<string>} vehicleIds - Array of vehicle IDs
     * @returns {Promise<object>} Map of vehicle_id to vehicle object
     */
    async findByIds(vehicleIds) {
        if (vehicleIds.length === 0) return {};

        const query = `
            SELECT
                id as vehicle_id,
                make,
                model
            FROM vehicles
            WHERE id = ANY($1)
        `;

        const result = await database.query(query, [vehicleIds]);
        const map = {};
        result.rows.forEach((vehicle) => {
            map[vehicle.vehicle_id] = vehicle;
        });
        return map;
    }

    /**
     * Find latest status for vehicles by IDs
     * @param {Array<string>} vehicleIds - Array of vehicle IDs
     * @returns {Promise<object>} Map of vehicle_id to status object
     */
    async findLatestStatusByIds(vehicleIds) {
        if (vehicleIds.length === 0) return {};

        const query = `
            SELECT
                vehicle_id,
                battery_level_percent,
                range_km,
                recorded_at
            FROM latest_vehicle_status
            WHERE vehicle_id = ANY($1)
        `;

        const result = await database.query(query, [vehicleIds]);
        const map = {};
        result.rows.forEach((status) => {
            map[status.vehicle_id] = {
                battery_level_percent: status.battery_level_percent,
                range_km: status.range_km,
                recorded_at: status.recorded_at,
            };
        });
        return map;
    }
}

// Export singleton instance
export default new VehicleModel();
