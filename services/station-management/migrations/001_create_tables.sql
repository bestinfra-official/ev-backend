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
    certified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reg_number VARCHAR(20) UNIQUE NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
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

COMMENT ON COLUMN vehicles.user_id IS 'References users(id) - BIGINT type for consistency across services';
COMMENT ON COLUMN vehicles.id IS 'Primary key - UUID type for compatibility with paired_devices.vehicle_id';

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
ON CONFLICT DO NOTHING;

-- Local seed coordinates
INSERT INTO charging_stations (name, latitude, longitude, power_kw, plugs, availability_status, operator_name, address, city, state, pricing_info, amenities) VALUES
('Local Seed 1', 13.6857125, 77.5851206, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 2', 13.36018016, 77.60944522, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 3', 13.70300002, 77.66869185, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 4', 14.04581988, 77.72793847, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 5', 14.38863975, 77.78718509, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 6', 14.73145961, 77.84643172, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 7', 15.07427947, 77.90567834, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 8', 15.41709933, 77.96492496, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 9', 15.75991919, 78.02417158, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 10', 16.10273905, 78.08341821, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 11', 16.44555892, 78.14266483, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 12', 16.78837878, 78.20191145, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 13', 17.13119864, 78.26115808, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 14', 16.7607942, 77.53558673, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 15', 14.00708788, 76.92233153, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 16', 16.04482331, 79.9838329, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 17', 14.94708764, 77.0151815, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 18', 16.22939084, 77.50654699, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 19', 15.58644719, 77.30908306, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 20', 15.33183214, 79.87475781, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 21', 15.77211395, 77.00197862, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 22', 15.52290883, 77.75341667, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 23', 16.60940632, 78.92885148, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 24', 15.59294071, 77.82233878, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 25', 15.2339596, 77.25588403, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 26', 13.09666382, 77.76184581, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 27', 14.50270553, 79.17453691, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 28', 14.59169924, 77.47778818, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 29', 16.6389507, 79.75486772, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 30', 13.65607716, 79.47310275, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 31', 15.28349585, 76.48541996, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 32', 15.17658055, 76.72511952, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 33', 14.20436308, 76.90739255, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 34', 13.5190174, 77.13080474, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 35', 16.85901491, 78.25803646, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 36', 14.57060753, 79.54131493, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 37', 16.84455398, 77.54921099, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 38', 14.94105163, 77.37737741, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 39', 15.49264995, 75.94461008, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 40', 14.10139617, 77.32014262, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 41', 16.3145464, 77.52928679, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 42', 15.15024347, 76.33609083, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 43', 14.73006198, 79.17507052, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 44', 14.5370483, 78.71021696, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 45', 13.54001074, 77.54443108, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 46', 16.55522982, 77.43303402, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 47', 14.30018252, 79.95061059, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 48', 15.82980588, 76.68843548, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 49', 14.74588132, 78.59536556, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 50', 14.19371973, 79.58202642, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 51', 16.54717125, 78.66286562, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 52', 14.59121802, 76.23279377, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 53', 14.52239446, 77.5619056, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 54', 14.84553531, 77.45001882, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 55', 13.88546813, 78.81632428, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 56', 16.02395258, 76.93204247, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 57', 15.24738516, 75.81020385, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 58', 15.43516117, 79.82711216, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 59', 14.22651225, 76.38582164, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 60', 15.51613301, 78.37157375, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 61', 14.47205988, 79.45353597, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 62', 16.78836243, 78.66960678, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 63', 13.24034229, 77.65239507, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 64', 13.6554112, 78.33823136, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 65', 15.14185227, 78.50478044, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 66', 14.62116179, 77.49891431, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 67', 15.27384873, 77.41686249, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 68', 16.21568426, 77.42799273, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 69', 14.91306611, 79.78663787, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 70', 15.49589732, 78.62291122, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 71', 15.78202368, 78.8395976, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 72', 13.97045007, 78.05784291, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 73', 15.70652578, 75.67852527, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 74', 14.743412, 77.78936475, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 75', 16.85640517, 78.2500711, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 76', 17.21109083, 77.85975507, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 77', 14.37658452, 77.03562444, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 78', 14.17485825, 78.30083415, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 79', 13.94833917, 79.62223395, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 80', 15.71430524, 78.22382882, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 81', 13.68662565, 78.92284857, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 82', 14.60919961, 79.90873631, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 83', 13.5343534, 76.67933028, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 84', 15.62499422, 77.602208, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 85', 15.501707, 79.47517007, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 86', 15.11285346, 75.79352053, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 87', 14.00225994, 77.60946442, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 88', 16.14531034, 78.837352, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 89', 15.12777915, 76.08460356, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 90', 14.8538367, 77.3117727, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 91', 14.90076051, 79.52360195, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 92', 16.42685382, 76.65583973, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 93', 16.37246873, 76.01546475, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 94', 17.03920647, 77.27173371, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 95', 13.54589658, 76.61519984, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 96', 17.00589196, 77.59163146, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 97', 14.58262646, 78.8714863, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 98', 15.57381, 79.1729146, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 99', 13.42404234, 77.59177315, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 100', 14.30738855, 79.16139492, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 101', 14.1104978, 78.94987345, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 102', 15.81931688, 79.65794521, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 103', 14.5026585, 76.07558125, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 104', 16.49446801, 79.61904279, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 105', 16.63707624, 79.71286129, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 106', 15.90773043, 78.41498764, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 107', 15.09051715, 79.30787906, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 108', 17.22636717, 77.33387242, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 109', 14.59980248, 75.86749529, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 110', 13.97991499, 76.13853106, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 111', 14.14265341, 79.45854248, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 112', 13.41077883, 76.6882567, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 113', 15.63132322, 76.16873352, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 114', 16.26718592, 77.10792298, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 115', 16.50194363, 77.09305616, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 116', 16.31008726, 77.8200499, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 117', 16.81543489, 76.36330981, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 118', 16.96432433, 76.86953305, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 119', 14.69092056, 77.47451722, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 120', 16.74357937, 78.17928967, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 121', 15.99513763, 76.6472, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 122', 13.5575094, 77.94360583, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 123', 15.49159623, 76.45086567, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 124', 15.6503212, 79.68470274, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 125', 14.00101444, 78.93086197, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 126', 14.89934334, 79.74679024, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 127', 14.85048497, 80.19457008, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 128', 14.33614206, 76.95283025, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 129', 15.79815662, 79.10142121, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 130', 15.29118342, 76.11338412, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]'),
('Local Seed 131', 17.49737823, 77.94417354, 0.0, '[]', 'available', 'LocalSeed', NULL, NULL, NULL, '{}', '[]')
ON CONFLICT DO NOTHING;

