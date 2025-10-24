/**
 * Station Discovery Models Index
 * Centralized model exports for scalability and maintainability
 */

// Import all models
import { Station } from "./station.model.js";
import { Vehicle } from "./vehicle.model.js";

// Export models with clear naming
export { Station, Vehicle };

// Export default object for convenience
export default {
    Station,
    Vehicle,
};

// Future models can be added here:
// import { Booking } from "./booking.model.js";
// import { Session } from "./session.model.js";
// export { Booking, Session };
