/**
 * No-Show Worker
 * Background worker to handle no-show bookings and free up slots
 */

import { createLogger, database } from "@ev-platform/shared";
import { Booking } from "../models/index.js";
import connectorStatusService from "../services/connector-status.service.js";
import stationService from "../services/station.service.js";
import eventPublisherService from "../services/event-publisher.service.js";
import { Connector } from "../models/index.js";

const logger = createLogger("no-show-worker");

const GRACE_PERIOD_MINUTES = parseInt(
    process.env.BOOKING_NO_SHOW_GRACE_PERIOD_MINUTES || "15"
);

/**
 * Process no-show bookings
 * Runs periodically to mark bookings as NO_SHOW and free connectors
 */
async function processNoShowBookings() {
    try {
        logger.info("Starting no-show booking check", {
            gracePeriodMinutes: GRACE_PERIOD_MINUTES,
        });

        // Find no-show bookings
        const noShowBookings = await Booking.findNoShowBookings(
            GRACE_PERIOD_MINUTES
        );

        logger.info("Found no-show bookings", {
            count: noShowBookings.length,
        });

        for (const booking of noShowBookings) {
            try {
                // Update booking status
                await Booking.updateStatus(booking.id, "NO_SHOW");

                // Free up connector
                const connector = await Connector.findById(
                    booking.connector_id
                );
                if (connector) {
                    await Connector.updateStatus(
                        connector.id,
                        "AVAILABLE",
                        null
                    );
                    await connectorStatusService.updateConnectorStatus(
                        booking.station_id,
                        connector.id,
                        {
                            status: "AVAILABLE",
                            bookingId: null,
                        }
                    );

                    // Publish event
                    await eventPublisherService.publishStationUpdate(
                        booking.station_id,
                        {
                            type: "connector_freed",
                            connectorId: connector.id,
                            bookingId: booking.id,
                            reason: "NO_SHOW",
                        }
                    );
                }

                // Invalidate cache
                await stationService.invalidateCache(booking.station_id);

                logger.info("Processed no-show booking", {
                    bookingId: booking.id,
                    connectorId: booking.connector_id,
                    stationId: booking.station_id,
                });

                // TODO: Trigger refund/partial charge via payment service
                // await paymentService.processNoShowRefund(booking.id);
            } catch (error) {
                logger.error("Failed to process no-show booking", {
                    error: error.message,
                    bookingId: booking.id,
                });
            }
        }

        logger.info("Completed no-show booking check", {
            processed: noShowBookings.length,
        });
    } catch (error) {
        logger.error("Failed to process no-show bookings", {
            error: error.message,
            stack: error.stack,
        });
    }
}

/**
 * Start the no-show worker
 * Runs every 5 minutes
 */
export function startNoShowWorker() {
    const INTERVAL_MS = parseInt(
        process.env.NO_SHOW_WORKER_INTERVAL_MS || "300000"
    ); // 5 minutes

    logger.info("Starting no-show worker", {
        intervalMs: INTERVAL_MS,
        gracePeriodMinutes: GRACE_PERIOD_MINUTES,
    });

    // Run immediately on start
    processNoShowBookings();

    // Then run on interval
    setInterval(processNoShowBookings, INTERVAL_MS);
}

// Auto-start if this module is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startNoShowWorker();
}
