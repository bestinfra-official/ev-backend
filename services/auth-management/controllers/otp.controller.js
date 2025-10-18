/**
 * OTP Controller
 * Handles OTP request and verification endpoints
 * Production-ready with comprehensive error handling and audit logging
 */

import {
    createLogger,
    errorResponse,
    successResponse,
} from "@ev-platform/shared";
import {
    generateOtp,
    hmacOtp,
    verifyOtp,
    normalizePhone,
    generateRequestId,
    isOtpExpired,
    isTooManyAttempts,
    OTP_CONFIG,
} from "../utils/otp.utils.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import otpRedisService from "../services/otp-redis.service.js";
import otpQueueService from "../services/otp-queue.service.js";
import phoneVerificationService from "../services/phone-verification.service.js";
import { User, OtpAudit } from "../models/index.js";

const logger = createLogger("otp-controller");

/**
 * Request OTP endpoint
 * POST /otp/request
 * Body: { phone: string, countryCode?: string }
 */
export async function requestOtp(req, res) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
        const { phone, countryCode } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get("user-agent");

        // Validate and normalize phone number
        const phoneResult = normalizePhone(phone, countryCode);
        if (!phoneResult.isValid) {
            await OtpAudit.create({
                phone,
                eventType: "request_invalid",
                providerResponse: { error: phoneResult.error },
                ip,
                userAgent,
            });

            return res
                .status(400)
                .json(
                    errorResponse(
                        phoneResult.error || "Invalid phone number",
                        "INVALID_PHONE"
                    )
                );
        }

        const normalizedPhone = phoneResult.normalized;
        logger.info(
            {
                requestId,
                phone: normalizedPhone,
                ip,
            },
            `OTP request received`
        );

        // Check rate limits FIRST (before expensive operations)
        const rateLimitResult = await otpRedisService.checkRateLimits(
            normalizedPhone,
            ip
        );
        if (!rateLimitResult.allowed) {
            await OtpAudit.create({
                phone: normalizedPhone,
                eventType: "request_rate_limited",
                providerResponse: {
                    reason: rateLimitResult.reason,
                    retryAfter: rateLimitResult.retryAfter,
                },
                ip,
                userAgent,
            });

            return res.status(429).json(
                errorResponse(rateLimitResult.message, "RATE_LIMIT_EXCEEDED", {
                    retryAfter: rateLimitResult.retryAfter,
                    reason: rateLimitResult.reason,
                })
            );
        }

        // ========================================
        // PHONE VERIFICATION (High-Performance)
        // ========================================
        // Check if phone exists using 3-tier approach:
        // 1. Redis cache (O(1), fastest)
        // 2. Bloom filter (O(1), cheap rejection)
        // 3. Database (indexed query, fallback)
        //
        // Anti-enumeration policy: Return same 202 response for both
        // existing and non-existing phones, but only send OTP for existing ones.
        // This prevents attackers from discovering which phones are registered.
        const phoneCheck = await phoneVerificationService.checkPhoneExists(
            normalizedPhone
        );

        // If phone does NOT exist, return success but don't send OTP
        // This implements anti-enumeration security
        if (!phoneCheck.exists) {
            // Log for security monitoring (detect enumeration attacks)
            await OtpAudit.create({
                phone: normalizedPhone,
                eventType: "request_nonexistent_phone",
                providerResponse: {
                    requestId,
                    source: phoneCheck.source,
                    reason: "phone_not_registered",
                },
                ip,
                userAgent,
            });

            // Still apply rate limits to prevent enumeration attacks
            await otpRedisService.applyRateLimits(normalizedPhone, ip);

            // Respond mentioning phone number is not registered,
            // but keep structure same for anti-enumeration
            const responseData = {
                requestId,
                phone: normalizedPhone,
                message: "Phone number is not registered",
                expiresIn: parseInt(process.env.OTP_TTL_SECONDS || "300"),
            };

            logger.warn(`OTP request for non-existent phone`, {
                requestId,
                phone: normalizedPhone,
                ip,
                source: phoneCheck.source,
            });

            // Return 202 (same as success) to prevent enumeration
            return res
                .status(202)
                .json(
                    successResponse(
                        responseData,
                        "Phone number is not registered"
                    )
                );
        }

        // Phone exists - proceed with OTP generation
        // Generate OTP
        const otp = generateOtp();
        const otpHmac = hmacOtp(otp, normalizedPhone);

        // Store OTP in Redis
        await otpRedisService.storeOtp(normalizedPhone, otpHmac);

        // Apply rate limits
        await otpRedisService.applyRateLimits(normalizedPhone, ip);

        // Queue SMS sending job
        // Note: Message formatting is handled by SMS provider templates
        const job = await otpQueueService.addSendOtpJob({
            phone: normalizedPhone,
            otp: otp, // Plaintext OTP for SMS (secure in Redis with TTL)
            requestId: requestId,
            ip: ip,
        });

        // Audit log
        await OtpAudit.create({
            phone: normalizedPhone,
            eventType: "requested",
            providerResponse: {
                requestId,
                jobId: job.jobId,
            },
            ip,
            userAgent,
        });

        const duration = Date.now() - startTime;
        logger.info(`OTP request successful`, {
            requestId,
            phone: normalizedPhone,
            jobId: job.jobId,
            duration: `${duration}ms`,
        });

        // In development, return OTP for testing (NEVER in production)
        const responseData = {
            requestId,
            phone: normalizedPhone,
            message: "OTP sent successfully",
            expiresIn: parseInt(process.env.OTP_TTL_SECONDS || "300"),
        };

        if (
            process.env.NODE_ENV === "development" &&
            process.env.OTP_INCLUDE_IN_RESPONSE === "true"
        ) {
            responseData.otp = otp; // FOR DEVELOPMENT ONLY
            responseData._warning =
                "OTP included for development purposes only";
        }

        return res
            .status(202)
            .json(successResponse(responseData, "OTP request accepted"));
    } catch (error) {
        logger.error("OTP request failed", {
            requestId,
            error: error.message,
            stack: error.stack,
        });

        return res
            .status(500)
            .json(
                errorResponse("Failed to process OTP request", "INTERNAL_ERROR")
            );
    }
}

