/**
 * Vehicle Pairing Service
 * Handles all vehicle pairing operations including listing, caching, and management
 */

import { createLogger, redis, database } from "@ev-platform/shared";
import { PairedDevice } from "../models/index.js";
import Vehicle from "../models/vehicle.model.js";

const logger = createLogger("vehicle-pairing");

class PairingService {
    /**
     * Pair a vehicle with a device
     * @param {object} pairingData - Pairing data
     * @param {number} pairingData.userId - User ID
     * @param {string} pairingData.chassisNumber - Vehicle chassis number
     * @param {string} pairingData.regNumber - Vehicle registration number
     * @param {string} pairingData.bluetoothMac - Bluetooth MAC address
     * @param {object} pairingData.vehicleStatic - Vehicle static data (make, model, etc.)
     * @param {string} pairingData.idempotencyKey - Idempotency key for duplicate request prevention
     * @returns {Promise<object>} Pairing result with paired device and vehicle info
     */
    async pairVehicle(pairingData) {
        const {
            userId,
            chassisNumber,
            regNumber,
            bluetoothMac,
            vehicleStatic = {},
            idempotencyKey,
        } = pairingData;

        logger.info("Starting vehicle pairing", {
            userId,
            chassisNumber,
            regNumber,
        });

        // Get database client for transaction
        const client = await database.getClient();

        try {
            // Start transaction
            await client.query("BEGIN");

            // Acquire advisory lock to prevent concurrent pairings
            const advisoryLockHash = `hash_${chassisNumber}`;
            const lockResult = await client.query(
                "SELECT pg_try_advisory_xact_lock(hashtext($1)) as acquired",
                [advisoryLockHash]
            );

            if (!lockResult.rows[0].acquired) {
                await client.query("ROLLBACK");
                await client.release();
                throw new Error("Resource is locked, please try again");
            }

            // Check if idempotency key exists (for duplicate request prevention)
            let existingPairedDevice = null;
            if (idempotencyKey) {
                existingPairedDevice =
                    await PairedDevice.findByIdempotencyKeyWithClient(
                        client,
                        userId,
                        idempotencyKey
                    );
                if (existingPairedDevice) {
                    // Idempotent request - return existing result
                    const countResult =
                        await PairedDevice.countActiveForUserWithClient(
                            client,
                            userId
                        );
                    await client.query("COMMIT");
                    await client.release();

                    await this.invalidateUserCaches(userId);
                    await this.updateUserCounters(userId, countResult);

                    logger.info("Vehicle pairing completed (idempotent)", {
                        pairedDeviceId: existingPairedDevice.id,
                        vehicleId: existingPairedDevice.vehicle_id,
                    });

                    return {
                        pairedDeviceId: existingPairedDevice.id,
                        vehicleId: existingPairedDevice.vehicle_id,
                        pairedDevicesCount: countResult,
                    };
                }
            }

            // Find or create vehicle
            let vehicle =
                (await Vehicle.findByChassisNumber(client, chassisNumber)) ||
                (await Vehicle.findByRegNumber(client, regNumber));

            if (vehicle) {
                // Update existing vehicle if needed
                const updateData = {};
                if (regNumber && regNumber !== vehicle.reg_number) {
                    updateData.regNumber = regNumber;
                }
                if (chassisNumber && chassisNumber !== vehicle.chassis_number) {
                    updateData.chassisNumber = chassisNumber;
                }
                if (vehicleStatic.make) updateData.make = vehicleStatic.make;
                if (vehicleStatic.model) updateData.model = vehicleStatic.model;
                if (vehicleStatic.year) updateData.year = vehicleStatic.year;
                if (vehicleStatic.battery_capacity_kwh)
                    updateData.batteryCapacityKwh =
                        vehicleStatic.battery_capacity_kwh;
                if (vehicleStatic.efficiency_kwh_per_km)
                    updateData.efficiencyKwhPerKm =
                        vehicleStatic.efficiency_kwh_per_km;
                if (userId && !vehicle.user_id) {
                    updateData.userId = userId;
                }

                if (Object.keys(updateData).length > 0) {
                    vehicle = await Vehicle.update(
                        client,
                        vehicle.id,
                        updateData
                    );
                }
            } else {
                // Create new vehicle
                vehicle = await Vehicle.create(client, {
                    regNumber,
                    chassisNumber,
                    userId,
                    make: vehicleStatic.make,
                    model: vehicleStatic.model,
                    year: vehicleStatic.year,
                    batteryCapacityKwh: vehicleStatic.battery_capacity_kwh,
                    efficiencyKwhPerKm: vehicleStatic.efficiency_kwh_per_km,
                });
            }

            // Check for existing paired device
            const existingDevice =
                await PairedDevice.findByUserIdAndChassisNumber(
                    client,
                    userId,
                    chassisNumber
                );

            let pairedDevice;

            if (existingDevice) {
                // Update existing paired device
                pairedDevice = await PairedDevice.update(
                    client,
                    existingDevice.id
                );
            } else {
                // Create new paired device
                pairedDevice = await PairedDevice.create(client, {
                    userId,
                    vehicleId: vehicle.id,
                    chassisNumber,
                    regNumber,
                    bluetoothMac,
                    idempotencyKey,
                });
            }

            // Count active paired devices for user
            const pairedDevicesCount =
                await PairedDevice.countActiveForUserWithClient(client, userId);

            // Commit transaction
            await client.query("COMMIT");
            await client.release();

            // Invalidate caches for the user after successful pairing
            await this.invalidateUserCaches(userId);

            // Update counters in cache
            await this.updateUserCounters(userId, pairedDevicesCount);

            logger.info("Vehicle pairing completed successfully", {
                pairedDeviceId: pairedDevice.id,
                vehicleId: vehicle.id,
                pairedDevicesCount,
            });

            return {
                pairedDeviceId: pairedDevice.id,
                vehicleId: vehicle.id,
                pairedDevicesCount,
            };
        } catch (error) {
            // Rollback transaction on error
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                logger.error("Rollback failed", {
                    error: rollbackError.message,
                });
            }
            await client.release();

            logger.error("Vehicle pairing failed", {
                error: error.message,
                stack: error.stack,
            });

            throw error;
        }
    }

    /**
     * Get paired devices for authenticated user with pagination and filtering
     * @param {object} params - Query parameters
     * @param {number} params.userId - User ID
     * @param {boolean} params.active - Filter by active status (optional)
     * @param {string[]} params.include - Include expansions (vehicle, latest_status)
     * @param {number} params.limit - Page size (1-100)
     * @param {string} params.cursor - Pagination cursor
     * @param {string} params.sort - Sort order
     * @returns {Promise<object>} Paginated paired devices response
     */
    async getPairedDevices(params) {
        const {
            userId,
            active,
            include = ["vehicle", "latest_status"],
            limit = 20,
            cursor,
            sort = "last_seen_desc",
        } = params;

        try {
            // Normalize include to array (validation schema handles most of this)
            let includeArray = include || ["vehicle", "latest_status"];
            if (!Array.isArray(includeArray)) {
                includeArray = includeArray
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
            }
            if (includeArray.length === 0) {
                includeArray = ["vehicle", "latest_status"];
            }

            // Get version for cache invalidation
            const version = await this.getUserCacheVersion(userId);

            // Build versioned cache key for O(1) invalidation
            const includeHash = includeArray.sort().join(",");
            const cacheKey = `paired:list:${userId}:${version}:${
                active || "all"
            }:${sort}:${limit}:${cursor || "0"}:${includeHash}`;

            // Try to get from cache first
            const cached = await this.getFromCache(cacheKey);
            if (cached) {
                logger.debug("Served from cache", { cacheKey });
                return cached;
            }

            // Decode cursor for pagination
            const { lastSeenCursor, idCursor } = this.decodeCursor(cursor);

            // Get base paired devices with pagination
            const pairedDevices = await PairedDevice.findByUserIdWithPagination(
                {
                    userId,
                    active,
                    limit: limit + 1, // Fetch one extra to determine has_more
                    lastSeenCursor,
                    idCursor,
                    sort,
                }
            );

            // Determine pagination info
            const hasMore = pairedDevices.length > limit;
            const page = pairedDevices.slice(0, limit);
            const nextCursor = hasMore
                ? this.encodeCursor(page[page.length - 1])
                : null;

            // Get expansions if requested
            let vehicleMap = {};
            let statusMap = {};

            if (includeArray.includes("vehicle") && page.length > 0) {
                const vehicleIds = page
                    .map((pd) => pd.vehicle_id)
                    .filter((id) => id);
                vehicleMap = await Vehicle.findByIds(vehicleIds);
            }

            if (includeArray.includes("latest_status") && page.length > 0) {
                const vehicleIds = page
                    .map((pd) => pd.vehicle_id)
                    .filter((id) => id);
                statusMap = await this.getLatestStatusMap(vehicleIds);
            }

            // Get counts from cache or DB
            const { totalActive, totalAll } = await this.getCounts(userId);

            // Assemble response
            const response = {
                data: page.map((pd) =>
                    this.formatPairedDevice(
                        pd,
                        vehicleMap,
                        statusMap,
                        includeArray
                    )
                ),
                page_info: {
                    next_cursor: nextCursor,
                    limit,
                    has_more: hasMore,
                },
                total_active: totalActive,
                total_all: totalAll,
            };

            // Cache the response
            await this.setCache(cacheKey, response, 30); // 30 seconds TTL

            return response;
        } catch (error) {
            logger.error("Failed to get paired devices", {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Invalidate all caches for a user after pairing changes
     * Uses version bump pattern for O(1) invalidation
     */
    async invalidateUserCaches(userId) {
        try {
            // Bump version key - this invalidates all list caches instantly
            const versionKey = `paired:ver:${userId}`;
            const newVersion = await redis.incr(versionKey);

            logger.info("Invalidated user caches", { userId, newVersion });

            // Set expiration on version key to prevent unbounded growth
            await redis.expire(versionKey, 86400 * 7); // 7 days

            return newVersion;
        } catch (error) {
            logger.warn("Cache invalidation failed", {
                userId,
                error: error.message,
            });
            // Don't fail the request if cache invalidation fails
        }
    }

    /**
     * Update user counters in cache
     */
    async updateUserCounters(userId, totalActiveCount) {
        try {
            // Update active count
            await redis.setex(
                `paired:count:active:${userId}`,
                3600,
                totalActiveCount.toString()
            );

            logger.debug("Updated user counters", { userId, totalActiveCount });
        } catch (error) {
            logger.warn("Counter update failed", {
                userId,
                error: error.message,
            });
        }
    }

    /**
     * Get user cache version (for O(1) invalidation)
     */
    async getUserCacheVersion(userId) {
        try {
            const version = await redis.getRaw(`paired:ver:${userId}`);
            return version || "0";
        } catch (error) {
            logger.warn("Failed to get cache version", {
                userId,
                error: error.message,
            });
            return "0";
        }
    }

    /**
     * Get latest status map for given vehicle IDs
     */
    async getLatestStatusMap(vehicleIds) {
        if (vehicleIds.length === 0) return {};

        // Try to get from Redis cache first - optimized with mget for batch operations
        const cacheKeys = vehicleIds.map((id) => `lvs:${id}`);
        let cachedResults = [];

        try {
            const values = await redis.mget(...cacheKeys);
            cachedResults = values.map((val, idx) => {
                if (val) {
                    try {
                        return {
                            vehicleId: vehicleIds[idx],
                            status: JSON.parse(val),
                        };
                    } catch (parseError) {
                        logger.warn("Failed to parse cached status", {
                            vehicleId: vehicleIds[idx],
                        });
                        return null;
                    }
                }
                return null;
            });
        } catch (error) {
            logger.warn("Batch cache get failed", { error: error.message });
            // Fall back to empty array
            cachedResults = [];
        }

        const map = {};
        const uncachedIds = [];

        cachedResults.forEach((result, idx) => {
            if (result) {
                map[result.vehicleId] = result.status;
            } else {
                uncachedIds.push(vehicleIds[idx]);
            }
        });

        // For uncached vehicles, try to get from DB
        if (uncachedIds.length > 0) {
            try {
                const dbStatusMap = await Vehicle.findLatestStatusByIds(
                    uncachedIds
                );
                Object.assign(map, dbStatusMap);
            } catch (error) {
                logger.warn("Failed to get latest status from DB", {
                    error: error.message,
                });
                // Return empty status for uncached vehicles
                uncachedIds.forEach((vehicleId) => {
                    if (!map[vehicleId]) {
                        map[vehicleId] = null;
                    }
                });
            }
        }

        return map;
    }

    /**
     * Get counts for active and total paired devices
     */
    async getCounts(userId) {
        try {
            // Try to get from Redis cache first
            const [totalActive, totalAll] = await Promise.all([
                redis.getRaw(`paired:count:active:${userId}`),
                redis.getRaw(`paired:count:all:${userId}`),
            ]);

            if (totalActive !== null && totalAll !== null) {
                return {
                    totalActive: parseInt(totalActive, 10),
                    totalAll: parseInt(totalAll, 10),
                };
            }
        } catch (error) {
            logger.warn("Failed to get counts from cache", {
                error: error.message,
            });
        }

        // Fallback to DB
        const [totalActive, totalAll] = await Promise.all([
            PairedDevice.countActiveForUser(userId),
            PairedDevice.countAllForUser(userId),
        ]);

        return {
            totalActive,
            totalAll,
        };
    }

    /**
     * Format paired device for response
     */
    formatPairedDevice(pd, vehicleMap, statusMap, include) {
        // Ensure include is an array
        const includeArray = Array.isArray(include) ? include : [];

        // Base device info
        const formatted = {
            id: pd.paired_device_id,
            status: pd.is_active ? "active" : "inactive",
            connected_at: pd.connected_at,
            device: {
                bluetooth_mac: pd.bluetooth_mac,
            },
            vehicle_info: {
                reg_number: pd.reg_number,
            },
        };

        // Add vehicle details if requested
        if (
            includeArray.includes("vehicle") &&
            pd.vehicle_id &&
            vehicleMap[pd.vehicle_id]
        ) {
            const vehicle = vehicleMap[pd.vehicle_id];
            formatted.vehicle_info.make = vehicle.make;
            formatted.vehicle_info.model = vehicle.model;
        }

        // Add latest status if requested
        if (
            includeArray.includes("latest_status") &&
            pd.vehicle_id &&
            statusMap[pd.vehicle_id]
        ) {
            formatted.status_info = statusMap[pd.vehicle_id];
        }

        return formatted;
    }

    /**
     * Encode cursor for pagination
     */
    encodeCursor(lastItem) {
        if (!lastItem) return null;
        const cursorData = {
            last_seen: lastItem.last_seen,
            id: lastItem.paired_device_id,
        };
        return Buffer.from(JSON.stringify(cursorData)).toString("base64");
    }

    /**
     * Decode cursor for pagination
     */
    decodeCursor(cursor) {
        if (!cursor) return { lastSeenCursor: null, idCursor: null };
        try {
            const cursorData = JSON.parse(
                Buffer.from(cursor, "base64").toString()
            );
            return {
                lastSeenCursor: cursorData.last_seen,
                idCursor: cursorData.id,
            };
        } catch (error) {
            logger.warn("Invalid cursor format", {
                cursor,
                error: error.message,
            });
            return { lastSeenCursor: null, idCursor: null };
        }
    }

    /**
     * Get data from cache
     */
    async getFromCache(key) {
        try {
            const cached = await redis.get(key);
            return cached;
        } catch (error) {
            logger.warn("Cache get failed", { key, error: error.message });
            return null;
        }
    }

    /**
     * Set data in cache
     */
    async setCache(key, data, ttlSeconds) {
        try {
            // Use setex for atomic SET with expiration
            await redis.setex(key, ttlSeconds, JSON.stringify(data));
        } catch (error) {
            logger.warn("Cache set failed", {
                key,
                error: error.message,
                stack: error.stack,
            });
            // Don't throw - cache failure shouldn't break the request
        }
    }
}

// Export singleton instance
export default new PairingService();
