/**
 * Vendor Integration Controller
 * Handles webhooks and vendor API integration
 */

import {
    createLogger,
    successResponse,
    errorResponse,
    asyncHandler,
} from "@ev-platform/shared";
import vendorIntegrationService from "../services/vendor-integration.service.js";

const logger = createLogger("vendor-controller");

/**
 * Webhook endpoint for connector status updates
 * POST /vendor/webhooks/connector-status
 */
export const handleConnectorStatusWebhook = asyncHandler(async (req, res) => {
    const { stationId, connectorId, vendorConnectorId, status, metadata } = req.body;

    try {
        await vendorIntegrationService.processConnectorStatusUpdate({
            stationId,
            connectorId,
            vendorConnectorId,
            status,
            metadata,
        });

        return res.status(200).json(
            successResponse(null, "Connector status updated successfully")
        );
    } catch (error) {
        logger.error("Failed to process connector status webhook", {
            error: error.message,
            body: req.body,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to process webhook", "INTERNAL_ERROR"));
    }
});

/**
 * Webhook endpoint for booking notifications
 * POST /vendor/webhooks/booking-notification
 */
export const handleBookingNotificationWebhook = asyncHandler(async (req, res) => {
    const { vendorBookingId, status, vendorConnectorId } = req.body;

    try {
        await vendorIntegrationService.processVendorBookingNotification({
            vendorBookingId,
            status,
            vendorConnectorId,
        });

        return res.status(200).json(
            successResponse(null, "Booking notification processed successfully")
        );
    } catch (error) {
        logger.error("Failed to process booking notification webhook", {
            error: error.message,
            body: req.body,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to process webhook", "INTERNAL_ERROR"));
    }
});

/**
 * Webhook endpoint for session start
 * POST /vendor/webhooks/session-start
 */
export const handleSessionStartWebhook = asyncHandler(async (req, res) => {
    const {
        vendorSessionId,
        connectorId,
        vendorConnectorId,
        startMeterReading,
        bookingId,
    } = req.body;

    try {
        const session = await vendorIntegrationService.processSessionStart({
            vendorSessionId,
            connectorId,
            vendorConnectorId,
            startMeterReading,
            bookingId,
        });

        return res.status(200).json(
            successResponse(
                {
                    sessionId: session.id,
                    startedAt: session.started_at,
                },
                "Session started successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to process session start webhook", {
            error: error.message,
            body: req.body,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to process webhook", "INTERNAL_ERROR"));
    }
});

/**
 * Webhook endpoint for session end
 * POST /vendor/webhooks/session-end
 */
export const handleSessionEndWebhook = asyncHandler(async (req, res) => {
    const {
        vendorSessionId,
        sessionId,
        endMeterReading,
        energyKwh,
        costAmount,
    } = req.body;

    try {
        const session = await vendorIntegrationService.processSessionEnd({
            vendorSessionId,
            sessionId,
            endMeterReading,
            energyKwh,
            costAmount,
        });

        return res.status(200).json(
            successResponse(
                {
                    sessionId: session.id,
                    energyKwh: session.energy_kwh,
                    costAmount: session.cost_amount,
                    endedAt: session.ended_at,
                },
                "Session ended successfully"
            )
        );
    } catch (error) {
        logger.error("Failed to process session end webhook", {
            error: error.message,
            body: req.body,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to process webhook", "INTERNAL_ERROR"));
    }
});