-- Vary non-coordinate fields for Local Seed rows to avoid identical data
-- Use the index from the name 'Local Seed N' to diversify values
-- Power ratings
UPDATE charging_stations
SET power_kw = CASE (split_part(name, ' ', 3)::int % 5)
    WHEN 0 THEN 7.4
    WHEN 1 THEN 22.0
    WHEN 2 THEN 50.0
    WHEN 3 THEN 120.0
    ELSE 150.0
END
WHERE operator_name = 'LocalSeed' AND name LIKE 'Local Seed %';

-- Plugs
UPDATE charging_stations
SET plugs = CASE (split_part(name, ' ', 3)::int % 5)
    WHEN 0 THEN '["CCS"]'::jsonb
    WHEN 1 THEN '["Type2"]'::jsonb
    WHEN 2 THEN '["CCS", "Type2"]'::jsonb
    WHEN 3 THEN '["CHAdeMO"]'::jsonb
    ELSE '["CCS", "CHAdeMO"]'::jsonb
END
WHERE operator_name = 'LocalSeed' AND name LIKE 'Local Seed %';

-- Availability status
UPDATE charging_stations
SET availability_status = CASE (split_part(name, ' ', 3)::int % 5)
    WHEN 0 THEN 'available'
    WHEN 1 THEN 'occupied'
    WHEN 2 THEN 'maintenance'
    WHEN 3 THEN 'available'
    ELSE 'offline'
