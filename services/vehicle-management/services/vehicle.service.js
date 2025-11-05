/**
 * Vehicle Service
 * Handles vehicle data fetching with caching, pagination, and optimization
 */

import { createLogger, redis, database } from "@ev-platform/shared";
import { PairedDevice, Vehicle } from "../models/index.js";

const logger = createLogger("vehicle-service");

class VehicleService {
    /**
     * Get vehicles for authenticated user
     * @param {object} params - Query parameters
     * @param {number} params.userId - User ID from JWT
     * @param {boolean} params.active - Filter by active status (optional)
     * @param {number} params.limit - Page size (1-100), default 10
     * @param {string} params.cursor - Pagination cursor
     * @param {string} params.sort - Sort order (last_seen_desc, make)
     * @param {string} params.selectedVehicleId - Optional selected vehicle ID to prioritize
     * @returns {Promise<object>} Vehicles response
     */
    async getVehicles(params) {
        const {
            userId,
            active,
            limit = 10,
            cursor,
            sort = "last_seen_desc",
            selectedVehicleId,
        } = params;

        try {
            // Get version for cache invalidation
            const version = await this.getUserCacheVersion(userId);
            // Build versioned cache key for O(1) invalidation
            const cacheKey = `vehicles:${userId}:${version}:${
                active !== undefined ? (active ? "active" : "inactive") : "all"
            }:${sort}:${limit}:${cursor || "0"}:${selectedVehicleId || "none"}`;

            // Try to get from cache first
            const cached = await this.getFromCache(cacheKey);
            if (cached) {
                logger.debug("Served vehicles from cache", { cacheKey });
                return cached;
            }

            // Decode cursor for pagination
            const { lastSeenCursor, idCursor } = this.decodeCursor(
                cursor,
                sort
            );

            // Fetch paired devices with pagination (fetch limit+1 to detect has_more)
            const pairedDevices = await PairedDevice.findForVehicles({
                userId,
                active,
                limit: limit + 1, // Fetch one extra for has_more detection
                lastSeenCursor,
                idCursor,
                sort,
            });

            // Determine pagination info
            const hasMore = pairedDevices.length > limit;
            const page = pairedDevices.slice(0, limit);
            const nextCursor = hasMore
                ? this.encodeCursor(page[page.length - 1], sort)
                : null;

            // Extract vehicle IDs
            const vehicleIds = page
                .map((pd) => pd.vehicle_id)
                .filter((id) => id);

            if (vehicleIds.length === 0) {
                // No vehicles in page, but check if selected_vehicle_id should be returned
                if (selectedVehicleId) {
                    vehicleIds.push(selectedVehicleId);
                } else {
                    // No vehicles, return empty response
                    const { totalActive, totalAll } = await this.getCounts(
                        userId
                    );
                    const response = {
                        data: [],
                        page_info: {
                            next_cursor: null,
                            limit,
                            has_more: false,
                        },
                        counts: {
                            total_all: totalAll,
                            total_active: totalActive,
                        },
                    };

                    // Cache empty response for shorter TTL
                    await this.setCache(cacheKey, response, 5);
                    return response;
                }
            }

            // If selected_vehicle_id is provided and not in current page, prepend it
            let finalVehicleIds = [...vehicleIds];
            if (selectedVehicleId && !vehicleIds.includes(selectedVehicleId)) {
                finalVehicleIds = [selectedVehicleId, ...vehicleIds];
            }

            // Batch fetch vehicles
            const vehiclesMap = await Vehicle.findByIds(finalVehicleIds);

            // Get counts
            const { totalActive, totalAll } = await this.getCounts(userId);

            // Format response data
            const data = finalVehicleIds
                .map((vehicleId) => {
                    const vehicle = vehiclesMap[vehicleId];
                    if (!vehicle) return null;

                    const pairedDevice = page.find(
                        (pd) => pd.vehicle_id === vehicleId
                    );

                    return this.formatVehicle(vehicle, pairedDevice, userId);
                })
                .filter(Boolean);

            // Assemble response
            const response = {
                data,
                page_info: {
                    next_cursor: nextCursor,
                    limit,
                    has_more: hasMore,
                },
                counts: {
                    total_all: totalAll,
                    total_active: totalActive,
                },
            };

            // Cache the response with short TTL for freshness
            await this.setCache(cacheKey, response, 10); // 10 seconds TTL

            return response;
        } catch (error) {
            logger.error("Failed to get vehicles", {
                error: error.message,
                stack: error.stack,
                userId,
            });
            throw error;
        }
    }