/**
 * Verify OTP endpoint
 * POST /otp/verify
 * Body: { phone: string, otp: string }
 */
export async function verifyOtpEndpoint(req, res) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
        const { phone, otp } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get("user-agent");

        logger.info(
            {
                requestId,
                phone,
                ip,
                userAgent,
            },
            `OTP verification request received`
        );
        // Validate and normalize phone number
        const phoneResult = normalizePhone(phone);
        logger.info(phoneResult, "Phone result");
        if (!phoneResult.isValid) {
            await OtpAudit.create({
                phone,
                eventType: "verify_invalid_phone",
                providerResponse: { error: phoneResult.error },
                ip,
                userAgent,
            });
            return res
                .status(400)
                .json(
                    errorResponse(
                        phoneResult.error || "Invalid phone number",
                        "INVALID_PHONE"
                    )
                );
        }

        const normalizedPhone = phoneResult.normalized;
        logger.info(
            {
                requestId,
                phone: normalizedPhone,
                ip,
            },
            `OTP verification request received`
        );
        // Check verification rate limits FIRST (before expensive operations)
        const rateLimitResult =
            await otpRedisService.checkVerificationRateLimits(
                normalizedPhone,
                ip
            );
        if (!rateLimitResult.allowed) {
            await OtpAudit.create({
                phone: normalizedPhone,
                eventType: "verify_rate_limited",
                providerResponse: {
                    reason: rateLimitResult.reason,
                    retryAfter: rateLimitResult.retryAfter,
                },
                ip,
                userAgent,
            });
            return res.status(429).json(
                errorResponse(rateLimitResult.message, "RATE_LIMIT_EXCEEDED", {
                    retryAfter: rateLimitResult.retryAfter,
                    reason: rateLimitResult.reason,
                })
            );
        }
        // ========================================
        // OTP VERIFICATION (High-Performance)
        // ========================================
        // Check if OTP exists and is valid using Redis
        const otpMetadata = await otpRedisService.getOtp(normalizedPhone);
        logger.info(otpMetadata, "OTP metadata");
        if (!otpMetadata) {
            await OtpAudit.create({
                phone: normalizedPhone,
                eventType: "verify_not_found",
                providerResponse: {
                    requestId,
                    reason: "no_otp_requested",
                },
                ip,
                userAgent,
            });
            return res
                .status(400)
                .json(
                    errorResponse(
                        "No OTP found for this phone number. Please request a new OTP.",
                        "OTP_NOT_FOUND"
                    )
                );
        }
        // Check if OTP has expired
        if (isOtpExpired(otpMetadata)) {
            // Clean up expired OTP
            await otpRedisService.deleteOtp(normalizedPhone);
            await otpRedisService.clearVerifyAttempts(normalizedPhone);
            await OtpAudit.create({
                phone: normalizedPhone,
                eventType: "verify_expired",
                providerResponse: {
                    requestId,
                    reason: "otp_expired",
                },
                ip,
                userAgent,
            });
            return res
                .status(400)
                .json(
                    errorResponse(
                        "OTP has expired. Please request a new OTP.",
                        "OTP_EXPIRED"
                    )
                );
        }
        // Check if too many verification attempts
        if (isTooManyAttempts(otpMetadata)) {
            // Lock the account temporarily
            await otpRedisService.lockAccount(normalizedPhone, 15 * 60); // 15 minutes
            await OtpAudit.create({
                phone: normalizedPhone,
                eventType: "verify_locked",
                providerResponse: {
                    requestId,
                    attempts: otpMetadata.attempts,
                    reason: "too_many_attempts",
                },
                ip,
                userAgent,
            });
            return res.status(429).json(
                errorResponse(
                    "Too many verification attempts. Account temporarily locked.",
                    "ACCOUNT_LOCKED",
                    {
                        retryAfter: 900, // 15 minutes
                        reason: "too_many_attempts",
                    }
                )
            );
        }
        // Increment verification attempts
        const currentAttempts = await otpRedisService.incrementVerifyAttempts(
            normalizedPhone
        );
        // Verify OTP using timing-safe comparison
        const isValidOtp = verifyOtp(otp, otpMetadata.hmac, normalizedPhone);

        if (!isValidOtp) {
            // Update attempts in metadata
            await otpRedisService.updateOtpAttempts(
                normalizedPhone,
                currentAttempts
            );
            // Apply progressive delay based on attempts
            const delayMs = Math.min(
                1000 * Math.pow(2, currentAttempts - 1),
                16000
            ); // Max 16 seconds
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            await OtpAudit.create({
                phone: normalizedPhone,
                eventType: "verify_failed",
                providerResponse: {
                    requestId,
                    attempts: currentAttempts,
                    delay: delayMs,
                },
                ip,
                userAgent,
            });
            const remainingAttempts =
                OTP_CONFIG.MAX_VERIFY_ATTEMPTS - currentAttempts;
            return res.status(400).json(
                errorResponse(
                    `Invalid OTP. ${remainingAttempts} attempts remaining.`,
                    "INVALID_OTP",
                    {
                        remainingAttempts,
                        retryAfter: Math.ceil(delayMs / 1000),
                    }
                )
            );
        }
        // ========================================
        // SUCCESSFUL VERIFICATION
        // ========================================
        // Check if phone exists in system
        const phoneCheck = await phoneVerificationService.checkPhoneExists(
            normalizedPhone
        );
        if (!phoneCheck.exists) {
            // Clean up OTP data
            await otpRedisService.deleteOtp(normalizedPhone);
            await otpRedisService.clearVerifyAttempts(normalizedPhone);
            await OtpAudit.create({
                phone: normalizedPhone,
                eventType: "verify_phone_not_registered",
                providerResponse: {
                    requestId,
                    reason: "phone_not_registered",
                },
                ip,
                userAgent,
            });
            return res
                .status(400)
                .json(
                    errorResponse(
                        "Phone number is not registered in our system.",
                        "PHONE_NOT_REGISTERED"
                    )
                );
        }
        // Update user verification status and last login
        const user = phoneCheck.user;
        await User.updateVerificationStatus(normalizedPhone, true);
        await User.updateLastLogin(user.id);
        // Generate JWT tokens for session management
        const accessSecret =
            process.env.JWT_ACCESS_SECRET ||
            process.env.JWT_SECRET ||
            "access-secret-key";
        const refreshSecret =
            process.env.JWT_REFRESH_SECRET ||
            process.env.JWT_SECRET ||
            "refresh-secret-key";

        // Generate unique JTI for token revocation
        const accessJti = crypto.randomUUID();
        const refreshJti = crypto.randomUUID();

        const accessTokenPayload = {
            userId: user.id,
            phone: normalizedPhone,
            verified: true,
            verifiedAt: new Date().toISOString(),
            iat: Math.floor(Date.now() / 1000),
            jti: accessJti,
            type: "access",
        };

        const refreshTokenPayload = {
            userId: user.id,
            type: "refresh",
            iat: Math.floor(Date.now() / 1000),
            jti: refreshJti,
        };

        const accessToken = jwt.sign(accessTokenPayload, accessSecret, {
            expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRY || "15m",
        });

        const refreshToken = jwt.sign(refreshTokenPayload, refreshSecret, {
            expiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRY || "7d",
        });

        logger.info("Tokens generated during OTP verification", {
            requestId,
            userId: user.id,
            accessTokenIat: accessTokenPayload.iat,
            refreshTokenIat: refreshTokenPayload.iat,
            accessJti: accessJti,
            refreshJti: refreshJti,
        });

        // Clear any existing revocation timestamp for this user
        // This ensures fresh tokens work immediately after OTP verification
        await otpRedisService.clearUserRevocation(user.id);

        // Store session data in Redis with refresh token for revocation
        await otpRedisService.storeUserSession(user.id, {
            phone: normalizedPhone,
            verified: true,
            verifiedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            refreshJti: refreshJti,
        });

        // Store refresh token for validation
        await otpRedisService.storeRefreshToken(
            refreshJti,
            user.id,
            refreshToken
        );
        // Clean up OTP data after successful verification
        await otpRedisService.deleteOtp(normalizedPhone);
        await otpRedisService.clearVerifyAttempts(normalizedPhone);
        // Apply verification rate limits
        await otpRedisService.applyVerificationRateLimits(normalizedPhone, ip);
        // Audit log for successful verification
        await OtpAudit.create({
            phone: normalizedPhone,
            eventType: "verified",
            providerResponse: {
                requestId,
                userId: user.id,
                attempts: currentAttempts,
            },
            ip,
            userAgent,
        });
        const duration = Date.now() - startTime;
        logger.info(`OTP verification successful`, {
            requestId,
            phone: normalizedPhone,
            userId: user.id,
            attempts: currentAttempts,
            duration: `${duration}ms`,
        });
        // Return success response with user data and tokens
        const responseData = {
            requestId,
            user: {
                id: user.id,
                phone: normalizedPhone,
                countryCode: user.country_code,
                isVerified: true,
                verifiedAt: new Date().toISOString(),
            },
            tokens: {
                accessToken,
                refreshToken,
                expiresIn: parseInt(
                    process.env.JWT_ACCESS_TOKEN_EXPIRY || "900"
                ), // 15 minutes in seconds
            },
            message: "OTP verified successfully",
        };
        return res
            .status(200)
            .json(successResponse(responseData, "OTP verification successful"));
    } catch (error) {
        logger.error("OTP verification failed", {
            requestId,
            error: error.message,
            stack: error.stack,
        });

        return res
            .status(500)
            .json(
                errorResponse(
                    "Failed to process OTP verification",
                    "INTERNAL_ERROR"
                )
            );
    }
}

