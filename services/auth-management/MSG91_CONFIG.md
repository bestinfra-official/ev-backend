# MSG91 SMS Provider Configuration

This document outlines the required environment variables for the MSG91 SMS provider integration.

## Required Environment Variables

### MSG91 Configuration

```bash
# Get these values from your MSG91 dashboard: https://control.msg91.com/
MSG91_AUTH_KEY=your_auth_key_here
MSG91_SENDER_ID=EVPLAT
MSG91_TEMPLATE_ID=your_otp_template_id_here
```

### Advanced Configuration

```bash
# Circuit Breaker Configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_SUCCESS_THRESHOLD=2
CIRCUIT_BREAKER_TIMEOUT=60000
CIRCUIT_BREAKER_HALF_OPEN_REQUESTS=3

# OTP Configuration
OTP_TTL_SECONDS=300
```

## Setup Instructions

1. **Create MSG91 Account**: Sign up at [MSG91 Control Panel](https://control.msg91.com/)

2. **Get Auth Key**:

    - Go to API section in your MSG91 dashboard
    - Copy your Auth Key

3. **Create Sender ID**:

    - Go to Sender ID section
    - Create a sender ID (e.g., "EVPLAT")
    - Get it approved

4. **Create OTP Template**:

    - Go to Templates section
    - Create a new OTP template
    - Use variables like `##otp##` for OTP code
    - Get template approved
    - Copy the Template ID

5. **Configure Environment Variables**:
    - Add the above variables to your `.env` file
    - Restart the service

## Template Variables Support

The MSG91 provider now supports template variables for both OTP and general SMS:

### OTP Templates

-   `##otp##` - OTP code
-   `##otp_length##` - Length of OTP
-   `##otp_expiry##` - OTP expiry in minutes

### General SMS Templates

-   `##var##` - DTR number
-   `##var1##` - Meter number
-   `##var2##` - Abnormality type
-   `##var3##` - Timestamp
-   `##var4##` - Last communication date
-   `##var5##` - Level
-   `##var6##` - Full message

## Testing

To test the SMS integration:

1. Ensure all environment variables are set
2. Start the auth-management service
3. Send a test OTP request
4. Check logs for SMS sending status

## Troubleshooting

### Common Issues

1. **"MSG91 client not initialized properly"**

    - Check if `MSG91_AUTH_KEY` is set correctly
    - Verify the auth key is valid

2. **"Template configuration issue detected"**

    - Verify template ID is correct
    - Ensure template is approved in MSG91 dashboard
    - Check template variable names match

3. **"All SMS providers failed"**
    - Check circuit breaker status
    - Verify MSG91 account has sufficient balance
    - Check network connectivity

### Debug Mode

Enable debug logging by setting:

```bash
LOG_LEVEL=debug
```

This will provide detailed logs of SMS sending attempts and responses.
