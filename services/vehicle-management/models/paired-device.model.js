/**
 * Paired Device Model
 * Database operations for paired devices
 */

import { database } from "@ev-platform/shared";

/**
 * Paired Device Model Class
 */
class PairedDeviceModel {
    /**
     * Find paired device by idempotency key and user
     * @param {number} userId - User ID
     * @param {string} idempotencyKey - Idempotency key
     * @returns {Promise<object|null>} Paired device or null
     */
    async findByIdempotencyKey(userId, idempotencyKey) {
        if (!idempotencyKey) return null;

        const result = await database.query(
            `SELECT
                id, user_id, vehicle_id, chassis_number, reg_number,
                bluetooth_mac, is_active, connected_at, last_seen,
                idempotency_key, created_at, updated_at
            FROM paired_devices
            WHERE user_id = $1 AND idempotency_key = $2
            ORDER BY created_at DESC
            LIMIT 1`,
            [userId, idempotencyKey]
        );

        return result.rows[0] || null;
    }

    /**
     * Find paired device by idempotency key and user (within transaction)
     * @param {object} client - Database client
     * @param {number} userId - User ID
     * @param {string} idempotencyKey - Idempotency key
     * @returns {Promise<object|null>} Paired device or null
     */
    async findByIdempotencyKeyWithClient(client, userId, idempotencyKey) {
        if (!idempotencyKey) return null;

        const result = await client.query(
            `SELECT
                id, user_id, vehicle_id, chassis_number, reg_number,
                bluetooth_mac, is_active, connected_at, last_seen,
                idempotency_key, created_at, updated_at
            FROM paired_devices
            WHERE user_id = $1 AND idempotency_key = $2
            ORDER BY created_at DESC
            LIMIT 1`,
            [userId, idempotencyKey]
        );

        return result.rows[0] || null;
    }

    /**
     * Count active paired devices for user
     * @param {number} userId - User ID
     * @returns {Promise<number>} Count of active paired devices
     */
    async countActiveForUser(userId) {
        const result = await database.query(
            `SELECT COUNT(*) as count
            FROM paired_devices
            WHERE user_id = $1 AND is_active = TRUE`,
            [userId]
        );

        return parseInt(result.rows[0].count, 10);
    }

    /**
     * Count all paired devices for user
     * @param {number} userId - User ID
     * @returns {Promise<number>} Count of all paired devices
     */
    async countAllForUser(userId) {
        const result = await database.query(
            `SELECT COUNT(*) as count
            FROM paired_devices
            WHERE user_id = $1`,
            [userId]
        );

        return parseInt(result.rows[0].count, 10);
    }

    /**
     * Find paired devices by user ID with pagination and filtering
     * @param {object} params - Query parameters
     * @param {number} params.userId - User ID
     * @param {boolean} params.active - Filter by active status (optional)
     * @param {number} params.limit - Limit for pagination
     * @param {string} params.lastSeenCursor - Cursor for last_seen field
     * @param {string} params.idCursor - Cursor for id field
     * @param {string} params.sort - Sort order (last_seen_desc or connected_at_desc)
     * @returns {Promise<Array>} Array of paired devices
     */
    async findByUserIdWithPagination({
        userId,
        active,
        limit,
        lastSeenCursor,
        idCursor,
        sort,
    }) {
        const orderBy =
            sort === "connected_at_desc"
                ? "connected_at DESC, id ASC"
                : "last_seen DESC, id ASC";

        let whereClause = "WHERE pd.user_id = $1";
        const queryParams = [userId];
        let paramIndex = 2;

        if (active !== undefined) {
            whereClause += ` AND pd.is_active = $${paramIndex++}`;
            queryParams.push(active);
        }

        if (lastSeenCursor && idCursor) {
            const cursorCondition =
                sort === "connected_at_desc"
                    ? `(pd.connected_at, pd.id) < ($${paramIndex++}, $${paramIndex++})`
                    : `(pd.last_seen, pd.id) < ($${paramIndex++}, $${paramIndex++})`;
            whereClause += ` AND ${cursorCondition}`;
            queryParams.push(lastSeenCursor, idCursor);
        }

        const query = `
            SELECT
                pd.id as paired_device_id,
                pd.is_active,
                pd.connected_at,
                pd.last_seen,
                pd.bluetooth_mac,
                pd.reg_number,
                pd.vehicle_id
            FROM paired_devices pd
            ${whereClause}
            ORDER BY ${orderBy}
            LIMIT $${paramIndex}
        `;
        queryParams.push(limit);

        const result = await database.query(query, queryParams);
        return result.rows;
    }

    /**
     * Find existing paired device by user ID and chassis number
     * @param {object} client - Database client
     * @param {number} userId - User ID
     * @param {string} chassisNumber - Chassis number
     * @returns {Promise<object|null>} Existing paired device or null
     */
    async findByUserIdAndChassisNumber(client, userId, chassisNumber) {
        const result = await client.query(
            `SELECT * FROM paired_devices
            WHERE user_id = $1 AND chassis_number = $2
            ORDER BY connected_at DESC LIMIT 1`,
            [userId, chassisNumber]
        );

        return result.rows[0] || null;
    }

    /**
     * Create a new paired device
     * @param {object} client - Database client
     * @param {object} deviceData - Device data
     * @param {number} deviceData.userId - User ID
     * @param {string} deviceData.vehicleId - Vehicle ID
     * @param {string} deviceData.chassisNumber - Chassis number
     * @param {string} deviceData.regNumber - Registration number
     * @param {string} deviceData.bluetoothMac - Bluetooth MAC address
     * @param {string} deviceData.idempotencyKey - Idempotency key
     * @returns {Promise<object>} Created paired device
     */
    async create(client, deviceData) {
        const {
            userId,
            vehicleId,
            chassisNumber,
            regNumber,
            bluetoothMac,
            idempotencyKey,
        } = deviceData;

        const result = await client.query(
            `INSERT INTO paired_devices (
                id, user_id, vehicle_id, chassis_number, reg_number,
                bluetooth_mac, is_active, connected_at, last_seen,
                device_metadata, idempotency_key, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, TRUE, NOW(), NOW(),
                '{}', $6, NOW(), NOW()
            )
            RETURNING *`,
            [
                userId,
                vehicleId,
                chassisNumber || null,
                regNumber || null,
                bluetoothMac || null,
                idempotencyKey || null,
            ]
        );

        return result.rows[0];
    }

    /**
     * Update existing paired device
     * @param {object} client - Database client
     * @param {string} deviceId - Device ID
     * @returns {Promise<object>} Updated paired device
     */
    async update(client, deviceId) {
        const result = await client.query(
            `UPDATE paired_devices
            SET last_seen = NOW(), is_active = TRUE, updated_at = NOW()
            WHERE id = $1
            RETURNING *`,
            [deviceId]
        );

        return result.rows[0];
    }

    /**
     * Count active paired devices for user
     * @param {object} client - Database client
     * @param {number} userId - User ID
     * @returns {Promise<number>} Count of active paired devices
     */
    async countActiveForUserWithClient(client, userId) {
        const result = await client.query(
            `SELECT COUNT(*) as count
            FROM paired_devices
            WHERE user_id = $1 AND is_active = TRUE`,
            [userId]
        );

        return parseInt(result.rows[0].count, 10);
    }
}

// Export singleton instance
export default new PairedDeviceModel();
