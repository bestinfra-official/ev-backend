/**
 * Vendor Integration Service
 * Handles integration with external station vendors (OCPP, webhooks, etc.)
 */

import { createLogger, database } from "@ev-platform/shared";
import connectorStatusService from "./connector-status.service.js";
import eventPublisherService from "./event-publisher.service.js";
import stationService from "./station.service.js";
import { Connector, Booking } from "../models/index.js";

const logger = createLogger("vendor-integration-service");

class VendorIntegrationService {
    /**
     * Process connector status update from vendor
     * @param {object} updateData - Update data from vendor
     * @returns {Promise<void>}
     */
    async processConnectorStatusUpdate(updateData) {
        const {
            stationId,
            connectorId,
            vendorConnectorId,
            status,
            metadata = {},
        } = updateData;

        try {
            // Normalize status
            const normalizedStatus = this._normalizeStatus(status);

            // Update connector in DB
            let connector = await Connector.findById(connectorId);
            if (!connector && vendorConnectorId) {
                // Find connector by vendor ID
                const result = await database.query(
                    `SELECT id FROM connectors WHERE vendor_connector_id = $1`,
                    [vendorConnectorId]
                );
                if (result.rows.length > 0) {
                    connectorId = result.rows[0].id;
                    connector = await Connector.findById(connectorId);
                }
            }

            if (!connector) {
                logger.warn("Connector not found for vendor update", {
                    connectorId,
                    vendorConnectorId,
                });
                return;
            }

            // Update connector status
            await Connector.updateStatus(connectorId, normalizedStatus);

            // Update Redis
            await connectorStatusService.updateConnectorStatus(
                stationId || connector.station_id,
                connectorId,
                {
                    status: normalizedStatus,
                    vendorConnectorId,
                }
            );

            // Publish event
            await eventPublisherService.publishConnectorStatusUpdate(
                stationId || connector.station_id,
                connectorId,
                {
                    status: normalizedStatus,
                    updatedAt: Math.floor(Date.now() / 1000),
                }
            );

            // Invalidate availability cache
            await stationService.invalidateCache(
                stationId || connector.station_id
            );

            logger.info("Processed connector status update", {
                stationId: stationId || connector.station_id,
                connectorId,
                status: normalizedStatus,
            });
        } catch (error) {
            logger.error("Failed to process connector status update", {
                error: error.message,
                updateData,
            });
            throw error;
        }
    }

    /**
     * Process booking notification from vendor
     * @param {object} bookingData - Booking data from vendor
     * @returns {Promise<void>}
     */
    async processVendorBookingNotification(bookingData) {
        const { vendorBookingId, status, vendorConnectorId } = bookingData;

        try {
            // Find booking by vendor booking ID
            const result = await database.query(
                `SELECT id, station_id, connector_id FROM bookings WHERE vendor_booking_id = $1`,
                [vendorBookingId]
            );

            if (result.rows.length === 0) {
                logger.warn("Booking not found for vendor notification", {
                    vendorBookingId,
                });
                return;
            }

            const booking = result.rows[0];

            // Update booking vendor sync status
            const normalizedStatus = this._normalizeBookingStatus(status);
            await Booking.updateStatus(booking.id, booking.status, {
                vendorSyncStatus: normalizedStatus === "ACKED" ? "ACKED" : "SYNCED",
            });

            logger.info("Processed vendor booking notification", {
                bookingId: booking.id,
                vendorBookingId,
                status,
            });
        } catch (error) {
            logger.error("Failed to process vendor booking notification", {
                error: error.message,
                bookingData,
            });
            throw error;
        }
    }

