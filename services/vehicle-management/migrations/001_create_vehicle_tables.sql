-- Vehicle Management Database Schema
-- Creates tables for vehicles and paired devices

-- Add chassis_number column to vehicles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicles' AND column_name = 'chassis_number'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN chassis_number VARCHAR(50);

        -- Add unique constraint
        CREATE UNIQUE INDEX idx_vehicles_chassis_unique ON vehicles(chassis_number)
        WHERE chassis_number IS NOT NULL;
    END IF;
END $$;

-- Create unique index on reg_number if not exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_reg_number ON vehicles(reg_number);

-- Add image_url column to vehicles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'vehicles' AND column_name = 'image_url'
    ) THEN
        ALTER TABLE vehicles ADD COLUMN image_url VARCHAR(255) DEFAULT '/img/car.svg';
    END IF;
END $$;

-- Paired Devices Table
CREATE TABLE IF NOT EXISTS paired_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    chassis_number VARCHAR(50),
    reg_number VARCHAR(20),
    bluetooth_mac VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    connected_at TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ,
    device_metadata JSONB DEFAULT '{}',
    idempotency_key TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for paired_devices
CREATE INDEX IF NOT EXISTS idx_paired_user_active ON paired_devices(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_paired_chassis ON paired_devices(chassis_number);
CREATE INDEX IF NOT EXISTS idx_paired_user_chassis ON paired_devices(user_id, chassis_number);
CREATE INDEX IF NOT EXISTS idx_paired_idempotency ON paired_devices(user_id, idempotency_key);

-- Critical indexes for API 2: Get Paired Devices
CREATE INDEX IF NOT EXISTS idx_paired_user_active_lastseen ON paired_devices(user_id, is_active, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_paired_user_lastseen ON paired_devices(user_id, last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_paired_vehicle ON paired_devices(vehicle_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for paired_devices updated_at
CREATE TRIGGER update_paired_devices_updated_at
    BEFORE UPDATE ON paired_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to explain type consistency
COMMENT ON COLUMN paired_devices.user_id IS 'References users(id) - BIGINT type to match users.id (BIGSERIAL)';
COMMENT ON COLUMN paired_devices.vehicle_id IS 'References vehicles(id) - UUID type to match vehicles.id';

-- Composite index for paired_devices vehicle queries (user_id, is_active, last_seen DESC, id)
-- This supports efficient keyset pagination with filtering
CREATE INDEX IF NOT EXISTS idx_paired_vehicles ON paired_devices(user_id, is_active, last_seen DESC, id);