END
WHERE operator_name = 'LocalSeed' AND name LIKE 'Local Seed %';

-- Operators
UPDATE charging_stations
SET operator_name = CASE (split_part(name, ' ', 3)::int % 5)
    WHEN 0 THEN 'ChargePoint'
    WHEN 1 THEN 'ElectrifyIndia'
    WHEN 2 THEN 'Tata Power'
    WHEN 3 THEN 'EVgo'
    ELSE 'BluSmart'
END
WHERE name LIKE 'Local Seed %' AND operator_name = 'LocalSeed';

-- Address
UPDATE charging_stations
SET address = 'Seed Location ' || split_part(name, ' ', 3)
WHERE name LIKE 'Local Seed %';

-- City and State
UPDATE charging_stations
SET city = CASE (split_part(name, ' ', 3)::int % 8)
        WHEN 0 THEN 'Bengaluru'
        WHEN 1 THEN 'Hyderabad'
        WHEN 2 THEN 'Anantapur'
        WHEN 3 THEN 'Kurnool'
        WHEN 4 THEN 'Nellore'
        WHEN 5 THEN 'Kadapa'
        WHEN 6 THEN 'Chittoor'
        ELSE 'Vijayawada'
    END,
    state = CASE (split_part(name, ' ', 3)::int % 8)
        WHEN 0 THEN 'Karnataka'
        WHEN 1 THEN 'Telangana'
        WHEN 2 THEN 'Andhra Pradesh'
        WHEN 3 THEN 'Andhra Pradesh'
        WHEN 4 THEN 'Andhra Pradesh'
        WHEN 5 THEN 'Andhra Pradesh'
        WHEN 6 THEN 'Andhra Pradesh'
        ELSE 'Andhra Pradesh'
    END
WHERE name LIKE 'Local Seed %';

-- Pricing
UPDATE charging_stations
SET pricing_info = jsonb_build_object(
        'per_kwh',
        CASE (split_part(name, ' ', 3)::int % 6)
            WHEN 0 THEN 0.20
            WHEN 1 THEN 0.22
            WHEN 2 THEN 0.24
            WHEN 3 THEN 0.26
            WHEN 4 THEN 0.28
            ELSE 0.30
        END,
        'session_fee',
        CASE (split_part(name, ' ', 3)::int % 5)
            WHEN 0 THEN 0.50
            WHEN 1 THEN 0.75
            WHEN 2 THEN 1.00
            WHEN 3 THEN 1.25
            ELSE 1.50
        END
    )
WHERE name LIKE 'Local Seed %';

-- Amenities
UPDATE charging_stations
SET amenities = CASE (split_part(name, ' ', 3)::int % 6)
    WHEN 0 THEN '["restrooms"]'::jsonb
    WHEN 1 THEN '["restrooms", "wifi"]'::jsonb
    WHEN 2 THEN '["restrooms", "food"]'::jsonb
    WHEN 3 THEN '["restrooms", "parking"]'::jsonb
    WHEN 4 THEN '["restrooms", "wifi", "food"]'::jsonb
    ELSE '["restrooms", "wifi", "food", "lounge"]'::jsonb
END
WHERE name LIKE 'Local Seed %';

INSERT INTO vehicles (reg_number, user_id, battery_capacity_kwh, efficiency_kwh_per_km, efficiency_factor, reserve_km, vehicle_type, make, model, year) VALUES
('ABC123', NULL, 75.0, 0.15, 0.88, 7.0, 'sedan', 'Tesla', 'Model 3', 2023)
ON CONFLICT (reg_number) DO NOTHING;

