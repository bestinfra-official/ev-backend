/**
 * Vendor Integration Routes
 * Routes for vendor webhooks and integration
 */

import express from "express";
import {
    handleConnectorStatusWebhook,
    handleBookingNotificationWebhook,
    handleSessionStartWebhook,
    handleSessionEndWebhook,
} from "../controllers/vendor.controller.js";
import {
    connectorStatusWebhookSchema,
    bookingNotificationWebhookSchema,
    sessionStartWebhookSchema,
    sessionEndWebhookSchema,
} from "../validation/schemas/station.schema.js";
import { validate } from "@ev-platform/shared";

const router = express.Router();

/**
 * POST /vendor/webhooks/connector-status
 * Webhook endpoint for connector status updates
 */
router.post(
    "/webhooks/connector-status",
    validate(connectorStatusWebhookSchema),
    handleConnectorStatusWebhook
);

/**
 * POST /vendor/webhooks/booking-notification
 * Webhook endpoint for booking notifications
 */
router.post(
    "/webhooks/booking-notification",
    validate(bookingNotificationWebhookSchema),
    handleBookingNotificationWebhook
);

/**
 * POST /vendor/webhooks/session-start
 * Webhook endpoint for session start
 */
router.post(
    "/webhooks/session-start",
    validate(sessionStartWebhookSchema),
    handleSessionStartWebhook
);

/**
 * POST /vendor/webhooks/session-end
 * Webhook endpoint for session end
 */
router.post(
    "/webhooks/session-end",
    validate(sessionEndWebhookSchema),
    handleSessionEndWebhook
);

export default router;

