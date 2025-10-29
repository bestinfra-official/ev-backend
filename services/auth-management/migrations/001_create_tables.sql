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


-----------------------------------------------------------------------------------


-- Database Type Consistency Migration Updates
-- Run these ONLY if your database already exists
-- For new databases, use the updated migration files instead

-- ============================================
-- STEP 1: Update users table (auth-management)
-- ============================================
-- If users table exists with SERIAL (INTEGER) id, we need to alter it
-- WARNING: This only works if there are no foreign key constraints yet

-- First, check current structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'id';

-- If it shows INTEGER, run:
-- Note: You cannot directly convert SERIAL to BIGSERIAL in PostgreSQL
-- So we need to alter the sequence type first

-- Alter the sequence to support BIGINT
ALTER SEQUENCE users_id_seq AS BIGINT;

-- Then alter the column type
ALTER TABLE users ALTER COLUMN id TYPE BIGINT;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'id';

-- ============================================
-- STEP 2: Update vehicles table (station-discovery)
-- ============================================
-- If vehicles.user_id exists as UUID, convert it to BIGINT

-- Check current structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vehicles' AND column_name = 'user_id';

-- Drop existing foreign key constraint if it exists
ALTER TABLE vehicles
DROP CONSTRAINT IF EXISTS vehicles_user_id_fkey;

-- Convert UUID column to BIGINT
-- WARNING: This will fail if there are actual UUID values in user_id
-- You'll need to either clear the column or convert the UUIDs to user IDs

-- Option A: Clear the column and convert type
ALTER TABLE vehicles
ALTER COLUMN user_id TYPE BIGINT USING NULL;

-- Option B: If you need to preserve some data, convert specific UUIDs
-- You'll need to map UUIDs to actual user IDs manually

-- Add the foreign key constraint
ALTER TABLE vehicles
ADD CONSTRAINT vehicles_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE SET NULL;

-- Verify the change
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vehicles' AND column_name = 'user_id';

-- ============================================
-- STEP 3: Verify paired_devices table (vehicle-management)
-- ============================================
-- Check if paired_devices already exists and has correct types

SELECT
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'paired_devices'
AND column_name IN ('user_id', 'vehicle_id');

-- If user_id is not BIGINT, convert it:
ALTER TABLE paired_devices
ALTER COLUMN user_id TYPE BIGINT;

-- If vehicle_id is not UUID, convert it:
ALTER TABLE paired_devices
ALTER COLUMN vehicle_id TYPE UUID USING vehicle_id::UUID;

-- Add foreign key constraints if they don't exist
ALTER TABLE paired_devices
ADD CONSTRAINT paired_devices_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id)
ON DELETE CASCADE;

ALTER TABLE paired_devices
ADD CONSTRAINT paired_devices_vehicle_id_fkey
FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
ON DELETE SET NULL;

-- ============================================
-- STEP 4: Verify all foreign key constraints
-- ============================================

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- STEP 5: Add helpful comments (optional)
-- ============================================

COMMENT ON COLUMN users.id IS 'Primary key - BIGSERIAL type for compatibility with paired_devices and vehicles tables';

COMMENT ON COLUMN vehicles.user_id IS 'References users(id) - BIGINT type for consistency across services';
COMMENT ON COLUMN vehicles.id IS 'Primary key - UUID type for compatibility with paired_devices.vehicle_id';

COMMENT ON COLUMN paired_devices.user_id IS 'References users(id) - BIGINT type to match users.id (BIGSERIAL)';
COMMENT ON COLUMN paired_devices.vehicle_id IS 'References vehicles(id) - UUID type to match vehicles.id';

-- ============================================
-- FINAL VERIFICATION
-- ============================================

-- Check all user_id columns across all tables
SELECT
    'users' as table_name,
    'id' as column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'id'

UNION ALL

SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE column_name = 'user_id'
AND table_schema = 'public'
ORDER BY table_name;
