/**
 * OTP Audit Model
 * Handles all OTP audit log database operations
 */

import { database } from "@ev-platform/shared";

class OtpAuditModel {
    /**
     * Create an audit log entry
     * @param {object} auditData - Audit data
     * @returns {Promise<object>} Created audit entry
     */
    async create(auditData) {
        const {
            phone,
            eventType,
            provider = null,
            providerResponse = null,
            ip = null,
            userAgent = null,
            metadata = null,
        } = auditData;

        const result = await database.query(
            `
            INSERT INTO otp_audit (phone, event_type, provider, provider_response, ip, user_agent, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, phone, event_type, provider, created_at
        `,
            [
                phone,
                eventType,
                provider,
                providerResponse ? JSON.stringify(providerResponse) : null,
                ip,
                userAgent,
                metadata ? JSON.stringify(metadata) : null,
            ]
        );

        return result.rows[0];
    }

    /**
     * Get audit logs for a phone number
     * @param {string} phone - Phone number
     * @param {object} options - Query options
     * @returns {Promise<array>} Audit logs
     */
    async findByPhone(phone, options = {}) {
        const { limit = 50, offset = 0, eventType = null } = options;

        let query = `
            SELECT id, phone, event_type, provider, provider_response, ip, user_agent, metadata, created_at
            FROM otp_audit
            WHERE phone = $1
        `;

        const params = [phone];

        if (eventType) {
            query += ` AND event_type = $${params.length + 1}`;
            params.push(eventType);
        }

        query += ` ORDER BY created_at DESC LIMIT $${
            params.length + 1
        } OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await database.query(query, params);
        return result.rows;
    }

    /**
     * Get recent audit logs
     * @param {object} options - Query options
     * @returns {Promise<array>} Recent audit logs
     */
    async getRecent(options = {}) {
        const { limit = 100, eventType = null, hours = 24 } = options;

        let query = `
            SELECT id, phone, event_type, provider, provider_response, ip, created_at
            FROM otp_audit
            WHERE created_at > NOW() - INTERVAL '${hours} hours'
        `;

        const params = [];

        if (eventType) {
            query += ` AND event_type = $${params.length + 1}`;
            params.push(eventType);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
        params.push(limit);

        const result = await database.query(query, params);
        return result.rows;
    }

    /**
     * Get audit statistics
     * @param {object} options - Query options
     * @returns {Promise<object>} Audit statistics
     */
    async getStats(options = {}) {
        const { hours = 24 } = options;

        const result = await database.query(
            `
            SELECT
                event_type,
                COUNT(*) as count,
                COUNT(DISTINCT phone) as unique_phones
            FROM otp_audit
            WHERE created_at > NOW() - INTERVAL '${hours} hours'
            GROUP BY event_type
            ORDER BY count DESC
        `
        );

        return result.rows;
    }

    /**
     * Get OTP request count for a phone in a time period
     * @param {string} phone - Phone number
     * @param {number} hours - Time period in hours
     * @returns {Promise<number>} Request count
     */
    async getRequestCount(phone, hours = 1) {
        const result = await database.query(
            `
            SELECT COUNT(*) as count
            FROM otp_audit
            WHERE phone = $1
                AND event_type = 'requested'
                AND created_at > NOW() - INTERVAL '${hours} hours'
        `,
            [phone]
        );

        return parseInt(result.rows[0]?.count || 0);
    }

    /**
     * Get failed verification attempts for a phone
     * @param {string} phone - Phone number
     * @param {number} minutes - Time period in minutes
     * @returns {Promise<number>} Failed attempt count
     */
    async getFailedVerifications(phone, minutes = 5) {
        const result = await database.query(
            `
            SELECT COUNT(*) as count
            FROM otp_audit
            WHERE phone = $1
                AND event_type IN ('verify_failed', 'verify_locked')
                AND created_at > NOW() - INTERVAL '${minutes} minutes'
        `,
            [phone]
        );

        return parseInt(result.rows[0]?.count || 0);
    }

    /**
     * Delete old audit logs (for cleanup)
     * @param {number} days - Delete logs older than this many days
     * @returns {Promise<number>} Number of deleted records
     */
    async deleteOlderThan(days = 90) {
        const result = await database.query(
            `
            DELETE FROM otp_audit
            WHERE created_at < NOW() - INTERVAL '${days} days'
        `
        );

        return result.rowCount;
    }
}

// Export singleton instance
export default new OtpAuditModel();
