/**
 * Station Discovery Models Index
 * Centralized model exports for scalability and maintainability
 */

// Import all models
import { Station } from "./station.model.js";
import { Vehicle } from "./vehicle.model.js";
import { Connector } from "./connector.model.js";
import { Booking } from "./booking.model.js";
import { Session } from "./session.model.js";

// Export models with clear naming
export { Station, Vehicle, Connector, Booking, Session };

// Export default object for convenience
export default {
    Station,
    Vehicle,
    Connector,
    Booking,
    Session,
};
