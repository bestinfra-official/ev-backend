/**
 * Booking Redis Service
 * Manages holds and booking operations in Redis with atomic Lua scripts
 */

import { redis, createLogger } from "@ev-platform/shared";

const logger = createLogger("booking-redis-service");

// Redis key patterns
const KEY_PATTERNS = {
    HOLD: "slot_hold:{connector_id}:{start}:{end}",
    HOLD_BY_TOKEN: "hold_token:{token}",
    CONNECTOR_HOLDS: "connector_holds:{connector_id}",
};

// Hold configuration
const HOLD_TTL = parseInt(process.env.BOOKING_HOLD_TTL_SECONDS || "600"); // 10 minutes

class BookingRedisService {
    constructor() {
        this.client = null;
        this._initLuaScripts();
    }

    _getClient() {
        if (!this.client) {
            this.client = redis.getClient();
        }
        return this.client;
    }

    /**
     * Initialize Lua scripts for atomic operations
     */
    _initLuaScripts() {
        // Lua script to create a hold atomically
        // Checks if slot is free and sets hold key if available
        this.createHoldScript = `
            local holdKey = KEYS[1]
            local tokenKey = KEYS[2]
            local connectorHoldsKey = KEYS[3]
            local holdData = ARGV[1]
            local ttl = tonumber(ARGV[2])
            local token = ARGV[3]
            local connectorId = ARGV[4]
            local start = tonumber(ARGV[5])
            local end = tonumber(ARGV[6])

            -- Check if hold already exists
            if redis.call('exists', holdKey) == 1 then
                return {'err', 'SLOT_ALREADY_HELD'}
            end

            -- Check for overlapping holds (simplified check)
            local existingHolds = redis.call('zrange', connectorHoldsKey, 0, -1)
            for i, existingHold in ipairs(existingHolds) do
                local parts = {}
                for part in string.gmatch(existingHold, "[^:]+") do
                    table.insert(parts, part)
                end
                if #parts >= 3 then
                    local existingStart = tonumber(parts[#parts - 1])
                    local existingEnd = tonumber(parts[#parts])
                    local newStart = start
                    local newEnd = end
                    if (newStart < existingEnd and newEnd > existingStart) then
                        return {'err', 'OVERLAPPING_HOLD'}
                    end
                end
            end

            -- Create hold
            redis.call('setex', holdKey, ttl, holdData)
            redis.call('setex', tokenKey, ttl, holdKey)
            redis.call('zadd', connectorHoldsKey, start, holdKey)
            redis.call('expire', connectorHoldsKey, ttl + 60)

            return {'ok', token}
        `;

        // Lua script to release a hold
        this.releaseHoldScript = `
            local holdKey = KEYS[1]
            local tokenKey = KEYS[2]
            local connectorHoldsKey = KEYS[3]

            if redis.call('exists', holdKey) == 0 then
                return {'err', 'HOLD_NOT_FOUND'}
            end

            redis.call('del', holdKey)
            redis.call('del', tokenKey)
            redis.call('zrem', connectorHoldsKey, holdKey)

            return {'ok', 'RELEASED'}
        `;

        // Lua script to verify and get hold
        this.verifyHoldScript = `
            local tokenKey = KEYS[1]

            local holdKey = redis.call('get', tokenKey)
            if not holdKey then
                return {'err', 'INVALID_TOKEN'}
            end

            local holdData = redis.call('get', holdKey)
            if not holdData then
                return {'err', 'HOLD_EXPIRED'}
            end

            return {'ok', holdData}
        `;
    }

