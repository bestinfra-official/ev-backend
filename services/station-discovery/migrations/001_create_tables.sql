-- Station Discovery Database Schema
-- Creates tables for charging stations and vehicles

-- Enable PostGIS extension for geospatial operations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Charging Stations Table
CREATE TABLE IF NOT EXISTS charging_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    power_kw DECIMAL(8, 2) NOT NULL DEFAULT 0,
    plugs JSONB DEFAULT '[]'::jsonb,
    availability_status VARCHAR(20) DEFAULT 'available' CHECK (availability_status IN ('available', 'occupied', 'maintenance', 'offline')),
    operator_name VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pricing_info JSONB DEFAULT '{}'::jsonb,
    amenities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reg_number VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID,
    battery_capacity_kwh DECIMAL(8, 2) NOT NULL,
    efficiency_kwh_per_km DECIMAL(8, 4) NOT NULL,
    efficiency_factor DECIMAL(3, 2) DEFAULT 0.88 CHECK (efficiency_factor > 0 AND efficiency_factor <= 1),
    reserve_km DECIMAL(5, 2) DEFAULT 7 CHECK (reserve_km >= 0),
    vehicle_type VARCHAR(50),
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_charging_stations_location ON charging_stations USING GIST (
    ST_GeogFromText('POINT(' || longitude || ' ' || latitude || ')')
);

CREATE INDEX IF NOT EXISTS idx_charging_stations_availability ON charging_stations (availability_status);

CREATE INDEX IF NOT EXISTS idx_charging_stations_operator ON charging_stations (operator_name);

