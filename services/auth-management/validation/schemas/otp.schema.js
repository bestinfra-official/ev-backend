/**
 * OTP Validation Schemas
 * Using Zod for request validation
 */

import { z } from "zod";

/**
 * Phone number validation schema
 * Accepts various formats: +919876543210, 9876543210, etc.
 */
const phoneSchema = z
    .string()
    .trim()
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number must be at most 15 digits")
    .regex(/^[\d\s\+\-\(\)]+$/, "Phone number contains invalid characters");

/**
 * Country code validation schema
 * ISO 3166-1 alpha-2 format (e.g., IN, US, GB)
 */
const countryCodeSchema = z
    .string()
    .trim()
    .length(2, "Country code must be 2 characters")
    .regex(
        /^[A-Z]{2}$/,
        "Country code must be uppercase ISO 3166-1 alpha-2 format"
    )
    .optional()
    .default("IN");

/**
 * OTP validation schema
 * 6-digit numeric code
 */
const otpSchema = z
    .string()
    .trim()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d{6}$/, "OTP must contain only digits");

/**
 * Request OTP schema
 * POST /otp/request
 */
export const requestOtpSchema = z.object({
    body: z.object({
        phone: phoneSchema,
        countryCode: countryCodeSchema,
    }),
});

/**
 * Verify OTP schema
 * POST /otp/verify
 */
export const verifyOtpSchema = z.object({
    body: z.object({
        phone: phoneSchema,
        otp: otpSchema,
    }),
});

/**
 * Refresh token schema
 * POST /otp/refresh
 */
export const refreshTokenSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, "Refresh token is required"),
    }),
});

/**
 * Logout schema
 * POST /otp/logout
 */
export const logoutSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, "Refresh token is required"),
    }),
});

/**
 * Resend OTP schema
 * POST /otp/resend
 */
export const resendOtpSchema = z.object({
    body: z.object({
        phone: phoneSchema,
        countryCode: countryCodeSchema,
    }),
});


export default {
    requestOtpSchema,
    verifyOtpSchema,
    refreshTokenSchema,
    logoutSchema,
    resendOtpSchema,
};
