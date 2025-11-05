/**
 * WebSocket Service
 * Manages WebSocket connections for real-time updates using Socket.io
 */

import { createLogger, redis } from "@ev-platform/shared";
import eventPublisherService, {
    CHANNELS,
    EVENT_TYPES,
} from "./event-publisher.service.js";

const logger = createLogger("websocket-service");

class WebSocketService {
    constructor() {
        this.io = null;
        this.redisClient = null;
        this.subscribers = new Map(); // stationId -> Set of socket IDs
    }

    /**
     * Initialize WebSocket server with Socket.io
     * @param {object} httpServer - HTTP server instance
     * @returns {Promise<void>}
     */
    async initialize(httpServer) {
        try {
            // TEMPORARILY DISABLED - socket.io not installed
            logger.warn(
                "WebSocket service temporarily disabled - socket.io not available"
            );
            return;
        } catch (error) {
            logger.error("Failed to initialize WebSocket server", {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Setup Redis subscriber to listen for events
     * @private
     */
    async _setupRedisSubscriber() {
        // Subscribe to station update channels
        // Pattern: station_updates:{stationId}
        const pattern = `${CHANNELS.STATION_UPDATES}:*`;

        // Note: Redis pattern subscription requires special handling
        // For simplicity, we'll subscribe to a wildcard channel
        // In production, you might want to subscribe to specific channels per station

        this.redisClient.on("message", (channel, message) => {
            try {
                const event = JSON.parse(message);
                this._broadcastToStation(channel, event);
            } catch (error) {
                logger.error("Failed to parse Redis message", {
                    error: error.message,
                    channel,
                });
            }
        });

        // Subscribe to connector status updates
        this.redisClient.psubscribe(`${CHANNELS.CONNECTOR_STATUS}:*`);
        this.redisClient.psubscribe(`${CHANNELS.STATION_UPDATES}:*`);

        logger.info("Redis subscriber configured for WebSocket events");
    }

    /**
     * Broadcast event to all sockets subscribed to a station
     * @private
     */
    _broadcastToStation(channel, event) {
        // Extract station ID from channel
        // Channel format: station_updates:{stationId} or connector_status_update:{stationId}
        const parts = channel.split(":");
        const stationId = parts[parts.length - 1];

        if (!stationId) {
            return;
        }

        // Get all sockets subscribed to this station
        const socketIds = this.subscribers.get(stationId);
        if (!socketIds || socketIds.size === 0) {
            return;
        }

        // Broadcast to all subscribed sockets
        socketIds.forEach((socketId) => {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit("station_update", {
                    stationId,
                    ...event,
                });
            }
        });

        logger.debug("Broadcasted event to station subscribers", {
            stationId,
            eventType: event.type,
            subscribers: socketIds.size,
        });
    }

    /**
     * Handle new socket connection
     * @private
     */
    _handleConnection(socket) {
        logger.debug("New WebSocket connection", { socketId: socket.id });

        // Handle station subscription
        socket.on("subscribe_station", (data) => {
            this._subscribeToStation(socket, data.stationId);
        });

        // Handle station unsubscription
        socket.on("unsubscribe_station", (data) => {
            this._unsubscribeFromStation(socket, data.stationId);
        });

        // Handle disconnect
        socket.on("disconnect", () => {
            this._handleDisconnect(socket);
        });

        // Send connection confirmation
        socket.emit("connected", {
            socketId: socket.id,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Subscribe socket to station updates
     * @private
     */
    _subscribeToStation(socket, stationId) {
        if (!stationId) {
            socket.emit("error", { message: "Station ID is required" });
            return;
        }

        if (!this.subscribers.has(stationId)) {
            this.subscribers.set(stationId, new Set());
        }

        this.subscribers.get(stationId).add(socket.id);

        logger.debug("Socket subscribed to station", {
            socketId: socket.id,
            stationId,
        });

        socket.emit("subscribed", {
            stationId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Unsubscribe socket from station updates
     * @private
     */
    _unsubscribeFromStation(socket, stationId) {
        if (!stationId) {
            return;
        }

        const subscribers = this.subscribers.get(stationId);
        if (subscribers) {
            subscribers.delete(socket.id);
            if (subscribers.size === 0) {
                this.subscribers.delete(stationId);
            }
        }

        logger.debug("Socket unsubscribed from station", {
            socketId: socket.id,
            stationId,
        });

        socket.emit("unsubscribed", {
            stationId,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Handle socket disconnect
     * @private
     */
    _handleDisconnect(socket) {
        logger.debug("WebSocket disconnected", { socketId: socket.id });

        // Remove socket from all station subscriptions
        for (const [stationId, socketIds] of this.subscribers.entries()) {
            socketIds.delete(socket.id);
            if (socketIds.size === 0) {
                this.subscribers.delete(stationId);
            }
        }
    }

    /**
     * Get WebSocket server instance
     * @returns {object|null} Socket.io server instance
     */
    getIO() {
        return this.io;
    }

    /**
     * Broadcast to all connected clients (admin use)
     * @param {string} event - Event name
     * @param {object} data - Event data
     */
    broadcast(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
}

export default new WebSocketService();
