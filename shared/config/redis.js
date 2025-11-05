/**
 * Shared Redis Configuration
 * Single Redis connection for caching and sessions
 */

import Redis from "ioredis";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("redis");

class RedisClient {
    constructor() {
        this.client = null;
        this.isCluster = process.env.REDIS_CLUSTER_ENABLED === "true";

        // Base configuration for standalone or cluster
        this.config = {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
            password: process.env.REDIS_PASSWORD || undefined,
            db: parseInt(process.env.REDIS_DB || "0"),
            keyPrefix: process.env.REDIS_KEY_PREFIX || "ev:",
            maxRetriesPerRequest: parseInt(
                process.env.REDIS_MAX_RETRIES || "3"
            ),
            // Connection pool settings (optimized for high-scale)
            connectTimeout: parseInt(
                process.env.REDIS_CONNECT_TIMEOUT || "10000"
            ),
            keepAlive: parseInt(process.env.REDIS_KEEPALIVE || "30000"),
            // Enable TCP keepalive to detect dead connections
            enableReadyCheck: true,
            enableOfflineQueue: true,
            // Command queue limits for backpressure
            maxRetriesPerRequest: 3,
            commandTimeout: parseInt(
                process.env.REDIS_COMMAND_TIMEOUT || "5000"
            ),
            // Retry strategy with exponential backoff
            retryStrategy: (times) => {
                if (times > 10) {
                    // Max retries reached
                    return null;
                }
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            reconnectOnError: (err) => {
                const targetError = "READONLY";
                if (err.message.includes(targetError)) {
                    return true;
                }
                return false;
            },
        };

        // Cluster-specific configuration
        if (this.isCluster) {
            // Parse cluster nodes from env (format: "host1:port1,host2:port2")
            const clusterNodes = process.env.REDIS_CLUSTER_NODES
                ? process.env.REDIS_CLUSTER_NODES.split(",").map((node) => {
                      const [host, port] = node.split(":");
                      return { host, port: parseInt(port) };
                  })
                : [{ host: this.config.host, port: this.config.port }];

            this.clusterConfig = {
                clusterRetryStrategy: (times) => {
                    const delay = Math.min(times * 100, 3000);
                    return delay;
                },
                enableReadyCheck: true,
                scaleReads: "slave", // Read from slaves for load balancing
                maxRedirections: 16,
                redisOptions: {
                    password: this.config.password,
                    connectTimeout: this.config.connectTimeout,
                },
            };

            this.clusterNodes = clusterNodes;
        }
    }

    /**
     * Connect to Redis (standalone or cluster)
     */
    async connect() {
        if (this.client) {
            return this.client;
        }

        try {
            if (this.isCluster) {
                // Connect to Redis Cluster
                const { Cluster } = await import("ioredis");
                this.client = new Cluster(
                    this.clusterNodes,
                    this.clusterConfig
                );
                logger.info("Connecting to Redis Cluster", {
                    nodes: this.clusterNodes.length,
                });
            } else {
                // Connect to standalone Redis
                this.client = new Redis(this.config);
                logger.info("Connecting to Redis (standalone)");
            }

            // Event handlers
            this.client.on("connect", () => {
                logger.info("Redis connected", {
                    mode: this.isCluster ? "cluster" : "standalone",
                });
            });

            this.client.on("error", (err) => {
                logger.error("Redis error", { error: err.message });
            });

            this.client.on("close", () => {
                logger.warn("Redis connection closed");
            });

            this.client.on("reconnecting", () => {
                logger.info("Redis reconnecting...");
            });

            if (this.isCluster) {
                this.client.on("node error", (err, node) => {
                    logger.error("Redis cluster node error", {
                        node: `${node.options.host}:${node.options.port}`,
                        error: err.message,
                    });
                });
            }

            // Test connection
            await this.client.ping();

            return this.client;
        } catch (error) {
            logger.error("Failed to connect to Redis", {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Get Redis client
     */
    getClient() {
        if (!this.client) {
            throw new Error("Redis not connected. Call connect() first.");
        }
        return this.client;
    }

    /**
     * Disconnect from Redis
     */
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            logger.info("Redis disconnected");
        }
    }

    /**
     * Set key with optional expiry
     */
    async set(key, value, expirySeconds = null) {
        const client = this.getClient();
        const serialized = JSON.stringify(value);

        if (expirySeconds) {
            await client.setex(key, expirySeconds, serialized);
        } else {
            await client.set(key, serialized);
        }
    }

    /**
     * Get key
     */
    async get(key) {
        const client = this.getClient();
        const value = await client.get(key);
        return value ? JSON.parse(value) : null;
    }

    /**
     * Get raw string value without JSON parsing
     */
    async getRaw(key) {
        const client = this.getClient();
        const value = await client.get(key);
        return value;
    }

    /**
     * Delete key
     */
    async del(key) {
        const client = this.getClient();
        await client.del(key);
    }

    /**
     * Check if key exists
     */
    async exists(key) {
        const client = this.getClient();
        return (await client.exists(key)) === 1;
    }

    /**
     * Create a pipeline for batching commands
     * Use this for bulk operations to improve performance
     *
     * Example:
     *   const pipeline = redis.pipeline();
     *   pipeline.set('key1', 'value1');
     *   pipeline.set('key2', 'value2');
     *   await pipeline.exec();
     */
    pipeline() {
        const client = this.getClient();
        return client.pipeline();
    }

    /**
     * Execute multiple commands in a transaction (MULTI/EXEC)
     */
    multi() {
        const client = this.getClient();
        return client.multi();
    }

    /**
     * Set key with expiration
     */
    async setex(key, seconds, value) {
        const client = this.getClient();
        await client.setex(key, seconds, value);
    }

    /**
     * Increment a key
     */
    async incr(key) {
        const client = this.getClient();
        return await client.incr(key);
    }

    /**
     * Set expiration on a key
     */
    async expire(key, seconds) {
        const client = this.getClient();
        return await client.expire(key, seconds);
    }

    /**
     * Batch get multiple keys (uses MGET for efficiency)
     * @param {string[]} keys - Array of keys to get
     * @returns {Promise<Array>} Array of values (null for missing keys)
     */
    async mget(...keys) {
        if (!keys || keys.length === 0) {
            return [];
        }
        const client = this.getClient();
        const values = await client.mget(...keys);
        return values;
    }

    /**
     * Batch set multiple keys (uses pipeline for efficiency)
     * @param {Array<{key: string, value: any, ttl?: number}>} items
     */
    async mset(items) {
        if (!items || items.length === 0) {
            return;
        }
        const client = this.getClient();
        const pipeline = client.pipeline();

        for (const { key, value, ttl } of items) {
            const serialized = JSON.stringify(value);
            if (ttl) {
                pipeline.setex(key, ttl, serialized);
            } else {
                pipeline.set(key, serialized);
            }
        }

        await pipeline.exec();
    }

    /**
     * Get Redis info and stats
     */
    async getInfo() {
        const client = this.getClient();
        const info = await client.info();

        return {
            mode: this.isCluster ? "cluster" : "standalone",
            connected: client.status === "ready",
            info,
        };
    }
}

// Export singleton instance
const redisClient = new RedisClient();
export default redisClient;
