/**
 * MSG91 SMS Provider
 * Production-ready implementation with retry logic, error handling, and monitoring
 * Uses official MSG91 npm package for better reliability and template support
 * API Documentation: https://docs.msg91.com/p/tf9GTextN/e/Yo15CxGFg/MSG91
 */

import msg91 from "msg91";
import { createLogger } from "@ev-platform/shared";

const logger = createLogger("msg91-provider");

class MSG91Provider {
    constructor(config = {}) {
        this.name = config.name || "msg91_primary";
        this.authKey = config.authKey || process.env.MSG91_AUTH_KEY;
        this.senderId =
            config.senderId || process.env.MSG91_SENDER_ID || "EVPLAT";
        this.templateId = config.templateId || process.env.MSG91_TEMPLATE_ID;
        this.retryAttempts = config.retryAttempts || 3;
        this.retryDelay = config.retryDelay || 1000; // 1 second

        // MSG91 client instance
        this.msg91Client = null;
        this.initialized = false;

        if (!this.authKey) {
            logger.error(`${this.name}: MSG91_AUTH_KEY not configured`);
        } else {
            this._initializeClient();
        }
    }

    /**
     * Initialize MSG91 client
     * @private
     */
    _initializeClient() {
        try {
            if (msg91 && msg91.default) {
                // MSG91 exports a singleton instance in the default property
                this.msg91Client = msg91.default;
                this.msg91Client.initialize({
                    authKey: this.authKey,
                });
                this.initialized = true;
                logger.info(
                    `${this.name}: MSG91 client initialized successfully`
                );
            } else {
                logger.error(
                    `${this.name}: Failed to initialize MSG91 client - package not available`
                );
            }
        } catch (error) {
            logger.error(
                `${this.name}: Failed to initialize MSG91 client:`,
                error
            );
        }
    }

    /**
     * Send OTP via MSG91 API using official package
     * @param {string} phone - Phone number in E.164 format (+919876543210)
     * @param {string} otp - OTP code
     * @param {object} options - Additional options including template variables
     * @returns {Promise<object>} Response with success status and message ID
     */
    async sendOtp(phone, otp, options = {}) {
        if (!this.authKey) {
            throw new Error("MSG91 authentication key not configured");
        }

        if (!this.msg91Client || !this.initialized) {
            throw new Error("MSG91 client not initialized properly");
        }

        // Remove + and country code for MSG91 (they want just the number)
        const cleanPhone = phone.startsWith("+") ? phone.substring(1) : phone;

        const startTime = Date.now();
        let lastError = null;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                logger.info(
                    `${this.name}: Sending OTP to ${phone} (attempt ${attempt}/${this.retryAttempts})`
                );

                const result = await this._sendOtpWithTemplate(
                    cleanPhone,
                    otp,
                    options
                );
                const duration = Date.now() - startTime;

                logger.info(`${this.name}: OTP sent successfully`, {
                    phone,
                    duration: `${duration}ms`,
                    attempt,
                    messageId: result.messageId,
                });

                return {
                    success: true,
                    provider: this.name,
                    messageId: result.messageId,
                    duration,
                    attempts: attempt,
                };
            } catch (error) {
                lastError = error;
                logger.warn(`${this.name}: Attempt ${attempt} failed`, {
                    error: error.message,
                    phone,
                    code: error.code,
                });

                // If not the last attempt, wait before retrying
                if (attempt < this.retryAttempts) {
                    await this._sleep(this.retryDelay * attempt); // Exponential backoff
                }
            }
        }

        // All attempts failed
        const duration = Date.now() - startTime;
        logger.error(
            `${this.name}: All ${this.retryAttempts} attempts failed`,
            {
                phone,
                error: lastError.message,
                duration: `${duration}ms`,
            }
        );

        throw {
            success: false,
            provider: this.name,
            error: lastError.message,
            code: lastError.code || "SEND_FAILED",
            duration,
            attempts: this.retryAttempts,
        };
    }

    /**
     * Send OTP using MSG91 template with official package
     * @private
     */
    async _sendOtpWithTemplate(phone, otp, options = {}) {
        try {
            // Use MSG91 package to send SMS with template
            const smsInstance = this.msg91Client.getSMS();

            // Prepare template variables for OTP
            const templateVariables = {
                var: otp,
            };

            // Prepare the recipient data with variables
            const recipientData = {
                mobile: phone,
                ...templateVariables,
            };

            const result = await smsInstance.send(
                this.templateId,
                recipientData,
                {
                    senderId: this.senderId,
                    shortURL: false,
                }
            );

            if (result && result.message) {
                return {
                    messageId:
                        result.messageId || result.request_id || "unknown",
                    requestId: result.request_id,
                    raw: result,
                };
            } else {
                logger.error(
                    `❌ SMS failed for ${phone}:`,
                    result?.message || "Unknown error"
                );

                // Additional debugging for template variable issues
                if (result?.message && result.message.includes("template")) {
                    logger.error(
                        "📱 [SMS DEBUG] Template configuration issue detected. Please check:"
                    );
                    logger.error("   - Template ID is correct");
                    logger.error(
                        "   - Template is configured to accept variables"
                    );
                    logger.error(
                        "   - Template variables are properly set up in MSG91 dashboard"
                    );
                }

                throw new Error(result?.message || "SMS sending failed");
            }
        } catch (error) {
            logger.error("❌ SMS service error:", error);
            throw error;
        }
    }

    /**
     * Sleep utility for retry delays
     * @private
     */
    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export default MSG91Provider;