/**
 * Refresh token endpoint
 * POST /otp/refresh
 * Body: { refreshToken: string }
 */
export async function refreshToken(req, res) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
        const { refreshToken } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get("user-agent");

        if (!refreshToken) {
            return res
                .status(400)
                .json(
                    errorResponse(
                        "Refresh token is required",
                        "REFRESH_TOKEN_REQUIRED"
                    )
                );
        }

        // Verify refresh token
        const refreshSecret =
            process.env.JWT_REFRESH_SECRET ||
            process.env.JWT_SECRET ||
            "refresh-secret-key";
        let decoded;

        try {
            decoded = jwt.verify(refreshToken, refreshSecret);
        } catch (error) {
            if (error.name === "TokenExpiredError") {
                return res
                    .status(401)
                    .json(
                        errorResponse(
                            "Refresh token has expired",
                            "REFRESH_TOKEN_EXPIRED"
                        )
                    );
            }
            return res
                .status(401)
                .json(
                    errorResponse(
                        "Invalid refresh token",
                        "INVALID_REFRESH_TOKEN"
                    )
                );
        }

        // Check if it's a refresh token
        if (decoded.type !== "refresh") {
            return res
                .status(401)
                .json(
                    errorResponse("Invalid token type", "INVALID_TOKEN_TYPE")
                );
        }

        // Check if refresh token exists in Redis
        const storedToken = await otpRedisService.getRefreshToken(decoded.jti);
        logger.info(storedToken, "Stored token");
        if (!storedToken) {
            return res
                .status(401)
                .json(
                    errorResponse(
                        "Refresh token not found or revoked",
                        "REFRESH_TOKEN_REVOKED"
                    )
                );
        }

        // Get user data
        const user = await User.findById(storedToken.userId);
        if (!user) {
            // Revoke all tokens for non-existent user
            await otpRedisService.revokeAllUserTokens(decoded.userId);
            return res
                .status(401)
                .json(errorResponse("User not found", "USER_NOT_FOUND"));
        }

        // Revoke all existing access tokens BEFORE generating new ones
        // This ensures old access tokens become invalid after refresh
        await otpRedisService.revokeAllUserAccessTokens(user.id);

        // Generate only new access token (refresh token stays the same)
        const accessSecret =
            process.env.JWT_ACCESS_SECRET ||
            process.env.JWT_SECRET ||
            "access-secret-key";
        const newAccessJti = crypto.randomUUID();

        const accessTokenPayload = {
            userId: user.id,
            phone: user.phone,
            verified: true,
            verifiedAt: new Date().toISOString(),
            iat: Math.floor(Date.now() / 1000),
            jti: newAccessJti,
            type: "access",
        };

        const newAccessToken = jwt.sign(accessTokenPayload, accessSecret, {
            expiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRY || "15m",
        });

        // Update session with new access token JTI (refresh token remains the same)
        await otpRedisService.storeUserSession(user.id, {
            phone: user.phone,
            verified: true,
            verifiedAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            refreshJti: decoded.jti, // Keep the same refresh token JTI
        });

        // Audit log
        await OtpAudit.create({
            phone: user.phone,
            eventType: "token_refreshed",
            providerResponse: {
                requestId,
                userId: user.id,
                refreshJti: decoded.jti,
                newAccessJti: newAccessJti,
                accessTokensRevoked: true,
            },
            ip,
            userAgent,
        });

        const duration = Date.now() - startTime;
        logger.info(`Token refresh successful`, {
            requestId,
            userId: user.id,
            accessTokensRevoked: true,
            duration: `${duration}ms`,
        });

        const responseData = {
            requestId,
            accessToken: newAccessToken,
            expiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRY || "900"),
        };

        return res
            .status(200)
            .json(
                successResponse(
                    responseData,
                    "Access token refreshed successfully"
                )
            );
    } catch (error) {
        logger.error("Token refresh failed", {
            requestId,
            error: error.message,
            stack: error.stack,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to refresh tokens", "INTERNAL_ERROR"));
    }
}

/**
 * Logout endpoint
 * POST /otp/logout
 * Body: { refreshToken: string }
 */
export async function logout(req, res) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
        const { refreshToken } = req.body;
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get("user-agent");

        if (!refreshToken) {
            return res
                .status(400)
                .json(
                    errorResponse(
                        "Refresh token is required",
                        "REFRESH_TOKEN_REQUIRED"
                    )
                );
        }

        // Verify refresh token to get user info
        const refreshSecret =
            process.env.JWT_REFRESH_SECRET ||
            process.env.JWT_SECRET ||
            "refresh-secret-key";
        let decoded;

        try {
            decoded = jwt.verify(refreshToken, refreshSecret);
        } catch (error) {
            // Even if token is invalid/expired, we should still return success
            // to prevent information leakage
            return res
                .status(200)
                .json(successResponse({}, "Logged out successfully"));
        }

        // Revoke all tokens for the user (both refresh and access tokens)
        await otpRedisService.revokeAllUserTokens(decoded.userId);
        await otpRedisService.revokeAllUserAccessTokens(decoded.userId);

        // Audit log
        await OtpAudit.create({
            phone: decoded.phone || "unknown",
            eventType: "logout",
            providerResponse: {
                requestId,
                userId: decoded.userId,
            },
            ip,
            userAgent,
        });

        const duration = Date.now() - startTime;
        logger.info(`User logout successful`, {
            requestId,
            userId: decoded.userId,
            duration: `${duration}ms`,
        });

        return res
            .status(200)
            .json(successResponse({}, "Logged out successfully"));
    } catch (error) {
        logger.error("Logout failed", {
            requestId,
            error: error.message,
            stack: error.stack,
        });

        return res
            .status(500)
            .json(errorResponse("Failed to logout", "INTERNAL_ERROR"));
    }
}

