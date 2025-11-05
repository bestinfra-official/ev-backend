-- Booking and Charging Management Database Schema
-- Creates tables for connectors, bookings, sessions, and holds

-- Connectors Table
-- Represents individual charging connectors at a station
CREATE TABLE IF NOT EXISTS connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES charging_stations(id) ON DELETE CASCADE,
    connector_number VARCHAR(10) NOT NULL,
    connector_type VARCHAR(50) NOT NULL, -- CCS, CHAdeMO, Type2, etc.
    power_kw DECIMAL(8, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'OFFLINE', 'FAULTED')),
    current_booking_id UUID, -- Currently active booking
    vendor_connector_id VARCHAR(100), -- External vendor connector ID
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(station_id, connector_number)
);

-- Bookings Table
-- Stores booking records for charging slots
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES charging_stations(id) ON DELETE CASCADE,
    connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    start_ts TIMESTAMP WITH TIME ZONE NOT NULL,
    end_ts TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED', 'ACTIVE')),
    hold_token VARCHAR(100) UNIQUE, -- Token from hold creation
    payment_id VARCHAR(100), -- Reference to payment transaction
    payment_status VARCHAR(20) DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'AUTHORIZED', 'CAPTURED', 'REFUNDED', 'FAILED')),
    vendor_booking_id VARCHAR(100), -- External vendor booking ID
    vendor_sync_status VARCHAR(20) DEFAULT 'PENDING' CHECK (vendor_sync_status IN ('PENDING', 'SYNCED', 'FAILED', 'ACKED')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure no overlapping bookings on same connector
    EXCLUDE USING GIST (connector_id WITH =, tsrange(start_ts, end_ts) WITH &&)
);

-- Charging Sessions Table
-- Tracks actual charging sessions with meter readings
CREATE TABLE IF NOT EXISTS charging_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES charging_stations(id) ON DELETE CASCADE,
    connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    energy_kwh DECIMAL(10, 3) DEFAULT 0,
    start_meter_reading DECIMAL(10, 3),
    end_meter_reading DECIMAL(10, 3),
    duration_minutes INTEGER,
    cost_amount DECIMAL(10, 2) DEFAULT 0,
    cost_currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'STARTING' CHECK (status IN ('STARTING', 'CHARGING', 'STOPPING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    vendor_session_id VARCHAR(100),
    meter_data JSONB DEFAULT '{}'::jsonb, -- Raw meter readings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_connectors_station_id ON connectors(station_id);
CREATE INDEX IF NOT EXISTS idx_connectors_status ON connectors(status);
CREATE INDEX IF NOT EXISTS idx_connectors_vendor_id ON connectors(vendor_connector_id);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_station_id ON bookings(station_id);
CREATE INDEX IF NOT EXISTS idx_bookings_connector_id ON bookings(connector_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_hold_token ON bookings(hold_token);
CREATE INDEX IF NOT EXISTS idx_bookings_time_range ON bookings USING GIST (tsrange(start_ts, end_ts));
CREATE INDEX IF NOT EXISTS idx_bookings_connector_time ON bookings(connector_id, start_ts, end_ts);

CREATE INDEX IF NOT EXISTS idx_sessions_booking_id ON charging_sessions(booking_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON charging_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_station_id ON charging_sessions(station_id);
CREATE INDEX IF NOT EXISTS idx_sessions_connector_id ON charging_sessions(connector_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON charging_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON charging_sessions(started_at);

-- Create updated_at triggers
CREATE TRIGGER update_connectors_updated_at
    BEFORE UPDATE ON connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON charging_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE connectors IS 'Individual charging connectors at stations';
COMMENT ON TABLE bookings IS 'Charging slot bookings with time windows';
COMMENT ON TABLE charging_sessions IS 'Actual charging sessions with energy and billing data';
COMMENT ON COLUMN bookings.hold_token IS 'Temporary token from Redis hold creation';
COMMENT ON COLUMN bookings.vendor_sync_status IS 'Status of sync with external vendor system';
COMMENT ON COLUMN charging_sessions.energy_kwh IS 'Total energy consumed in kWh';

