/**
 * SMS Service
 * Handles SMS sending via MSG91 provider
 */

import MSG91Provider from "./sms-providers/msg91.provider.js";
import { createLogger } from "@ev-platform/shared";

const logger = createLogger("sms-service");

class SMSService {
    constructor() {
        this.provider = null;
        this.initialized = false;
    }

    /**
     * Initialize SMS provider
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Initialize MSG91 provider
            this.provider = new MSG91Provider({
                name: "msg91",
                authKey: process.env.MSG91_AUTH_KEY,
                senderId: process.env.MSG91_SENDER_ID,
                templateId: process.env.MSG91_OTP_TEMPLATE_ID,
            });

            this.initialized = true;
            logger.info("SMS Service initialized with MSG91 provider");
        } catch (error) {
            logger.error("Failed to initialize SMS service", {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Send OTP SMS
     * @param {string} phone - Phone number in E.164 format
     * @param {string} otp - OTP code to send
     * @returns {Promise<object>} Send result
     */
    async sendSms(phone, otp) {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.provider) {
            throw new Error("SMS provider not configured");
        }

        try {
            const result = await this.provider.sendOtp(phone, otp);

            return {
                ...result,
                provider: "msg91",
            };
        } catch (error) {
            logger.error("SMS send failed", {
                error: error.message,
                phone,
            });

            throw error;
        }
    }
}

// Export singleton instance
const smsService = new SMSService();
export default smsService;