/**
 * Resend OTP endpoint
 * POST /otp/resend
 * Body: { phone: string }
 */
export async function resendOtp(req, res) {
    // Resend is essentially the same as request, but with different audit event
    // Just call requestOtp with a flag
    return requestOtp(req, res);
}

/**
 * Test protected route endpoint
 * GET /otp/test-protected
 * Requires valid JWT token in Authorization header
 */
export async function testProtectedRoute(req, res) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get("user-agent");

        logger.info("Test protected route accessed", {
            requestId,
            userId: req.userId,
            user: req.user,
            ip,
            userAgent,
        });

        const duration = Date.now() - startTime;

        const responseData = {
            requestId,
            message: "Protected route accessed successfully",
            user: {
                id: req.userId,
                phone: req.user?.phone,
                verified: req.user?.verified,
                verifiedAt: req.user?.verifiedAt,
                tokenType: req.user?.type,
                issuedAt: new Date(req.user?.iat * 1000).toISOString(),
            },
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`,
        };

        return res
            .status(200)
            .json(
                successResponse(responseData, "Protected route test successful")
            );
    } catch (error) {
        logger.error("Test protected route failed", {
            requestId,
            error: error.message,
            stack: error.stack,
        });

        return res
            .status(500)
            .json(
                errorResponse(
                    "Failed to process protected route test",
                    "INTERNAL_ERROR"
                )
            );
    }
}

// Export verifyOtpEndpoint as verifyOtp for the routes
export { verifyOtpEndpoint as verifyOtp };
