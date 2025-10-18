/**
 * User Model
 * Handles all user-related database operations
 */

import { database } from "@ev-platform/shared";

class UserModel {
    /**
     * Find user by ID
     * @param {number} id - User ID
     * @returns {Promise<object|null>} User object or null
     */
    async findById(id) {
        const result = await database.query(
            "SELECT id, phone, country_code, is_verified, is_active, metadata, created_at, updated_at, last_login_at FROM users WHERE id = $1",
            [id]
        );

        return result.rows[0] || null;
    }

    /**
     * Find user by phone number (optimized with index hint)
     * IMPORTANT: Ensure `phone` column has a B-tree index for O(log n) lookups
     * CREATE INDEX CONCURRENTLY idx_users_phone ON users(phone);
     *
     * @param {string} phone - Phone number in E.164 format
     * @returns {Promise<object|null>} User object or null
     */
    async findByPhone(phone) {
        const result = await database.query(
            "SELECT id, phone, country_code, is_verified, is_active, metadata, created_at, updated_at, last_login_at FROM users WHERE phone = $1",
            [phone]
        );

        return result.rows[0] || null;
    }

    /**
     * Check if phone exists (lightweight query for existence check only)
     * Returns only minimal data needed for verification
     *
     * @param {string} phone - Phone number in E.164 format
     * @returns {Promise<boolean>} True if phone exists
     */
    async phoneExists(phone) {
        const result = await database.query(
            "SELECT 1 FROM users WHERE phone = $1 LIMIT 1",
            [phone]
        );

        return result.rows.length > 0;
    }

    /**
     * Batch check phone existence (for cache warming)
     * @param {string[]} phones - Array of phone numbers
     * @returns {Promise<Set>} Set of phones that exist
     */
    async batchCheckPhones(phones) {
        if (!phones || phones.length === 0) {
            return new Set();
        }

        const result = await database.query(
            "SELECT phone FROM users WHERE phone = ANY($1)",
            [phones]
        );

        return new Set(result.rows.map((row) => row.phone));
    }

    /**
     * Get all phone numbers (for Bloom filter population)
     * WARNING: This can be memory-intensive for large datasets
     * Use with pagination in production
     *
     * @param {number} limit - Maximum number of phones to return
     * @param {number} offset - Offset for pagination
     * @returns {Promise<string[]>} Array of phone numbers
     */
    async getAllPhones(limit = 10000, offset = 0) {
        const result = await database.query(
            "SELECT phone FROM users WHERE phone IS NOT NULL ORDER BY id LIMIT $1 OFFSET $2",
            [limit, offset]
        );

        return result.rows.map((row) => row.phone);
    }

    /**
     * Create or update user (upsert) and mark as verified
     * @param {string} phone - Phone number in E.164 format
     * @param {string} countryCode - Country code (e.g., 'IN', 'US')
     * @returns {Promise<object>} Created/updated user
     */
    async upsertVerified(phone, countryCode) {
        const result = await database.query(
            `
            INSERT INTO users (phone, country_code, is_verified, last_login_at)
            VALUES ($1, $2, TRUE, NOW())
            ON CONFLICT (phone)
            DO UPDATE SET
                is_verified = TRUE,
                last_login_at = NOW(),
                updated_at = NOW()
            RETURNING id, phone, country_code, is_verified, created_at
        `,
            [phone, countryCode]
        );

        return result.rows[0];
    }

    /**
     * Create a new user
     * @param {object} userData - User data
     * @returns {Promise<object>} Created user
     */
    async create(userData) {
        const { phone, countryCode, isVerified = false } = userData;

        const result = await database.query(
            `
            INSERT INTO users (phone, country_code, is_verified)
            VALUES ($1, $2, $3)
            RETURNING id, phone, country_code, is_verified, created_at
        `,
            [phone, countryCode, isVerified]
        );

        return result.rows[0];
    }

    /**
     * Update user's last login time
     * @param {number} userId - User ID
     * @returns {Promise<boolean>} Success status
     */
    async updateLastLogin(userId) {
        await database.query(
            "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1",
            [userId]
        );

        return true;
    }

    /**
     * Update user verification status
     * @param {string} phone - Phone number
     * @param {boolean} isVerified - Verification status
     * @returns {Promise<boolean>} Success status
     */
    async updateVerificationStatus(phone, isVerified) {
        await database.query(
            "UPDATE users SET is_verified = $1, updated_at = NOW() WHERE phone = $2",
            [isVerified, phone]
        );

        return true;
    }

    /**
     * Update user metadata
     * @param {number} userId - User ID
     * @param {object} metadata - Metadata to merge
     * @returns {Promise<boolean>} Success status
     */
    async updateMetadata(userId, metadata) {
        await database.query(
            "UPDATE users SET metadata = metadata || $1::jsonb, updated_at = NOW() WHERE id = $2",
            [JSON.stringify(metadata), userId]
        );

        return true;
    }

    /**
     * Get user statistics
     * @returns {Promise<object>} User statistics
     */
    async getStats() {
        const result = await database.query(`
            SELECT
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE is_verified = TRUE) as verified_users,
                COUNT(*) FILTER (WHERE is_active = TRUE) as active_users,
                COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '7 days') as active_last_7_days
            FROM users
        `);

        return result.rows[0];
    }
}

// Export singleton instance
export default new UserModel();
