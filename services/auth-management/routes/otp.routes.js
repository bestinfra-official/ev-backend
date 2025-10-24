/**
 * OTP Routes
 * High-scale OTP request and verification endpoints
 */

import express from "express";
import {
    requestOtp,
    verifyOtp,
    refreshToken,
    logout,
    resendOtp,
    testProtectedRoute,
} from "../controllers/otp.controller.js";
import {
    ipRateLimit,
    phoneRateLimit,
} from "../middleware/rate-limit.middleware.js";
import {
    requestOtpSchema,
    verifyOtpSchema,
    refreshTokenSchema,
    logoutSchema,
    resendOtpSchema,
} from "../validation/schemas/otp.schema.js";
import { verifyToken, validate } from "@ev-platform/shared";

const router = express.Router();

/**
 * POST /otp/request
 * Request a new OTP
 * Rate limited by IP and phone
 */
router.post(
    "/request",
    ipRateLimit, // General IP-based rate limiting
    validate(requestOtpSchema), // Validate request body
    phoneRateLimit, // Phone-specific rate limiting
    requestOtp
);

/**
 * POST /otp/verify
 * Verify an OTP
 * Rate limited by IP only (Redis OTP service handles verification attempts)
 */
router.post("/verify", ipRateLimit, validate(verifyOtpSchema), verifyOtp);

/**
 * POST /otp/refresh
 * Refresh access token using refresh token
 * Rate limited by IP only
 */
router.post(
    "/refresh",
    ipRateLimit,
    validate(refreshTokenSchema),
    refreshToken
);

/**
 * POST /otp/logout
 * Logout user and revoke all tokens
 * Rate limited by IP only
 */
router.post("/logout", ipRateLimit, validate(logoutSchema), logout);

/**
 * POST /otp/resend
 * Resend OTP (same as request but different audit trail)
 * Rate limited by IP and phone
 */
router.post(
    "/resend",
    ipRateLimit,
    validate(resendOtpSchema),
    phoneRateLimit,
    resendOtp
);

/**
 * GET /otp/test-protected
 * Test protected route - requires valid JWT token
 * Used for testing authentication middleware
 */
router.get("/test-protected", verifyToken, testProtectedRoute);

export default router;
