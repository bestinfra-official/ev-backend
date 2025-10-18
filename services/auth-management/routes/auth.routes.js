/**
 * Main Auth Routes
 * Aggregates all authentication-related routes
 */

import express from "express";
import otpRoutes from "./otp.routes.js";

const router = express.Router();

// Mount OTP routes
router.use("/otp", otpRoutes);

export default router;
