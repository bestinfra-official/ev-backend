-- Auth Management Database Schema
-- Creates tables for user authentication and OTP management

-- Users Table
-- Stores user information and authentication data
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    country_code VARCHAR(10) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- OTP Audit Table
-- Stores audit logs for OTP operations (requests, verifications, failures, etc.)
CREATE TABLE IF NOT EXISTS otp_audit (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    provider VARCHAR(100),
    provider_response JSONB,
    ip VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance optimization
-- Index on phone for fast lookups in users table
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- Index on phone for fast lookups in otp_audit table
CREATE INDEX IF NOT EXISTS idx_otp_audit_phone ON otp_audit(phone);

-- Index on event_type for filtering audit logs
CREATE INDEX IF NOT EXISTS idx_otp_audit_event_type ON otp_audit(event_type);

-- Index on created_at for time-based queries in otp_audit
CREATE INDEX IF NOT EXISTS idx_otp_audit_created_at ON otp_audit(created_at);

-- Composite index for phone and event_type lookups
CREATE INDEX IF NOT EXISTS idx_otp_audit_phone_event ON otp_audit(phone, event_type);

-- Composite index for phone and created_at for time-range queries
CREATE INDEX IF NOT EXISTS idx_otp_audit_phone_created ON otp_audit(phone, created_at);

-- Index on is_verified for filtering verified users
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- Index on is_active for filtering active users
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Index on country_code for filtering by country
CREATE INDEX IF NOT EXISTS idx_users_country_code ON users(country_code);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at on users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to tables
COMMENT ON TABLE users IS 'Stores user information and authentication data for phone-based authentication';
COMMENT ON TABLE otp_audit IS 'Stores audit logs for OTP operations including requests, verifications, and failures';

-- Add comments to important columns
COMMENT ON COLUMN users.id IS 'Primary key - BIGSERIAL type for compatibility with paired_devices and vehicles tables';
COMMENT ON COLUMN users.phone IS 'Phone number in E.164 format (unique, indexed for fast lookups)';
COMMENT ON COLUMN users.is_verified IS 'Indicates if the user has verified their phone number';
COMMENT ON COLUMN users.is_active IS 'Indicates if the user account is active';
COMMENT ON COLUMN users.metadata IS 'Additional user data stored as JSON';
COMMENT ON COLUMN otp_audit.phone IS 'Phone number associated with the audit event';
COMMENT ON COLUMN otp_audit.event_type IS 'Type of OTP event (e.g., requested, verified, verified_failed, verified_locked)';
COMMENT ON COLUMN otp_audit.provider IS 'SMS provider used to send OTP (e.g., MSG91)';
COMMENT ON COLUMN otp_audit.provider_response IS 'Response from SMS provider containing status and message details';
COMMENT ON COLUMN otp_audit.metadata IS 'Additional metadata for the audit event stored as JSON';