INSERT INTO charging_stations (name, latitude, longitude, power_kw, plugs, availability_status, operator_name, address, city, state, pricing_info, amenities) VALUES
('Bengaluru Station 1', 13.0200, 77.5530, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 1', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 2', 13.0145, 77.5575, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 2', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 3', 13.0080, 77.5445, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 3', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 4', 13.0250, 77.5470, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 4', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 5', 12.9980, 77.5515, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 5', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 6', 13.0320, 77.5605, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 6', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 7', 13.0225, 77.5410, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 7', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 8', 13.0060, 77.5350, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 8', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 9', 13.0350, 77.5380, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 9', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 10', 12.9850, 77.5480, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 10', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 11', 13.0280, 77.5635, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 11', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]'),
('Bengaluru Station 12', 13.0390, 77.5490, 150.0, '["CCS", "CHAdeMO", "Tesla"]', 'available', 'ChargePoint', 'Area 12', 'Bengaluru', 'Karnataka', '{"per_kwh": 0.25, "session_fee": 1.00}', '["restrooms", "food", "wifi"]')
ON CONFLICT DO NOTHING;



INSERT INTO charging_stations
(name, latitude, longitude, power_kw, plugs, availability_status, operator_name, address, city, state, pricing_info, amenities)
VALUES
('Hyderabad Station 1', 17.38700728, 78.25607240, 7.4, '["CCS"]', 'available', 'ChargePoint', 'Zone 1, Hyderabad', 'Hyderabad', 'Telangana', '{"per_kwh": 0.22, "session_fee": 0.50}', '["restrooms"]'),
('Hyderabad Station 2', 17.42698831, 78.24503447, 22.0, '["Type2"]', 'occupied', 'ElectrifyIndia', 'Zone 2, Secunderabad', 'Secunderabad', 'Telangana', '{"per_kwh": 0.24, "session_fee": 0.75}', '["restrooms", "wifi"]'),
('Hyderabad Station 3', 17.59162180, 78.31035014, 50.0, '["CCS","Type2"]', 'maintenance', 'Tata Power', 'Zone 3, Gachibowli', 'Hyderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms", "food"]'),
('Hyderabad Station 4', 17.41943005, 78.35290752, 120.0, '["CHAdeMO"]', 'available', 'EVgo', 'Zone 4, Madhapur', 'Hyderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms", "parking"]'),
('Hyderabad Station 5', 17.51129701, 78.44969320, 150.0, '["CCS","CHAdeMO"]', 'offline', 'BluSmart', 'Zone 5, Kondapur', 'Hyderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms", "wifi", "food"]'),
('Hyderabad Station 6', 17.31540307, 78.45821163, 7.4, '["CCS"]', 'available', 'ChargePoint', 'Zone 6, Jubilee Hills', 'Hyderabad', 'Telangana', '{"per_kwh": 0.22, "session_fee": 0.50}', '["restrooms", "wifi", "food", "lounge"]'),
('Hyderabad Station 7', 17.38983166, 78.27612073, 22.0, '["Type2"]', 'occupied', 'ElectrifyIndia', 'Zone 7, Banjara Hills', 'Hyderabad', 'Telangana', '{"per_kwh": 0.24, "session_fee": 0.75}', '["restrooms"]'),
('Hyderabad Station 8', 17.38401787, 78.26093508, 50.0, '["CCS","Type2"]', 'maintenance', 'Tata Power', 'Zone 8, HITEC City', 'Hyderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms", "wifi"]'),
('Hyderabad Station 9', 17.37677388, 78.39014885, 120.0, '["CHAdeMO"]', 'available', 'EVgo', 'Zone 9, Begumpet', 'Secunderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms", "food"]'),
('Hyderabad Station 10', 17.37625424, 78.49728558, 150.0, '["CCS","CHAdeMO"]', 'offline', 'BluSmart', 'Zone 10, Uppal', 'Hyderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms", "parking"]'),
('Hyderabad Station 11', 17.43181291, 78.36557689, 7.4, '["CCS"]', 'available', 'ChargePoint', 'Zone 11, Tarnaka', 'Secunderabad', 'Telangana', '{"per_kwh": 0.22, "session_fee": 0.50}', '["restrooms", "wifi", "food"]'),
('Hyderabad Station 12', 17.60408542, 78.36141739, 22.0, '["Type2"]', 'occupied', 'ElectrifyIndia', 'Zone 12, Kompally', 'Hyderabad', 'Telangana', '{"per_kwh": 0.24, "session_fee": 0.75}', '["restrooms", "wifi", "food", "lounge"]'),
('Hyderabad Station 13', 17.45102795, 78.43933347, 50.0, '["CCS","Type2"]', 'maintenance', 'Tata Power', 'Zone 13, Malkajgiri', 'Secunderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms"]'),
('Hyderabad Station 14', 17.53436492, 78.37058078, 120.0, '["CHAdeMO"]', 'available', 'EVgo', 'Zone 14, Alwal', 'Secunderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms", "wifi"]'),
('Hyderabad Station 15', 17.33261821, 78.35027134, 150.0, '["CCS","CHAdeMO"]', 'offline', 'BluSmart', 'Zone 15, Mehdipatnam', 'Hyderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms", "food"]'),
('Hyderabad Station 16', 17.38417763, 78.39681323, 7.4, '["CCS"]', 'available', 'ChargePoint', 'Zone 16, KPHB', 'Hyderabad', 'Telangana', '{"per_kwh": 0.22, "session_fee": 0.50}', '["restrooms", "parking"]'),
('Hyderabad Station 17', 17.46742073, 78.41032986, 22.0, '["Type2"]', 'occupied', 'ElectrifyIndia', 'Zone 17, Miyapur', 'Hyderabad', 'Telangana', '{"per_kwh": 0.24, "session_fee": 0.75}', '["restrooms", "wifi", "food"]'),
('Hyderabad Station 18', 17.46725008, 78.25687565, 50.0, '["CCS","Type2"]', 'maintenance', 'Tata Power', 'Zone 18, Manikonda', 'Hyderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms", "wifi", "food", "lounge"]'),
('Hyderabad Station 19', 17.52794403, 78.45012053, 120.0, '["CHAdeMO"]', 'available', 'EVgo', 'Zone 19, Nizampet', 'Hyderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms"]'),
('Hyderabad Station 20', 17.40642964, 78.50878193, 150.0, '["CCS","CHAdeMO"]', 'offline', 'BluSmart', 'Zone 20, LB Nagar', 'Hyderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms", "wifi"]'),
('Hyderabad Station 21', 17.46414453, 78.24522919, 7.4, '["CCS"]', 'available', 'ChargePoint', 'Zone 21, Kukatpally', 'Hyderabad', 'Telangana', '{"per_kwh": 0.22, "session_fee": 0.50}', '["restrooms", "food"]'),
('Hyderabad Station 22', 17.56601819, 78.49067747, 22.0, '["Type2"]', 'occupied', 'ElectrifyIndia', 'Zone 22, ECIL', 'Secunderabad', 'Telangana', '{"per_kwh": 0.24, "session_fee": 0.75}', '["restrooms", "parking"]'),
('Hyderabad Station 23', 17.38700477, 78.21109963, 50.0, '["CCS","Type2"]', 'maintenance', 'Tata Power', 'Zone 23, Attapur', 'Hyderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms", "wifi", "food"]'),
('Hyderabad Station 24', 17.52525867, 78.53731291, 120.0, '["CHAdeMO"]', 'available', 'EVgo', 'Zone 24, Medchal', 'Hyderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms", "wifi", "food", "lounge"]'),
('Hyderabad Station 25', 17.45776911, 78.48826952, 150.0, '["CCS","CHAdeMO"]', 'offline', 'BluSmart', 'Zone 25, Bowenpally', 'Secunderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms"]'),
('Hyderabad Station 26', 17.49079770, 78.19993769, 7.4, '["CCS"]', 'available', 'ChargePoint', 'Zone 26, Rajendranagar', 'Hyderabad', 'Telangana', '{"per_kwh": 0.22, "session_fee": 0.50}', '["restrooms", "wifi"]'),
('Hyderabad Station 27', 17.34894313, 78.34760858, 22.0, '["Type2"]', 'occupied', 'ElectrifyIndia', 'Zone 27, TSPA Junction', 'Hyderabad', 'Telangana', '{"per_kwh": 0.24, "session_fee": 0.75}', '["restrooms", "food"]'),
('Hyderabad Station 28', 17.46100626, 78.40031247, 50.0, '["CCS","Type2"]', 'maintenance', 'Tata Power', 'Zone 28, Chandanagar', 'Hyderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms", "parking"]'),
('Hyderabad Station 29', 17.33727427, 78.42651090, 120.0, '["CHAdeMO"]', 'available', 'EVgo', 'Zone 29, Vanasthalipuram', 'Hyderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms", "wifi", "food"]'),
('Hyderabad Station 30', 17.39241485, 78.26054051, 150.0, '["CCS","CHAdeMO"]', 'offline', 'BluSmart', 'Zone 30, Masab Tank', 'Hyderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms", "wifi", "food", "lounge"]'),
('Hyderabad Station 31', 17.40104109, 78.34614920, 7.4, '["CCS"]', 'available', 'ChargePoint', 'Zone 31, Lakdikapul', 'Hyderabad', 'Telangana', '{"per_kwh": 0.22, "session_fee": 0.50}', '["restrooms"]'),
('Hyderabad Station 32', 17.32236322, 78.40232158, 22.0, '["Type2"]', 'occupied', 'ElectrifyIndia', 'Zone 32, Dilshuknagar', 'Hyderabad', 'Telangana', '{"per_kwh": 0.24, "session_fee": 0.75}', '["restrooms", "wifi"]'),
('Hyderabad Station 33', 17.41183909, 78.46352007, 50.0, '["CCS","Type2"]', 'maintenance', 'Tata Power', 'Zone 33, Nacharam', 'Secunderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms", "food"]'),
('Hyderabad Station 34', 17.53048454, 78.44204952, 120.0, '["CHAdeMO"]', 'available', 'EVgo', 'Zone 34, Jeedimetla', 'Hyderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms", "parking"]'),
('Hyderabad Station 35', 17.60077156, 78.42053711, 150.0, '["CCS","CHAdeMO"]', 'offline', 'BluSmart', 'Zone 35, Shamirpet', 'Hyderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms", "wifi", "food"]'),
('Hyderabad Station 36', 17.31128574, 78.33602657, 7.4, '["CCS"]', 'available', 'ChargePoint', 'Zone 36, Falaknuma', 'Hyderabad', 'Telangana', '{"per_kwh": 0.22, "session_fee": 0.50}', '["restrooms", "wifi", "food", "lounge"]'),
('Hyderabad Station 37', 17.46853420, 78.44695384, 22.0, '["Type2"]', 'occupied', 'ElectrifyIndia', 'Zone 37, Suchitra', 'Hyderabad', 'Telangana', '{"per_kwh": 0.24, "session_fee": 0.75}', '["restrooms"]'),
('Hyderabad Station 38', 17.50903082, 78.36574944, 50.0, '["CCS","Type2"]', 'maintenance', 'Tata Power', 'Zone 38, Ameerpet', 'Hyderabad', 'Telangana', '{"per_kwh": 0.26, "session_fee": 1.00}', '["restrooms", "wifi"]'),
('Hyderabad Station 39', 17.55019104, 78.24757311, 120.0, '["CHAdeMO"]', 'available', 'EVgo', 'Zone 39, Koti', 'Hyderabad', 'Telangana', '{"per_kwh": 0.28, "session_fee": 1.25}', '["restrooms", "food"]'),
('Hyderabad Station 40', 17.29851542, 78.34362307, 150.0, '["CCS","CHAdeMO"]', 'offline', 'BluSmart', 'Zone 40, Barkas', 'Hyderabad', 'Telangana', '{"per_kwh": 0.30, "session_fee": 1.50}', '["restrooms", "parking"]');

-- ALTER TABLE query to add certified column to existing charging_stations table
ALTER TABLE charging_stations
ADD COLUMN IF NOT EXISTS certified BOOLEAN DEFAULT false;

-- Query to randomly assign certified status (true/false) to all existing charging stations
-- This uses PostgreSQL's random() function to generate approximately 50/50 distribution
UPDATE charging_stations
SET certified = (random() < 0.5);
