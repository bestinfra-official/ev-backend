/**
 * Swagger Path Definitions - Authentication Service
 * OTP-based authentication endpoints
 */

export default {
    "/api/v1/auth/otp/request": {
        post: {
            tags: ["Authentication"],
            summary: "Request OTP",
            description: "Request a new OTP for phone number verification.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/RequestOTPBody",
                        },
                        example: {
                            phone: "+919876543210",
                            countryCode: "IN",
                        },
                    },
                },
            },
            responses: {
                202: {
                    description: "OTP request accepted",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/SuccessResponse",
                                    },
                                    {
                                        properties: {
                                            data: {
                                                type: "object",
                                                properties: {
                                                    requestId: {
                                                        type: "string",
                                                        example:
                                                            "req_1705123456789_abc123def",
                                                        description:
                                                            "Unique request identifier",
                                                    },
                                                    phone: {
                                                        type: "string",
                                                        example:
                                                            "+919876543210",
                                                        description:
                                                            "Normalized phone number",
                                                    },
                                                    message: {
                                                        type: "string",
                                                        example:
                                                            "OTP sent successfully",
                                                    },
                                                    expiresIn: {
                                                        type: "integer",
                                                        example: 300,
                                                        description:
                                                            "OTP expiration time in seconds",
                                                    },
                                                    otp: {
                                                        type: "string",
                                                        example: "123456",
                                                        description:
                                                            "OTP code (only in development mode)",
                                                    },
                                                    _warning: {
                                                        type: "string",
                                                        example:
                                                            "OTP included for development purposes only",
                                                        description:
                                                            "Warning message in development mode",
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                            examples: {
                                development: {
                                    summary: "Development Response (with OTP)",
                                    value: {
                                        success: true,
                                        message: "OTP request accepted",
                                        data: {
                                            requestId:
                                                "req_1705123456789_abc123def",
                                            phone: "+919876543210",
                                            message: "OTP sent successfully",
                                            expiresIn: 300,
                                            otp: "123456",
                                            _warning:
                                                "OTP included for development purposes only",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                production: {
                                    summary: "Production Response (no OTP)",
                                    value: {
                                        success: true,
                                        message: "OTP request accepted",
                                        data: {
                                            requestId:
                                                "req_1705123456789_abc123def",
                                            phone: "+919876543210",
                                            message: "OTP sent successfully",
                                            expiresIn: 300,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    description: "Validation error or invalid phone number",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            examples: {
                                invalidPhone: {
                                    summary: "Invalid Phone Number",
                                    value: {
                                        success: false,
                                        message:
                                            "Phone number contains invalid characters",
                                        error: "INVALID_PHONE",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                validationError: {
                                    summary: "Validation Error",
                                    value: {
                                        success: false,
                                        message: "Validation failed",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "phone",
                                            message:
                                                "Phone number must be at least 10 digits",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                429: {
                    description: "Rate limit exceeded",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/ErrorResponse",
                                    },
                                    {
                                        properties: {
                                            details: {
                                                $ref: "#/components/schemas/RateLimitInfo",
                                            },
                                        },
                                    },
                                ],
                            },
                            examples: {
                                ipRateLimit: {
                                    summary: "IP Rate Limit Exceeded",
                                    value: {
                                        success: false,
                                        message:
                                            "Too many requests from this IP address",
                                        error: "RATE_LIMIT_EXCEEDED",
                                        details: {
                                            retryAfter: 60,
                                            reason: "ip_rate_limit",
                                            limit: 10,
                                            remaining: 0,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                phoneRateLimit: {
                                    summary: "Phone Rate Limit Exceeded",
                                    value: {
                                        success: false,
                                        message:
                                            "Too many OTP requests for this phone number",
                                        error: "RATE_LIMIT_EXCEEDED",
                                        details: {
                                            retryAfter: 300,
                                            reason: "phone_rate_limit",
                                            limit: 3,
                                            remaining: 0,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                500: {
                    $ref: "#/components/responses/InternalServerError",
                },
            },
        },
    },

    "/api/v1/auth/otp/verify": {
        post: {
            tags: ["Authentication"],
            summary: "Verify OTP",
            description: "Verify the OTP code and authenticate the user.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/VerifyOTPBody",
                        },
                        example: {
                            phone: "+919876543210",
                            otp: "123456",
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "OTP verified successfully",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/SuccessResponse",
                                    },
                                    {
                                        properties: {
                                            data: {
                                                type: "object",
                                                properties: {
                                                    requestId: {
                                                        type: "string",
                                                        example:
                                                            "req_1705123456789_abc123def",
                                                        description:
                                                            "Unique request identifier",
                                                    },
                                                    user: {
                                                        type: "object",
                                                        properties: {
                                                            id: {
                                                                type: "string",
                                                                example:
                                                                    "user_123456789",
                                                            },
                                                            phone: {
                                                                type: "string",
                                                                example:
                                                                    "+919876543210",
                                                            },
                                                            countryCode: {
                                                                type: "string",
                                                                example: "IN",
                                                            },
                                                            isVerified: {
                                                                type: "boolean",
                                                                example: true,
                                                            },
                                                            verifiedAt: {
                                                                type: "string",
                                                                format: "date-time",
                                                                example:
                                                                    "2024-01-15T10:30:00Z",
                                                            },
                                                        },
                                                    },
                                                    tokens: {
                                                        type: "object",
                                                        properties: {
                                                            accessToken: {
                                                                type: "string",
                                                                example:
                                                                    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                                                                description:
                                                                    "JWT access token",
                                                            },
                                                            refreshToken: {
                                                                type: "string",
                                                                example:
                                                                    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                                                                description:
                                                                    "JWT refresh token",
                                                            },
                                                            expiresIn: {
                                                                type: "integer",
                                                                example: 900,
                                                                description:
                                                                    "Access token expiration time in seconds",
                                                            },
                                                        },
                                                    },
                                                    message: {
                                                        type: "string",
                                                        example:
                                                            "OTP verified successfully",
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                            example: {
                                success: true,
                                message: "OTP verification successful",
                                data: {
                                    requestId: "req_1705123456789_abc123def",
                                    user: {
                                        id: "user_123456789",
                                        phone: "+919876543210",
                                        countryCode: "IN",
                                        isVerified: true,
                                        verifiedAt: "2024-01-15T10:30:00Z",
                                    },
                                    tokens: {
                                        accessToken:
                                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                                        refreshToken:
                                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                                        expiresIn: 900,
                                    },
                                    message: "OTP verified successfully",
                                },
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                400: {
                    description:
                        "Validation error, invalid OTP, or OTP expired",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            examples: {
                                invalidOtp: {
                                    summary: "Invalid OTP",
                                    value: {
                                        success: false,
                                        message:
                                            "Invalid OTP. 2 attempts remaining.",
                                        error: "INVALID_OTP",
                                        details: {
                                            remainingAttempts: 2,
                                            retryAfter: 1,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                otpExpired: {
                                    summary: "OTP Expired",
                                    value: {
                                        success: false,
                                        message:
                                            "OTP has expired. Please request a new OTP.",
                                        error: "OTP_EXPIRED",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                otpNotFound: {
                                    summary: "OTP Not Found",
                                    value: {
                                        success: false,
                                        message:
                                            "No OTP found for this phone number. Please request a new OTP.",
                                        error: "OTP_NOT_FOUND",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                accountLocked: {
                                    summary: "Account Locked",
                                    value: {
                                        success: false,
                                        message:
                                            "Too many verification attempts. Account temporarily locked.",
                                        error: "ACCOUNT_LOCKED",
                                        details: {
                                            retryAfter: 900,
                                            reason: "too_many_attempts",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                429: {
                    description: "Rate limit exceeded",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/ErrorResponse",
                                    },
                                    {
                                        properties: {
                                            details: {
                                                $ref: "#/components/schemas/RateLimitInfo",
                                            },
                                        },
                                    },
                                ],
                            },
                            example: {
                                success: false,
                                message: "Too many verification attempts",
                                error: "RATE_LIMIT_EXCEEDED",
                                details: {
                                    retryAfter: 60,
                                    reason: "verification_rate_limit",
                                },
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                500: {
                    $ref: "#/components/responses/InternalServerError",
                },
            },
        },
    },

    "/api/v1/auth/otp/refresh": {
        post: {
            tags: ["Authentication"],
            summary: "Refresh Access Token",
            description:
                "Refresh the access token using a valid refresh token.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/RefreshTokenBody",
                        },
                        example: {
                            refreshToken:
                                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Access token refreshed successfully",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/SuccessResponse",
                                    },
                                    {
                                        properties: {
                                            data: {
                                                type: "object",
                                                properties: {
                                                    requestId: {
                                                        type: "string",
                                                        example:
                                                            "req_1705123456789_abc123def",
                                                        description:
                                                            "Unique request identifier",
                                                    },
                                                    accessToken: {
                                                        type: "string",
                                                        example:
                                                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                                                        description:
                                                            "New JWT access token",
                                                    },
                                                    expiresIn: {
                                                        type: "integer",
                                                        example: 900,
                                                        description:
                                                            "Access token expiration time in seconds",
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                            example: {
                                success: true,
                                message: "Access token refreshed successfully",
                                data: {
                                    requestId: "req_1705123456789_abc123def",
                                    accessToken:
                                        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                                    expiresIn: 900,
                                },
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                400: {
                    description: "Validation error or missing refresh token",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            example: {
                                success: false,
                                message: "Refresh token is required",
                                error: "REFRESH_TOKEN_REQUIRED",
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                401: {
                    description: "Invalid, expired, or revoked refresh token",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            examples: {
                                expiredToken: {
                                    summary: "Refresh Token Expired",
                                    value: {
                                        success: false,
                                        message: "Refresh token has expired",
                                        error: "REFRESH_TOKEN_EXPIRED",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                invalidToken: {
                                    summary: "Invalid Refresh Token",
                                    value: {
                                        success: false,
                                        message: "Invalid refresh token",
                                        error: "INVALID_REFRESH_TOKEN",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                revokedToken: {
                                    summary: "Refresh Token Revoked",
                                    value: {
                                        success: false,
                                        message:
                                            "Refresh token not found or revoked",
                                        error: "REFRESH_TOKEN_REVOKED",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                userNotFound: {
                                    summary: "User Not Found",
                                    value: {
                                        success: false,
                                        message: "User not found",
                                        error: "USER_NOT_FOUND",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                500: {
                    $ref: "#/components/responses/InternalServerError",
                },
            },
        },
    },

    "/api/v1/auth/otp/logout": {
        post: {
            tags: ["Authentication"],
            summary: "Logout User",
            description: "Logout user and revoke all tokens.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/LogoutBody",
                        },
                        example: {
                            refreshToken:
                                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Logout successful",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/SuccessResponse",
                                    },
                                    {
                                        properties: {
                                            data: {
                                                type: "object",
                                                example: {},
                                                description:
                                                    "Empty data object",
                                            },
                                            message: {
                                                type: "string",
                                                example:
                                                    "Logged out successfully",
                                            },
                                        },
                                    },
                                ],
                            },
                            example: {
                                success: true,
                                message: "Logged out successfully",
                                data: {},
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                400: {
                    description: "Validation error or missing refresh token",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            example: {
                                success: false,
                                message: "Refresh token is required",
                                error: "REFRESH_TOKEN_REQUIRED",
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                500: {
                    $ref: "#/components/responses/InternalServerError",
                },
            },
        },
    },

    "/api/v1/auth/otp/resend": {
        post: {
            tags: ["Authentication"],
            summary: "Resend OTP",
            description:
                "Resend OTP to the same phone number. Uses the same logic as request OTP but with different audit trail.",
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            $ref: "#/components/schemas/RequestOTPBody",
                        },
                        example: {
                            phone: "+919876543210",
                            countryCode: "IN",
                        },
                    },
                },
            },
            responses: {
                202: {
                    description: "OTP resend request accepted",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/SuccessResponse",
                                    },
                                    {
                                        properties: {
                                            data: {
                                                type: "object",
                                                properties: {
                                                    requestId: {
                                                        type: "string",
                                                        example:
                                                            "req_1705123456789_abc123def",
                                                        description:
                                                            "Unique request identifier",
                                                    },
                                                    phone: {
                                                        type: "string",
                                                        example:
                                                            "+919876543210",
                                                        description:
                                                            "Normalized phone number",
                                                    },
                                                    message: {
                                                        type: "string",
                                                        example:
                                                            "OTP sent successfully",
                                                    },
                                                    expiresIn: {
                                                        type: "integer",
                                                        example: 300,
                                                        description:
                                                            "OTP expiration time in seconds",
                                                    },
                                                    otp: {
                                                        type: "string",
                                                        example: "123456",
                                                        description:
                                                            "OTP code (only in development mode)",
                                                    },
                                                    _warning: {
                                                        type: "string",
                                                        example:
                                                            "OTP included for development purposes only",
                                                        description:
                                                            "Warning message in development mode",
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                            example: {
                                success: true,
                                message: "OTP request accepted",
                                data: {
                                    requestId: "req_1705123456789_abc123def",
                                    phone: "+919876543210",
                                    message: "OTP sent successfully",
                                    expiresIn: 300,
                                    otp: "123456",
                                    _warning:
                                        "OTP included for development purposes only",
                                },
                                timestamp: "2024-01-15T10:30:00Z",
                            },
                        },
                    },
                },
                400: {
                    description: "Validation error or invalid phone number",
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/ErrorResponse",
                            },
                            examples: {
                                invalidPhone: {
                                    summary: "Invalid Phone Number",
                                    value: {
                                        success: false,
                                        message:
                                            "Phone number contains invalid characters",
                                        error: "INVALID_PHONE",
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                validationError: {
                                    summary: "Validation Error",
                                    value: {
                                        success: false,
                                        message: "Validation failed",
                                        error: "VALIDATION_ERROR",
                                        details: {
                                            field: "phone",
                                            message:
                                                "Phone number must be at least 10 digits",
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                429: {
                    description: "Rate limit exceeded",
                    content: {
                        "application/json": {
                            schema: {
                                allOf: [
                                    {
                                        $ref: "#/components/schemas/ErrorResponse",
                                    },
                                    {
                                        properties: {
                                            details: {
                                                $ref: "#/components/schemas/RateLimitInfo",
                                            },
                                        },
                                    },
                                ],
                            },
                            examples: {
                                ipRateLimit: {
                                    summary: "IP Rate Limit Exceeded",
                                    value: {
                                        success: false,
                                        message:
                                            "Too many requests from this IP address",
                                        error: "RATE_LIMIT_EXCEEDED",
                                        details: {
                                            retryAfter: 60,
                                            reason: "ip_rate_limit",
                                            limit: 10,
                                            remaining: 0,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                                phoneRateLimit: {
                                    summary: "Phone Rate Limit Exceeded",
                                    value: {
                                        success: false,
                                        message:
                                            "Too many OTP requests for this phone number",
                                        error: "RATE_LIMIT_EXCEEDED",
                                        details: {
                                            retryAfter: 300,
                                            reason: "phone_rate_limit",
                                            limit: 3,
                                            remaining: 0,
                                        },
                                        timestamp: "2024-01-15T10:30:00Z",
                                    },
                                },
                            },
                        },
                    },
                },
                500: {
                    $ref: "#/components/responses/InternalServerError",
                },
            },
        },
    },
};