    /**
     * Format vehicle for response
     * @param {object} vehicle - Vehicle object
     * @param {object} pairedDevice - Paired device object
     * @param {number} userId - User ID for authorization check
     * @returns {object} Formatted vehicle response
     */
    formatVehicle(vehicle, pairedDevice, userId) {
        const batteryCapacity = vehicle.battery_capacity_kwh
            ? parseFloat(vehicle.battery_capacity_kwh)
            : null;
        const efficiency = vehicle.efficiency_kwh_per_km
            ? parseFloat(vehicle.efficiency_kwh_per_km)
            : null;

        // Calculate range_km: battery_capacity_kwh / efficiency_kwh_per_km
        let rangeKm = null;
        if (batteryCapacity && efficiency && efficiency > 0) {
            rangeKm = parseFloat((batteryCapacity / efficiency).toFixed(2));
        }

        // Build display_name from make and model
        const displayName =
            [vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
            "Unknown Vehicle";

        // Build full image URL from base URL and image path
        let imageUrl = null;
        if (vehicle.image_url) {
            const baseUrl =
                process.env.BASE_URL ||
                process.env.API_BASE_URL ||
                "http://localhost:7100";
            // Ensure image_url doesn't already start with http
            if (vehicle.image_url.startsWith("/")) {
                imageUrl = `${baseUrl}${vehicle.image_url}`;
            } else if (vehicle.image_url.startsWith("http")) {
                imageUrl = vehicle.image_url;
            } else {
                imageUrl = `${baseUrl}/${vehicle.image_url}`;
            }
        }

        const status = {
            battery_capacity_kwh: batteryCapacity,
            range_km: rangeKm,
        };

        return {
            vehicle_id: vehicle.vehicle_id,
            reg_number: vehicle.reg_number || null,
            display_name: displayName,
            image_url: imageUrl,
            is_active: pairedDevice?.is_active || false,
            status,
        };
    }

    /**
     * Get user cache version (for O(1) invalidation)
     */
    async getUserCacheVersion(userId) {
        try {
            const version = await redis.getRaw(`vehicles:ver:${userId}`);
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
     * Invalidate all vehicle caches for a user
     * Uses version bump pattern for O(1) invalidation
     */
    async invalidateUserCaches(userId) {
        try {
            const versionKey = `vehicles:ver:${userId}`;
            const newVersion = await redis.incr(versionKey);
            await redis.expire(versionKey, 86400 * 7); // 7 days
            logger.info("Invalidated vehicle caches", { userId, newVersion });
            return newVersion;
        } catch (error) {
            logger.warn("Cache invalidation failed", {
                userId,
                error: error.message,
            });
        }
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
     * Encode cursor for pagination
     */
    encodeCursor(lastItem, sort) {
        if (!lastItem) return null;
        const cursorData = {
            last_seen: lastItem.last_seen,
            id: lastItem.paired_device_id,
            sort,
        };
        return Buffer.from(JSON.stringify(cursorData)).toString("base64");
    }

    /**
     * Decode cursor for pagination
     */
    decodeCursor(cursor, currentSort) {
        if (!cursor)
            return {
                lastSeenCursor: null,
                idCursor: null,
                sortValue: currentSort,
            };
        try {
            const cursorData = JSON.parse(
                Buffer.from(cursor, "base64").toString()
            );
            return {
                lastSeenCursor: cursorData.last_seen,
                idCursor: cursorData.id,
                sortValue: cursorData.sort || currentSort,
            };
        } catch (error) {
            logger.warn("Invalid cursor format", {
                cursor,
                error: error.message,
            });
            return {
                lastSeenCursor: null,
                idCursor: null,
                sortValue: currentSort,
            };
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
            await redis.setex(key, ttlSeconds, JSON.stringify(data));
        } catch (error) {
            logger.warn("Cache set failed", {
                key,
                error: error.message,
            });
            // Don't throw - cache failure shouldn't break the request
        }
    }
}

// Export singleton instance
export default new VehicleService();
