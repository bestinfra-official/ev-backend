/**
 * OTP Utilities
 * Production-ready OTP generation, hashing, and verification with security best practices
 */

import crypto from "crypto";
import parsePhoneNumber from "libphonenumber-js";

// Configuration from environment
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || "6");
const OTP_TTL_SECONDS = parseInt(process.env.OTP_TTL_SECONDS || "300"); // 5 minutes
const OTP_HMAC_SECRET =
    process.env.OTP_HMAC_SECRET || "change-me-in-production";
const OTP_MAX_VERIFY_ATTEMPTS = parseInt(
    process.env.OTP_MAX_VERIFY_ATTEMPTS || "5"
);

// Security warning for production
if (
    OTP_HMAC_SECRET === "change-me-in-production" &&
    process.env.NODE_ENV === "production"
) {
    console.error(
        "⚠️  WARNING: OTP_HMAC_SECRET is using default value in production! This is a security risk!"
    );
}

/**
 * Generate a cryptographically secure numeric OTP
 * @returns {string} OTP string with leading zeros preserved
 */
export function generateOtp() {
    // Use crypto.randomInt for cryptographically secure random numbers
    const max = Math.pow(10, OTP_LENGTH);
    const otp = crypto.randomInt(0, max);
    return String(otp).padStart(OTP_LENGTH, "0");
}

/**
 * Create HMAC hash of OTP with phone number as salt
 * This prevents rainbow table attacks and ensures OTPs are phone-specific
 * @param {string} otp - The OTP to hash
 * @param {string} phone - The phone number (used as salt)
 * @returns {string} Hex-encoded HMAC
 */
export function hmacOtp(otp, phone) {
    const data = `${phone}:${otp}`;
    return crypto
        .createHmac("sha256", OTP_HMAC_SECRET)
        .update(data)
        .digest("hex");
}

/**
 * Verify OTP using timing-safe comparison to prevent timing attacks
 * @param {string} providedOtp - OTP provided by user
 * @param {string} storedHmac - HMAC stored in Redis
 * @param {string} phone - Phone number
 * @returns {boolean} True if OTP is valid
 */
export function verifyOtp(providedOtp, storedHmac, phone) {
    try {
        const expectedHmac = hmacOtp(providedOtp, phone);
        return timingSafeEqual(expectedHmac, storedHmac);
    } catch (error) {
        // If comparison fails (e.g., different lengths), return false
        return false;
    }
}

/**
 * Timing-safe string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings are equal
 */
export function timingSafeEqual(a, b) {
    try {
        const bufA = Buffer.from(a, "hex");
        const bufB = Buffer.from(b, "hex");

        if (bufA.length !== bufB.length) {
            return false;
        }

        return crypto.timingSafeEqual(bufA, bufB);
    } catch (error) {
        return false;
    }
}

/**
 * Normalize and validate phone number
 * Uses libphonenumber-js for international phone number parsing
 * @param {string} phone - Raw phone number
 * @param {string} defaultCountry - Default country code (ISO 3166-1 alpha-2)
 * @returns {{isValid: boolean, normalized: string, country: string, error: string|null}}
 */
export function normalizePhone(phone, defaultCountry = "IN") {
    try {
        // Remove all non-digit characters first for pre-validation
        const digitsOnly = phone.replace(/\D/g, "");

        if (digitsOnly.length < 10) {
            return {
                isValid: false,
                normalized: null,
                country: null,
                error: "Phone number too short",
            };
        }

        // Parse with libphonenumber
        const phoneNumber = parsePhoneNumber(phone, defaultCountry);

        if (!phoneNumber || !phoneNumber.isValid()) {
            return {
                isValid: false,
                normalized: null,
                country: null,
                error: "Invalid phone number format",
            };
        }

        return {
            isValid: true,
            normalized: phoneNumber.number, // E.164 format: +919876543210
            country: phoneNumber.country,
            error: null,
        };
    } catch (error) {
        return {
            isValid: false,
            normalized: null,
            country: null,
            error: error.message || "Phone number parsing failed",
        };
    }
}

/**
 * Create OTP metadata object for Redis storage
 * @param {string} hmac - HMAC hash of OTP
 * @param {number} attempts - Number of verification attempts (default 0)
 * @returns {object} Metadata object
 */
export function createOtpMetadata(hmac, attempts = 0) {
    return {
        hmac,
        createdAt: Date.now(),
        attempts,
        expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
    };
}

/**
 * Parse OTP metadata from Redis
 * @param {string} metadataJson - JSON string from Redis
 * @returns {object|null} Parsed metadata or null if invalid
 */
export function parseOtpMetadata(metadataJson) {
    try {
        if (!metadataJson) return null;
        return JSON.parse(metadataJson);
    } catch (error) {
        return null;
    }
}

/**
 * Check if OTP metadata has expired
 * @param {object} metadata - OTP metadata object
 * @returns {boolean} True if expired
 */
export function isOtpExpired(metadata) {
    if (!metadata || !metadata.expiresAt) return true;
    return Date.now() > metadata.expiresAt;
}

/**
 * Check if too many verification attempts
 * @param {object} metadata - OTP metadata object
 * @returns {boolean} True if too many attempts
 */
export function isTooManyAttempts(metadata) {
    if (!metadata) return false;
    return metadata.attempts >= OTP_MAX_VERIFY_ATTEMPTS;
}

/**
 * Generate a unique request ID for tracking
 * @returns {string} Unique request ID
 */
export function generateRequestId() {
    return `otp_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

// Export configuration for use in other modules
export const OTP_CONFIG = {
    LENGTH: OTP_LENGTH,
    TTL_SECONDS: OTP_TTL_SECONDS,
    MAX_VERIFY_ATTEMPTS: OTP_MAX_VERIFY_ATTEMPTS,
    HMAC_SECRET: OTP_HMAC_SECRET,
};

export default {
    generateOtp,
    hmacOtp,
    verifyOtp,
    timingSafeEqual,
    normalizePhone,
    createOtpMetadata,
    parseOtpMetadata,
    isOtpExpired,
    isTooManyAttempts,
    generateRequestId,
    OTP_CONFIG,
};