CREATE INDEX IF NOT EXISTS idx_vehicles_reg_number ON vehicles (reg_number);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles (user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_charging_stations_updated_at
    BEFORE UPDATE ON charging_stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at
    BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO charging_stations (name, latitude, longitude, power_kw, plugs, availability_status, operator_name, address, city, state, pricing_info, amenities) VALUES
('Hyderabad Central Station', 17.4740185, 78.3204047, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Central Station Area', 'Hyderabad', 'Telangana', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Secunderabad Charging Hub', 17.2878076, 78.2913031, 120.0, '["CCS", "CHAdeMO"]', 'available', 'EVgo', 'Secunderabad Main Road', 'Secunderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 0.50}', '["restrooms", "food"]'),
('Cyber City Station', 17.1021621, 78.2589303, 200.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'Electrify America', 'Cyber City Complex', 'Hyderabad', 'Telangana', '{"per_kwh": 0.35, "session_fee": 2.00}', '["restrooms", "food", "wifi", "parking"]'),
('Gachibowli Charging Point', 16.9190820, 78.2209938, 75.0, '["CCS", "Tesla"]', 'occupied', 'Tesla', 'Gachibowli IT Park', 'Hyderabad', 'Telangana', '{"per_kwh": 0.20}', '["shopping", "food"]'),
('HITEC City Station', 16.7329958, 78.1851111, 100.0, '["CCS", "CHAdeMO"]', 'available', 'ChargePoint', 'HITEC City', 'Hyderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.50}', '["restrooms", "food", "wifi"]'),
('Kondapur Charging Hub', 16.5535984, 78.1429009, 80.0, '["CCS", "CHAdeMO"]', 'available', 'EVgo', 'Kondapur Main Road', 'Hyderabad', 'Telangana', '{"per_kwh": 0.32, "session_fee": 1.00}', '["restrooms", "food"]'),
('Madhapur Station', 16.3644192, 78.1035639, 90.0, '["CCS", "Tesla"]', 'maintenance', 'Tesla', 'Madhapur IT Corridor', 'Hyderabad', 'Telangana', '{"per_kwh": 0.22}', '["wifi", "parking"]'),
('Serilingampally Charging', 16.1874432, 78.0548686, 60.0, '["CCS"]', 'available', 'Campus Energy', 'Serilingampally Area', 'Hyderabad', 'Telangana', '{"per_kwh": 0.18}', '["restrooms", "parking"]'),
('Rajendranagar Station', 16.0025089, 78.0188801, 70.0, '["CCS", "CHAdeMO"]', 'available', 'ChargePoint', 'Rajendranagar', 'Hyderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 0.75}', '["restrooms", "food"]'),
('Shamshabad Charging Hub', 15.8207115, 77.9779258, 180.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'Electrify America', 'Shamshabad Airport Road', 'Hyderabad', 'Telangana', '{"per_kwh": 0.40, "session_fee": 2.50}', '["restrooms", "food", "wifi", "parking"]'),
('Pahadishareef Station', 15.6459602, 77.9368206, 50.0, '["CCS"]', 'available', 'EVgo', 'Pahadishareef Area', 'Hyderabad', 'Telangana', '{"per_kwh": 0.24}', '["restrooms"]'),
('Ibrahimpatnam Charging', 15.4582974, 77.9044983, 65.0, '["CCS", "CHAdeMO"]', 'available', 'ChargePoint', 'Ibrahimpatnam', 'Hyderabad', 'Telangana', '{"per_kwh": 0.27, "session_fee": 1.25}', '["restrooms", "food"]'),
('Vikarabad Station', 15.2855795, 77.8689995, 55.0, '["CCS"]', 'available', 'Campus Energy', 'Vikarabad Town', 'Vikarabad', 'Telangana', '{"per_kwh": 0.20}', '["restrooms", "parking"]'),
('Tandur Charging Point', 15.1086020, 77.8328468, 45.0, '["CCS", "CHAdeMO"]', 'available', 'EVgo', 'Tandur Main Road', 'Tandur', 'Telangana', '{"per_kwh": 0.23}', '["restrooms"]'),
('Bidar Highway Station', 14.9278577, 77.8018288, 110.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'Electrify America', 'Bidar Highway', 'Bidar', 'Karnataka', '{"per_kwh": 0.33, "session_fee": 1.75}', '["restrooms", "food", "wifi"]'),
('Bidar City Charging', 14.7538306, 77.7654342, 85.0, '["CCS", "CHAdeMO"]', 'available', 'ChargePoint', 'Bidar City Center', 'Bidar', 'Karnataka', '{"per_kwh": 0.29, "session_fee": 1.00}', '["restrooms", "food"]'),
('Basavakalyan Station', 14.5735729, 77.7351524, 40.0, '["CCS"]', 'occupied', 'Tesla', 'Basavakalyan Town', 'Basavakalyan', 'Karnataka', '{"per_kwh": 0.21}', '["parking"]'),
('Humnabad Charging Hub', 14.3922541, 77.7037909, 60.0, '["CCS", "CHAdeMO"]', 'available', 'EVgo', 'Humnabad Area', 'Humnabad', 'Karnataka', '{"per_kwh": 0.25}', '["restrooms"]'),
('Gulbarga Station', 14.2172385, 77.6724501, 95.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'Electrify America', 'Gulbarga City', 'Gulbarga', 'Karnataka', '{"per_kwh": 0.31, "session_fee": 1.50}', '["restrooms", "food", "wifi"]'),
('Sedam Charging Point', 14.0368807, 77.6415039, 35.0, '["CCS"]', 'maintenance', 'Campus Energy', 'Sedam Town', 'Sedam', 'Karnataka', '{"per_kwh": 0.19}', '["parking"]'),
('Chitapur Station', 13.8595773, 77.6139776, 50.0, '["CCS", "CHAdeMO"]', 'available', 'ChargePoint', 'Chitapur Area', 'Chitapur', 'Karnataka', '{"per_kwh": 0.24}', '["restrooms"]'),
('Yadgir Charging Hub', 13.6857125, 77.5851206, 70.0, '["CCS", "CHAdeMO"]', 'available', 'EVgo', 'Yadgir City', 'Yadgir', 'Karnataka', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms", "food"]'),
('Raichur Station', 13.3884160, 77.6163064, 80.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'Electrify America', 'Raichur City', 'Raichur', 'Karnataka', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms", "food", "wifi"]'),
('Manvi Charging Point', 13.2026796, 77.5844595, 45.0, '["CCS"]', 'available', 'Tesla', 'Manvi Town', 'Manvi', 'Karnataka', '{"per_kwh": 0.22}', '["parking"]'),
('Bellary Station', 13.0173603, 77.5501986, 100.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Bellary City Center', 'Bellary', 'Karnataka', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms", "food", "wifi", "parking"]')
ON CONFLICT DO NOTHING;

INSERT INTO vehicles (reg_number, user_id, battery_capacity_kwh, efficiency_kwh_per_km, efficiency_factor, reserve_km, vehicle_type, make, model, year) VALUES
('ABC123', gen_random_uuid(), 75.0, 0.15, 0.88, 7.0, 'sedan', 'Tesla', 'Model 3', 2023)
ON CONFLICT (reg_number) DO NOTHING;
