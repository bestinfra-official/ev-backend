/**
 * Shared Database Configuration
 * Single connection pool for MVP (shared database)
 */

import pg from "pg";
import { createLogger } from "../utils/logger.js";

const { Pool } = pg;
const logger = createLogger("database");
import dotenv from "dotenv";
dotenv.config({ silent: true });

class Database {
    constructor() {
        this.pool = null;
    
        // Use DATABASE_URL if provided, otherwise fall back to individual variables
        const databaseUrl = process.env.DATABASE_URL;

        if (databaseUrl) {
            this.config = {
                connectionString: databaseUrl,
                min: parseInt(process.env.DB_POOL_MIN || "2"),
                max: parseInt(process.env.DB_POOL_MAX || "10"),
                idleTimeoutMillis: parseInt(
                    process.env.DB_IDLE_TIMEOUT_MS || "30000"
                ),
                connectionTimeoutMillis: parseInt(
                    process.env.DB_CONNECTION_TIMEOUT_MS || "5000"
                ),
            };
        } else {
            // Fallback to individual environment variables
            this.config = {
                host: process.env.DATABASE_HOST || "localhost",
                port: parseInt(process.env.DATABASE_PORT || "5432"),
                database: process.env.DATABASE_NAME || "ev",
                user: process.env.DATABASE_USER || "postgres",
                password: process.env.DATABASE_PASSWORD || "",
                min: parseInt(process.env.DB_POOL_MIN || "2"),
                max: parseInt(process.env.DB_POOL_MAX || "10"),
                idleTimeoutMillis: parseInt(
                    process.env.DB_IDLE_TIMEOUT_MS || "30000"
                ),
                connectionTimeoutMillis: parseInt(
                    process.env.DB_CONNECTION_TIMEOUT_MS || "5000"
                ),
            };
        }
    }

    /**
     * Connect to database
     */
    async connect() {
        if (this.pool) {
            return this.pool;
        }

        try {
            this.pool = new Pool(this.config);

            // Test connection
            const client = await this.pool.connect();
            await client.query("SELECT NOW()");
            client.release();

            // Handle pool errors
            this.pool.on("error", (err) => {
                logger.error("Unexpected database pool error", {
                    error: err.message,
                    stack: err.stack,
                });
            });

            logger.info("Database connected successfully");
            return this.pool;
        } catch (error) {
            logger.error("Failed to connect to database", {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }

    /**
     * Execute a query
     */
    async query(text, params) {
        if (!this.pool) {
            throw new Error("Database not connected. Call connect() first.");
        }

        try {
            const start = Date.now();
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            // Log slow queries (> 1 second)
            if (duration > 1000) {
                logger.warn("Slow query detected", {
                    query: text,
                    duration: `${duration}ms`,
                    rows: result.rowCount,
                });
            }

            return result;
        } catch (error) {
            logger.error("Database query error", {
                error: error.message,
                query: text,
            });
            throw error;
        }
    }

    /**
     * Get a client from the pool for transactions
     */
    async getClient() {
        if (!this.pool) {
            throw new Error("Database not connected. Call connect() first.");
        }

        return await this.pool.connect();
    }

    /**
     * Disconnect from database
     */
    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            logger.info("Database disconnected");
        }
    }

    /**
     * Get pool statistics
     */
    getStats() {
        if (!this.pool) {
            return null;
        }

        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
        };
    }
}

// Export singleton instance
const database = new Database();
export default database;