    /**
     * Create a hold for a slot (atomic operation)
     * @param {string} connectorId - Connector ID
     * @param {number} startTs - Start timestamp (unix seconds)
     * @param {number} endTs - End timestamp (unix seconds)
     * @param {object} holdData - Hold metadata
     * @returns {Promise<{token: string, expiresIn: number}>}
     */
    async createHold(connectorId, startTs, endTs, holdData = {}) {
        try {
            const token = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
            const holdKey = KEY_PATTERNS.HOLD
                .replace("{connector_id}", connectorId)
                .replace("{start}", Math.floor(startTs))
                .replace("{end}", Math.floor(endTs));
            const tokenKey = KEY_PATTERNS.HOLD_BY_TOKEN.replace("{token}", token);
            const connectorHoldsKey = KEY_PATTERNS.CONNECTOR_HOLDS.replace(
                "{connector_id}",
                connectorId
            );

            const holdDataJson = JSON.stringify({
                connectorId,
                startTs: Math.floor(startTs),
                endTs: Math.floor(endTs),
                token,
                createdAt: Math.floor(Date.now() / 1000),
                ...holdData,
            });

            // Execute Lua script
            const result = await this._getClient().eval(
                this.createHoldScript,
                3,
                holdKey,
                tokenKey,
                connectorHoldsKey,
                holdDataJson,
                HOLD_TTL.toString(),
                token,
                connectorId,
                Math.floor(startTs).toString(),
                Math.floor(endTs).toString()
            );

            if (result && result[0] === "err") {
                throw new Error(result[1] || "Failed to create hold");
            }

            if (result && result[0] === "ok") {
                return {
                    token: result[1] || token,
                    expiresIn: HOLD_TTL,
                };
            }

            throw new Error("Unexpected response from Redis");
        } catch (error) {
            logger.error("Failed to create hold", {
                error: error.message,
                connectorId,
                startTs,
                endTs,
            });
            throw error;
        }
    }

    /**
     * Release a hold
     * @param {string} token - Hold token
     * @returns {Promise<void>}
     */
    async releaseHold(token) {
        try {
            const tokenKey = KEY_PATTERNS.HOLD_BY_TOKEN.replace("{token}", token);
            const holdKey = await this._getClient().get(tokenKey);

            if (!holdKey) {
                throw new Error("Hold not found or expired");
            }

            // Extract connector ID from hold key
            const parts = holdKey.split(":");
            const connectorId = parts[1]?.replace("slot_hold", "")?.split(":")[1] || "";
            const connectorHoldsKey = KEY_PATTERNS.CONNECTOR_HOLDS.replace(
                "{connector_id}",
                connectorId
            );

            // Execute Lua script
            const result = await this._getClient().eval(
                this.releaseHoldScript,
                3,
                holdKey,
                tokenKey,
                connectorHoldsKey
            );

            if (result && result[0] === "err") {
                throw new Error(result[1] || "Failed to release hold");
            }

            logger.debug("Released hold", { token });
        } catch (error) {
            logger.error("Failed to release hold", {
                error: error.message,
                token,
            });
            throw error;
        }
    }

    /**
     * Verify and get hold data
     * @param {string} token - Hold token
     * @returns {Promise<object|null>} Hold data or null
     */
    async verifyHold(token) {
        try {
            const tokenKey = KEY_PATTERNS.HOLD_BY_TOKEN.replace("{token}", token);

            // Execute Lua script
            const result = await this._getClient().eval(
                this.verifyHoldScript,
                1,
                tokenKey
            );

            if (result && result[0] === "err") {
                return null;
            }

            if (result && result[0] === "ok") {
                return JSON.parse(result[1]);
            }

            return null;
        } catch (error) {
            logger.error("Failed to verify hold", {
                error: error.message,
                token,
            });
            return null;
        }
    }

    /**
     * Get all active holds for a connector
     * @param {string} connectorId - Connector ID
     * @returns {Promise<Array>} Array of hold keys
     */
    async getConnectorHolds(connectorId) {
        try {
            const connectorHoldsKey = KEY_PATTERNS.CONNECTOR_HOLDS.replace(
                "{connector_id}",
                connectorId
            );

            const holds = await this._getClient().zrange(connectorHoldsKey, 0, -1);
            return holds;
        } catch (error) {
            logger.error("Failed to get connector holds", {
                error: error.message,
                connectorId,
            });
            return [];
        }
    }
}

export default new BookingRedisService();