    /**
     * Process session start from vendor
     * @param {object} sessionData - Session data from vendor
     * @returns {Promise<object>} Session record
     */
    async processSessionStart(sessionData) {
        const {
            vendorSessionId,
            connectorId,
            vendorConnectorId,
            startMeterReading,
            bookingId,
        } = sessionData;

        try {
            // Find connector if vendor ID provided
            let actualConnectorId = connectorId;
            if (!actualConnectorId && vendorConnectorId) {
                const result = await database.query(
                    `SELECT id, station_id FROM connectors WHERE vendor_connector_id = $1`,
                    [vendorConnectorId]
                );
                if (result.rows.length > 0) {
                    actualConnectorId = result.rows[0].id;
                    const stationId = result.rows[0].station_id;

                    // Update connector status to OCCUPIED
                    await Connector.updateStatus(actualConnectorId, "OCCUPIED");
                    await connectorStatusService.updateConnectorStatus(
                        stationId,
                        actualConnectorId,
                        {
                            status: "OCCUPIED",
                        }
                    );
                }
            }

            if (!actualConnectorId) {
                throw new Error("Connector not found");
            }

            // Find booking if provided
            let booking = null;
            if (bookingId) {
                booking = await Booking.findById(bookingId);
            }

            // Create session
            const { Session } = await import("../models/session.model.js");
            const session = await Session.create({
                bookingId: booking?.id || null,
                userId: booking?.user_id || null,
                stationId: booking?.station_id || null,
                connectorId: actualConnectorId,
                startMeterReading,
                vendorSessionId,
            });

            // Update booking status to ACTIVE if exists
            if (booking) {
                await Booking.updateStatus(booking.id, "ACTIVE");
            }

            // Publish event
            if (booking?.station_id) {
                await eventPublisherService.publishSessionStarted(
                    booking.station_id,
                    session.id,
                    {
                        connectorId: actualConnectorId,
                        bookingId: booking?.id,
                        startedAt: session.started_at,
                    }
                );
            }

            return session;
        } catch (error) {
            logger.error("Failed to process session start", {
                error: error.message,
                sessionData,
            });
            throw error;
        }
    }

    /**
     * Process session end from vendor
     * @param {object} sessionData - Session end data from vendor
     * @returns {Promise<object>} Updated session
     */
    async processSessionEnd(sessionData) {
        const {
            vendorSessionId,
            sessionId,
            endMeterReading,
            energyKwh,
            costAmount,
        } = sessionData;

        try {
            // Find session
            const { Session } = await import("../models/session.model.js");
            let session = null;

            if (sessionId) {
                session = await Session.findById(sessionId);
            } else if (vendorSessionId) {
                const result = await database.query(
                    `SELECT id FROM charging_sessions WHERE vendor_session_id = $1 ORDER BY created_at DESC LIMIT 1`,
                    [vendorSessionId]
                );
                if (result.rows.length > 0) {
                    session = await Session.findById(result.rows[0].id);
                }
            }

            if (!session) {
                throw new Error("Session not found");
            }

            // Calculate energy if not provided
            let calculatedEnergy = energyKwh;
            if (!calculatedEnergy && session.start_meter_reading && endMeterReading) {
                calculatedEnergy = parseFloat(endMeterReading) - parseFloat(session.start_meter_reading);
            }

            // Update session
            const updated = await Session.updateStatus(
                session.id,
                "COMPLETED",
                {
                    endMeterReading,
                    energyKwh: calculatedEnergy,
                    costAmount,
                    startedAt: session.started_at,
                }
            );

            // Update connector status
            const connector = await Connector.findById(session.connector_id);
            if (connector) {
                await Connector.updateStatus(connector.id, "AVAILABLE", null);
                await connectorStatusService.updateConnectorStatus(
                    connector.station_id,
                    connector.id,
                    {
                        status: "AVAILABLE",
                        bookingId: null,
                    }
                );

                // Publish event
                await eventPublisherService.publishSessionEnded(
                    connector.station_id,
                    session.id,
                    {
                        connectorId: connector.id,
                        energyKwh: calculatedEnergy,
                        costAmount,
                        endedAt: updated.ended_at,
                    }
                );
            }

            // Update booking status if exists
            if (session.booking_id) {
                await Booking.updateStatus(session.booking_id, "COMPLETED");
            }

            return updated;
        } catch (error) {
            logger.error("Failed to process session end", {
                error: error.message,
                sessionData,
            });
            throw error;
        }
    }

    /**
     * Normalize vendor status to internal status
     * @private
     */
    _normalizeStatus(vendorStatus) {
        const statusMap = {
            Available: "AVAILABLE",
            Occupied: "OCCUPIED",
            Reserved: "RESERVED",
            Unavailable: "MAINTENANCE",
            Faulted: "FAULTED",
            Preparing: "OCCUPIED",
            Charging: "OCCUPIED",
            Finishing: "OCCUPIED",
            SuspendedEVSE: "MAINTENANCE",
            SuspendedEV: "MAINTENANCE",
        };

        return statusMap[vendorStatus] || "AVAILABLE";
    }

    /**
     * Normalize vendor booking status
     * @private
     */
    _normalizeBookingStatus(vendorStatus) {
        const statusMap = {
            Accepted: "ACKED",
            Rejected: "FAILED",
            Pending: "PENDING",
        };

        return statusMap[vendorStatus] || "PENDING";
    }
}

export default new VendorIntegrationService();

