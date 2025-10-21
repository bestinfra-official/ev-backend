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
                                                        example: "req_123456",
                                                    },
                                                    phone: {
                                                        type: "string",
                                                        example:
                                                            "+919876543210",
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
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                400: { $ref: "#/components/responses/ValidationError" },
                429: { $ref: "#/components/responses/RateLimitError" },
                500: { $ref: "#/components/responses/InternalServerError" },
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
                                                        example: "req_123456",
                                                    },
                                                    user: {
                                                        $ref: "#/components/schemas/User",
                                                    },
                                                    tokens: {
                                                        $ref: "#/components/schemas/Tokens",
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
                        },
                    },
                },
                400: { $ref: "#/components/responses/ValidationError" },
                429: { $ref: "#/components/responses/RateLimitError" },
                500: { $ref: "#/components/responses/InternalServerError" },
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
                                                        example: "req_123456",
                                                    },
                                                    accessToken: {
                                                        type: "string",
                                                        example:
                                                            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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
                        },
                    },
                },
                400: { $ref: "#/components/responses/ValidationError" },
                401: { $ref: "#/components/responses/Unauthorized" },
                500: { $ref: "#/components/responses/InternalServerError" },
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
                        },
                    },
                },
                400: { $ref: "#/components/responses/ValidationError" },
                500: { $ref: "#/components/responses/InternalServerError" },
            },
        },
    },

    "/api/v1/auth/otp/resend": {
        post: {
            tags: ["Authentication"],
            summary: "Resend OTP",
            description: "Resend OTP to the same phone number.",
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
                                                        example: "req_123456",
                                                    },
                                                    phone: {
                                                        type: "string",
                                                        example:
                                                            "+919876543210",
                                                    },
                                                    message: {
                                                        type: "string",
                                                        example:
                                                            "OTP sent successfully",
                                                    },
                                                    expiresIn: {
                                                        type: "integer",
                                                        example: 300,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                400: { $ref: "#/components/responses/ValidationError" },
                429: { $ref: "#/components/responses/RateLimitError" },
                500: { $ref: "#/components/responses/InternalServerError" },
            },
        },
    },

    "/api/v1/auth/otp/test-protected": {
        get: {
            tags: ["Authentication"],
            summary: "Test Protected Route (Requires Bearer Token)",
            description:
                "Test endpoint to verify JWT token authentication. Requires valid Bearer token in Authorization header. Format: 'Bearer <your-access-token>'",
            security: [{ BearerAuth: [] }],
            parameters: [
                {
                    $ref: "#/components/parameters/AuthorizationHeader",
                },
            ],
            responses: {
                200: {
                    description: "Protected route accessed successfully",
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
                                                        example: "req_123456",
                                                    },
                                                    message: {
                                                        type: "string",
                                                        example:
                                                            "Protected route accessed successfully",
                                                    },
                                                    user: {
                                                        type: "object",
                                                        properties: {
                                                            id: {
                                                                type: "string",
                                                                example:
                                                                    "user_123",
                                                            },
                                                            phone: {
                                                                type: "string",
                                                                example:
                                                                    "+919876543210",
                                                            },
                                                            verified: {
                                                                type: "boolean",
                                                                example: true,
                                                            },
                                                            verifiedAt: {
                                                                type: "string",
                                                                format: "date-time",
                                                                example:
                                                                    "2024-01-15T10:30:00Z",
                                                            },
                                                            tokenType: {
                                                                type: "string",
                                                                example:
                                                                    "access",
                                                            },
                                                            issuedAt: {
                                                                type: "string",
                                                                format: "date-time",
                                                                example:
                                                                    "2024-01-15T10:30:00Z",
                                                            },
                                                        },
                                                    },
                                                    timestamp: {
                                                        type: "string",
                                                        format: "date-time",
                                                        example:
                                                            "2024-01-15T10:30:00Z",
                                                    },
                                                    duration: {
                                                        type: "string",
                                                        example: "15ms",
                                                    },
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
                401: { $ref: "#/components/responses/Unauthorized" },
                500: { $ref: "#/components/responses/InternalServerError" },
            },
        },
    },
};
