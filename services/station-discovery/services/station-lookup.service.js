/**
 * Station Lookup Service
 * High-performance station discovery with caching and range calculation
 */

import { redis } from "@ev-platform/shared";
import { createLogger } from "@ev-platform/shared";
import { Station, Vehicle } from "../models/index.js";
import redisGeoService from "./redis-geo.service.js";

const logger = createLogger("station-discovery");

class StationLookupService {
    constructor() {
        this.redisClient = null;
        this.VEHICLE_CACHE_KEY_PREFIX = "vehicle:";
        this.STATION_CACHE_KEY_PREFIX = "stations:near:";
        this.ZONE_CACHE_KEY_PREFIX = "stations:zone:";
        this.CACHE_TTL = {
            VEHICLE: 300, // 5 minutes
            STATION: 600, // 10 minutes
            ZONE: 900, // 15 minutes
        };

        // Charging strategy configuration
        this.CHARGING_STRATEGY = {
            SAFETY_BUFFER_PERCENTAGE: 0.18, // 18% safety buffer
            OPTIMAL_ZONE_START_PERCENTAGE: 0.69, // Start optimal zone at 69% of range
            OPTIMAL_ZONE_END_PERCENTAGE: 0.88, // End optimal zone at 88% of range
            PRIORITY_ZONE_START_PERCENTAGE: 0.75, // Pet priority zone at 75% of range
            PRIORITY_ZONE_END_PERCENTAGE: 0.81, // End priority zone at 81% of range
        };
    }

    /**
     * Get Redis client (lazy initialization)
     * @private
     */
    _getClient() {
        if (!this.redisClient) {
            this.redisClient = redis.getClient();
        }
        return this.redisClient;
    }

    /**
     * Compute usable range for a vehicle with dynamic battery percentage
     * @param {object} vehicle - Vehicle data
     * @param {number} batteryPercentage - Current battery percentage (0-100)
     * @returns {number} Usable range in kilometers
     */
    computeUsableRange(vehicle, batteryPercentage) {
        logger.debug({ vehicle, batteryPercentage }, "Computing usable range");
        const {
            battery_capacity_kwh = 0,
            efficiency_kwh_per_km = 0,
            efficiency_factor = 7.4,
            reserve_km = 7,
        } = vehicle;

        // Calculate available energy using dynamic battery percentage
        const availableEnergy =
            (batteryPercentage / 100) * battery_capacity_kwh;

        // Calculate theoretical range
        const theoreticalRange = availableEnergy * efficiency_kwh_per_km;

        // Apply efficiency factor and reserve
        const usableRange = theoreticalRange * efficiency_factor - reserve_km;

        // Ensure non-negative result
        return Math.max(0, usableRange);
    }

    /**
     * Compute optimal charging strategy with zone-based recommendations
     * @param {number} usableRangeKm - Total usable range in kilometers
     * @param {number} batteryPercentage - Current battery percentage (0-100)
     * @returns {object} Charging strategy with zones and recommendations
     */
    computeOptimalChargingStrategy(usableRangeKm, batteryPercentage) {
        const strategy = this.CHARGING_STRATEGY;

        // Calculate zone boundaries based on usable range
        const safetyBuffer = usableRangeKm * strategy.SAFETY_BUFFER_PERCENTAGE;
        const maxReachableDistance = usableRangeKm - safetyBuffer;

        const optimalZoneStart =
            usableRangeKm * strategy.OPTIMAL_ZONE_START_PERCENTAGE;
        const optimalZoneEnd =
            usableRangeKm * strategy.OPTIMAL_ZONE_END_PERCENTAGE;

        const priorityZoneStart =
            usableRangeKm * strategy.PRIORITY_ZONE_START_PERCENTAGE;
        const priorityZoneEnd =
            usableRangeKm * strategy.PRIORITY_ZONE_END_PERCENTAGE;

        // Determine charging urgency based on battery percentage
        let urgency = "low";
        let shouldCharge = false;
        let recommendedDistance = null;

        if (batteryPercentage <= 20) {
            urgency = "critical";
            shouldCharge = true;
            recommendedDistance = "0-15km";
        } else if (batteryPercentage <= 35) {
            urgency = "high";
            shouldCharge = true;
            recommendedDistance = "15-30km";
        } else if (batteryPercentage <= 50) {
            urgency = "medium";
            shouldCharge = true;
            recommendedDistance = `${Math.round(
                priorityZoneStart
            )}-${Math.round(priorityZoneEnd)}km`;
        } else if (batteryPercentage <= 70) {
            urgency = "low";
            shouldCharge = true;
            recommendedDistance = `${Math.round(optimalZoneStart)}-${Math.round(
                optimalZoneEnd
            )}km`;
        } else {
            urgency = "none";
            shouldCharge = false;
        }

        return {
            usableRangeKm,
            batteryPercentage,
            safetyBuffer,
            maxReachableDistance,
            zones: {
                tooEarly: {
                    start: 0,
                    end: optimalZoneStart,
                    description: "Too early to charge - continue driving",
                },
                optimal: {
                    start: optimalZoneStart,
                    end: optimalZoneEnd,
                    description: "Optimal charging zone - best time to charge",
                },
                priority: {
                    start: priorityZoneStart,
                    end: priorityZoneEnd,
                    description: "High priority charging zone - recommended",
                },
                tooLate: {
                    start: optimalZoneEnd,
                    end: usableRangeKm,
                    description: "Too late - may not reach safely",
                },
                unreachable: {
                    start: usableRangeKm,
                    end: usableRangeKm * 1.5,
                    description: "Emergency stations only",
                },
            },
            recommendations: {
                shouldCharge,
                urgency,
                recommendedDistance,
                optimalChargingDistance: `${Math.round(
                    optimalZoneStart
                )}-${Math.round(optimalZoneEnd)}km`,
                priorityChargingDistance: `${Math.round(
                    priorityZoneStart
                )}-${Math.round(priorityZoneEnd)}km`,
            },
        };
    }

    /**
     * Calculate wait time based on station availability
     * @param {number} availablePlugs - Number of available plugs
     * @param {number} totalPlugs - Total number of plugs
     * @returns {string} Wait time description
     */
    calculateWaitTime(availablePlugs, totalPlugs) {
        if (availablePlugs === 0) {
            return "Full";
        } else if (availablePlugs === 1) {
            return "1 plug left";
        } else if (availablePlugs >= totalPlugs * 0.5) {
            return "No wait";
        } else {
            return "5-10 min wait";
        }
    }

    /**
     * Calculate travel time to station
     * @param {number} distanceKm - Distance to station in km
     * @returns {string} Travel time estimate
     */
    calculateTravelTime(distanceKm) {
        // Assume average speed of 60 km/h in city, 80 km/h on highway
        const avgSpeed = distanceKm > 50 ? 80 : 60;
        const minutes = Math.round((distanceKm / avgSpeed) * 60);

        if (minutes < 1) {
            return "< 1 min";
        } else if (minutes < 60) {
            return `${minutes} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0
                ? `${hours}h ${remainingMinutes}m`
                : `${hours}h`;
        }
    }

    /**
     * Generate info window content for Google Maps
     * @param {object} station - Station data
     * @returns {string} HTML content for info window
     */
    generateInfoWindowContent(station) {
        const availablePlugs =
            station.plugs?.filter((plug) => plug.available).length || 0;
        const totalPlugs = station.plugs?.length || 0;
        const powerKw = station.powerKw || station.power_kw || 0;
        const pricing = station.pricing || station.pricing_info || {};
        const priceText = pricing.per_kwh
            ? `$${pricing.per_kwh}/kWh`
            : "Pricing varies";

        return `
            <div class="station-info">
                <h3>${station.name}</h3>
                <p><strong>Power:</strong> ${powerKw}kW</p>
                <p><strong>Availability:</strong> ${availablePlugs}/${totalPlugs} plugs</p>
                <p><strong>Price:</strong> ${priceText}</p>
                <p><strong>Operator:</strong> ${
                    station.operator || station.operator_name || "Unknown"
                }</p>
                <p><strong>Address:</strong> ${
                    station.address || "Address not available"
                }</p>
                ${
                    station.amenities && station.amenities.length > 0
                        ? `<p><strong>Amenities:</strong> ${station.amenities.join(
                              ", "
                          )}</p>`
                        : ""
                }
                <p><strong>Distance:</strong> ${(
                    station.distanceKm || station.distance_km
                ).toFixed(1)}km</p>
            </div>
        `;
    }

    /**
     * Generate route data for Google Maps
     * @param {object} userLocation - User location
     * @param {object} destination - Destination location
     * @param {Array} waypoints - Charging station waypoints
     * @returns {object} Route data with polyline
     */
    generateRouteData(userLocation, destination, waypoints = []) {
        // This would typically integrate with Google Directions API
        // For now, we'll return a mock structure
        const routePoints = [
            userLocation,
            ...waypoints.map((wp) => ({
                lat: wp.latitude || wp.lat,
                lng: wp.longitude || wp.lng,
            })),
            destination,
        ];

        return {
            polyline: this.encodePolyline(routePoints),
            totalDistance: this.calculateTotalDistance(routePoints),
            estimatedTime: this.estimateTravelTime(routePoints),
            waypoints: waypoints.map((wp) => ({
                position: {
                    lat: wp.latitude || wp.lat,
                    lng: wp.longitude || wp.lng,
                },
                type: "charging_stop",
                stationId: wp.id,
                stopTime: "30-45 minutes",
            })),
        };
    }

    /**
     * Simple polyline encoding (mock implementation)
     * In production, use Google's polyline encoding
     * @param {Array} points - Array of lat/lng points
     * @returns {string} Encoded polyline string
     */
    encodePolyline(points) {
        // Mock implementation - in production use proper polyline encoding
        return "mock_polyline_encoded_string";
    }

    /**
     * Calculate total distance for route
     * @param {Array} points - Route points
     * @returns {number} Total distance in km
     */
    calculateTotalDistance(points) {
        if (points.length < 2) return 0;

        let totalDistance = 0;
        for (let i = 0; i < points.length - 1; i++) {
            totalDistance += this.calculateHaversineDistance(
                points[i].lat,
                points[i].lng,
                points[i + 1].lat,
                points[i + 1].lng
            );
        }
        return totalDistance;
    }

    /**
     * Estimate travel time for route
     * @param {Array} points - Route points
     * @returns {string} Estimated travel time
     */
    estimateTravelTime(points) {
        const totalDistance = this.calculateTotalDistance(points);
        // Assume average speed of 60 km/h
        const hours = Math.floor(totalDistance / 60);
        const minutes = Math.round(((totalDistance % 60) * 60) / 60);

        if (hours === 0) {
            return `${minutes}m`;
        } else if (minutes === 0) {
            return `${hours}h`;
        } else {
            return `${hours}h ${minutes}m`;
        }
    }

    /**
     * Generate route-optimized response structure with battery-based recommendations
     * @param {object} routeResults - Route-based station results
     * @param {object} chargingStrategy - Charging strategy data
     * @param {object} userLocation - User location
     * @param {object} destination - Destination location
     * @param {number} usableRangeKm - Usable range in km
     * @param {number} batteryPercentage - Battery percentage
     * @param {number} totalRouteDistance - Total route distance
     * @returns {object} Route-optimized response with recommendations
     */
    generateRouteOptimizedResponse(
        routeResults,
        chargingStrategy,
        userLocation,
        destination,
        usableRangeKm,
        batteryPercentage,
        totalRouteDistance
    ) {
        // Get recommended stations based on battery percentage and route
        const recommendedStations = routeResults.allStations
            .filter((station) => station.isRecommended)
            .slice(0, 5); // Top 5 recommended stations

        // Generate route data
        const routeData = this.generateRouteData(
            userLocation,
            destination,
            recommendedStations
        );

        // Find next charging stop recommendation
        const nextChargingStop =
            recommendedStations.length > 0
                ? {
                      stationId: recommendedStations[0].id,
                      distance: recommendedStations[0].distanceKm,
                      estimatedArrival: this.estimateArrivalTime(
                          recommendedStations[0].distanceKm
                      ),
                      urgency: this.getChargingUrgency(
                          batteryPercentage,
                          recommendedStations[0].distanceKm
                      ),
                  }
                : null;

        // Calculate route safety
        const routeSafety = this.calculateRouteSafety(
            totalRouteDistance,
            usableRangeKm,
            batteryPercentage,
            recommendedStations.length
        );

        return {
            usableRangeKm,
            batteryPercentage,
            totalRouteDistance,
            totalFound: routeResults.totalFound,
            routeSafety,

            chargingStrategy: {
                optimalZone: {
                    start: chargingStrategy.zones.optimal.start,
                    end: chargingStrategy.zones.optimal.end,
                },
                priorityZone: {
                    start: chargingStrategy.zones.priority.start,
                    end: chargingStrategy.zones.priority.end,
                },
                safetyBuffer: chargingStrategy.safetyBuffer,
                maxReachableDistance: chargingStrategy.maxReachableDistance,
            },

            // Map data for visualization
            mapData: {
                userLocation: {
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    marker: {
                        type: "user",
                        icon: "user-marker.png",
                        title: "Your Location",
                        position: {
                            lat: userLocation.lat,
                            lng: userLocation.lng,
                        },
                    },
                },
                destination: destination
                    ? {
                          lat: destination.lat,
                          lng: destination.lng,
                          marker: {
                              type: "destination",
                              icon: "destination-marker.png",
                              title: "Destination",
                              position: {
                                  lat: destination.lat,
                                  lng: destination.lng,
                              },
                          },
                      }
                    : null,
                routePolyline: routeData.polyline,
            },

            // All stations along the route
            allStations: {
                totalCount: routeResults.totalFound,
                stations: routeResults.allStations.map((station) => ({
                    ...station,
                    latitude: station.latitude || station.lat,
                    longitude: station.longitude || station.lng,
                    isRecommended: station.isRecommended,
                })),
            },

            // Route and recommendations
            routeData: routeData,
            recommendations: {
                shouldCharge: chargingStrategy.recommendations.shouldCharge,
                recommendedDistance:
                    chargingStrategy.recommendations.recommendedDistance,
                urgency: chargingStrategy.recommendations.urgency,
                nextChargingStop: nextChargingStop,
                optimalChargingDistance:
                    chargingStrategy.recommendations.optimalChargingDistance,
                priorityChargingDistance:
                    chargingStrategy.recommendations.priorityChargingDistance,
                routeRecommendations: this.generateRouteRecommendations(
                    totalRouteDistance,
                    usableRangeKm,
                    batteryPercentage,
                    recommendedStations
                ),
            },
        };
    }

    /**
     * Estimate arrival time to station
     * @param {number} distanceKm - Distance to station in km
     * @returns {string} Estimated arrival time
     */
    estimateArrivalTime(distanceKm) {
        // Mock calculation - assume average speed of 60 km/h
        const minutes = Math.round((distanceKm / 60) * 60);
        return `${minutes} minutes`;
    }

    /**
     * Get charging urgency based on battery percentage and distance
     * @param {number} batteryPercentage - Current battery percentage
     * @param {number} distanceKm - Distance to station
     * @returns {string} Urgency level
     */
    getChargingUrgency(batteryPercentage, distanceKm) {
        if (batteryPercentage <= 20) {
            return distanceKm <= 15 ? "critical" : "urgent";
        } else if (batteryPercentage <= 35) {
            return distanceKm <= 30 ? "high" : "medium";
        } else if (batteryPercentage <= 50) {
            return distanceKm <= 50 ? "medium" : "low";
        } else {
            return "low";
        }
    }

    /**
     * Calculate route safety based on distance and battery
     * @param {number} totalRouteDistance - Total route distance
     * @param {number} usableRangeKm - Usable range
     * @param {number} batteryPercentage - Battery percentage
     * @param {number} recommendedStationsCount - Number of recommended stations
     * @returns {object} Route safety assessment
     */
    calculateRouteSafety(
        totalRouteDistance,
        usableRangeKm,
        batteryPercentage,
        recommendedStationsCount
    ) {
        const safetyRatio = usableRangeKm / totalRouteDistance;

        let safetyLevel = "safe";
        let message = "Route is safe with current battery level";

        if (safetyRatio < 1.2) {
            safetyLevel = "risky";
            message = "Route requires charging stops";
        } else if (safetyRatio < 1.5) {
            safetyLevel = "moderate";
            message = "Route is manageable with charging stops";
        }

        if (batteryPercentage <= 20 && recommendedStationsCount === 0) {
            safetyLevel = "critical";
            message =
                "Critical battery level - find charging station immediately";
        }

        return {
            level: safetyLevel,
            message,
            safetyRatio,
            requiresCharging: safetyRatio < 1.5,
            recommendedStationsAvailable: recommendedStationsCount > 0,
        };
    }

    /**
     * Generate route recommendations
     * @param {number} totalRouteDistance - Total route distance
     * @param {number} usableRangeKm - Usable range
     * @param {number} batteryPercentage - Battery percentage
     * @param {Array} recommendedStations - Recommended stations
     * @returns {object} Route recommendations
     */
    generateRouteRecommendations(
        totalRouteDistance,
        usableRangeKm,
        batteryPercentage,
        recommendedStations
    ) {
        const recommendations = {
            canReachDestination: totalRouteDistance <= usableRangeKm,
            chargingStopsNeeded:
                Math.ceil(totalRouteDistance / usableRangeKm) - 1,
            optimalChargingStops: [],
            routeStrategy: "",
        };

        if (recommendations.canReachDestination) {
            recommendations.routeStrategy =
                "You can reach your destination without charging";
        } else {
            recommendations.routeStrategy = `Plan ${recommendations.chargingStopsNeeded} charging stop(s) along your route`;

            // Suggest optimal charging stops based on route distance
            const stopDistance =
                totalRouteDistance / (recommendations.chargingStopsNeeded + 1);
            recommendations.optimalChargingStops = recommendedStations
                .filter((station) => station.distanceKm <= stopDistance * 1.2)
                .slice(0, recommendations.chargingStopsNeeded);
        }

        return recommendations;
    }

    /**
     * Format stations for mobile UI display (like the interface shown)
     * @param {object} zoneResults - Zone-based station results
     * @returns {Array} Formatted stations for mobile UI
     */
    formatStationsForMobileUI(zoneResults) {
        // Since we're no longer using zones, just return the allStations from zoneResults
        // The zoneResults now contains empty arrays, so we'll get stations from allStations
        const allStations = zoneResults.allStations || [];

        // Sort by distance from user location (closest first)
        allStations.sort(
            (a, b) =>
                (a.distanceFromUserLocation || a.distanceKm) -
                (b.distanceFromUserLocation || b.distanceKm)
        );

        // Format for mobile UI display
        return allStations.slice(0, 10).map((station, index) => {
            // Use the isRecommended flag from the station object
            const isRecommended = station.isRecommended || false;
            // Handle both formatted stations (with stationInfo) and raw stations
            const stationInfo = station.stationInfo || {
                name: station.name || "Unknown Station",
                chargingSpeed: station.powerKw >= 50 ? "Fast" : "Medium",
                chargingSpeedColor:
                    station.powerKw >= 50 ? "#4CAF50" : "#FFC107",
                distance: (
                    station.distanceFromUserLocation ||
                    station.distanceKm ||
                    station.distance_km ||
                    0
                ).toFixed(1),
                distanceUnit: "km",
                waitTime: this.calculateWaitTime(
                    station.plugs?.filter((p) => p.available).length || 0,
                    station.plugs?.length || 0
                ),
                travelTime: this.calculateTravelTime(
                    station.distanceKm || station.distance_km || 0
                ),
                price: `₹${
                    station.pricing?.per_kwh ||
                    station.pricing_info?.per_kwh ||
                    0
                }/kWh`,
                availability: `${
                    station.plugs?.filter((p) => p.available).length || 0
                }/${station.plugs?.length || 0} available`,
                fastChargers:
                    station.plugs?.filter((p) => p.power >= 50).length || 0,
                totalFastChargers:
                    station.plugs?.filter((p) => p.power >= 50).length || 0,
                operator:
                    station.operator || station.operator_name || "Unknown",
                address: station.address || "Address not available",
                amenities: station.amenities || [],
                rating: station.rating || 4.0,
                reviews: station.review_count || 0,
            };

            const position = station.position || {
                lat: station.latitude || station.lat,
                lng: station.longitude || station.lng,
            };

            return {
                id: station.id,
                name: stationInfo.name,
                chargingSpeed: stationInfo.chargingSpeed,
                chargingSpeedColor: stationInfo.chargingSpeedColor,
                distance: stationInfo.distance,
                distanceUnit: stationInfo.distanceUnit,
                waitTime: stationInfo.waitTime,
                travelTime: stationInfo.travelTime,
                price: stationInfo.price,
                availability: stationInfo.availability,
                fastChargers: stationInfo.fastChargers,
                totalFastChargers: stationInfo.totalFastChargers,
                operator: stationInfo.operator,
                address: stationInfo.address,
                amenities: stationInfo.amenities,
                rating: stationInfo.rating,
                reviews: stationInfo.reviews,
                isRecommended: isRecommended,

                // Coordinate data
                latitude: position.lat,
                longitude: position.lng,

                // Action buttons for mobile UI
                actions: {
                    navigate: {
                        url: `https://maps.google.com/maps?daddr=${position.lat},${position.lng}`,
                        label: "Navigate",
                    },
                    call:
                        station.stationDetails?.phone || station.phone
                            ? {
                                  url: `tel:${
                                      station.stationDetails?.phone ||
                                      station.phone
                                  }`,
                                  label: "Call",
                              }
                            : null,
                    website:
                        station.stationDetails?.website || station.website
                            ? {
                                  url:
                                      station.stationDetails?.website ||
                                      station.website,
                                  label: "Website",
                              }
                            : null,
                },
            };
        });
    }

    /**
     * Get vehicle data with caching
     * @param {string} regNumber - Vehicle registration number
     * @returns {Promise<object|null>} Vehicle data or null
     */
    async getVehicleData(regNumber) {
        const cacheKey = `${this.VEHICLE_CACHE_KEY_PREFIX}${regNumber}`;

        try {
            // Try cache first
            const cached = await this._getClient().get(cacheKey);
            if (cached) {
                const vehicle = JSON.parse(cached);
                return vehicle;
            }

            // Cache miss - fetch from database
            const vehicle = await Vehicle.findByRegNumber(regNumber);

            if (!vehicle) {
                return null;
            }

            // Cache the result
            await this._getClient().setex(
                cacheKey,
                this.CACHE_TTL.VEHICLE,
                JSON.stringify(vehicle)
            );

            return vehicle;
        } catch (error) {
            logger.error(
                {
                    regNumber,
                    error: error.message,
                    stack: error.stack,
                },
                "Failed to get vehicle data"
            );
            throw error;
        }
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @param {number} lat1 - Latitude of first point
     * @param {number} lng1 - Longitude of first point
     * @param {number} lat2 - Latitude of second point
     * @param {number} lng2 - Longitude of second point
     * @returns {number} Distance in kilometers
     */
    calculateHaversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Check if a station is along the route between two points
     * @param {object} station - Station coordinates
     * @param {object} userLocation - User location
     * @param {object} destination - Destination location
     * @param {number} maxDeviationKm - Maximum deviation from route in km
     * @returns {boolean} True if station is along the route
     */
    isStationAlongRoute(
        station,
        userLocation,
        destination,
        maxDeviationKm = 10
    ) {
        if (!destination) {
            return true; // If no destination, consider all stations
        }

        // Calculate distance from station to the direct route line
        const stationToUser = this.calculateHaversineDistance(
            station.lat || station.latitude,
            station.lng || station.longitude,
            userLocation.lat,
            userLocation.lng
        );

        const stationToDestination = this.calculateHaversineDistance(
            station.lat || station.latitude,
            station.lng || station.longitude,
            destination.lat,
            destination.lng
        );

        const userToDestination = this.calculateHaversineDistance(
            userLocation.lat,
            userLocation.lng,
            destination.lat,
            destination.lng
        );

        // If station is close to the direct route, consider it along the route
        // Using triangle inequality to check if station is roughly along the path
        const totalDistance = stationToUser + stationToDestination;
        const routeDeviation = totalDistance - userToDestination;

        return routeDeviation <= maxDeviationKm;
    }

    /**
     * Find stations along the route between user location and destination
     * @param {object} userLocation - User location
     * @param {object} destination - Destination location
     * @param {number} searchRadius - Search radius in km
     * @param {object} chargingStrategy - Charging strategy
     * @param {number} totalRouteDistance - Total route distance
     * @param {number} batteryPercentage - Current battery percentage
     * @returns {Promise<object>} Route-based station results
     */
    async findStationsAlongRoute(
        userLocation,
        destination,
        searchRadius,
        chargingStrategy,
        totalRouteDistance,
        batteryPercentage
    ) {
        try {
            // Find all stations within the search radius
            let allStations = [];

            // Try Redis geo search first
            try {
                const geoResults =
                    await redisGeoService.findStationsWithinRadius(
                        userLocation.lat,
                        userLocation.lng,
                        searchRadius,
                        100
                    );

                if (geoResults.length > 0) {
                    const stationIds = geoResults.map((r) => r.id);
                    const metadata =
                        await redisGeoService.batchGetStationMetadata(
                            stationIds
                        );

                    allStations = geoResults.map((geoResult) => {
                        const meta = metadata.find(
                            (m) => m.id === geoResult.id
                        );
                        return {
                            id: geoResult.id,
                            distanceKm: geoResult.distanceKm,
                            name: meta?.name || "Unknown Station",
                            powerKw: meta?.powerKw || 0,
                            plugs: meta?.plugs || [],
                            availability: meta?.availability || "unknown",
                            operator: meta?.operator || "",
                            address: meta?.address || "",
                            city: meta?.city || "",
                            state: meta?.state || "",
                            pricing: meta?.pricing || {},
                            amenities: meta?.amenities || [],
                            latitude:
                                meta?.latitude ||
                                geoResult.latitude ||
                                geoResult.lat,
                            longitude:
                                meta?.longitude ||
                                geoResult.longitude ||
                                geoResult.lng,
                        };
                    });
                }
            } catch (geoError) {
                logger.warn(
                    "Redis geo search failed, falling back to database",
                    { error: geoError.message }
                );
            }

            // Fallback to database if Redis results are empty
            if (allStations.length === 0) {
                const dbResults = await Station.findWithinRadius(
                    userLocation.lat,
                    userLocation.lng,
                    searchRadius,
                    100
                );

                allStations = dbResults.map((station) => ({
                    id: station.id,
                    distanceKm: station.distance_km,
                    name: station.name,
                    powerKw: station.power_kw,
                    plugs: station.plugs || [],
                    availability: station.availability_status,
                    operator: station.operator_name,
                    address: station.address,
                    city: station.city,
                    state: station.state,
                    pricing: station.pricing_info || {},
                    amenities: station.amenities || [],
                    latitude: station.latitude,
                    longitude: station.longitude,
                }));
            }

            // Filter stations along the route
            const parameterizedStations = allStations.map((station) => ({
                ...station,
                lat: station.latitude,
                lng: station.longitude,
            }));

            // Filter to only stations along the route
            const routeStations = parameterizedStations.filter((station) =>
                this.isStationAlongRoute(station, userLocation, destination)
            );

            // Process stations and add recommendation flags
            const processedStations = routeStations.map((station) => {
                // Calculate accurate distance from user location to station
                const distanceFromUserLocation =
                    this.calculateHaversineDistance(
                        userLocation.lat,
                        userLocation.lng,
                        station.latitude || station.lat,
                        station.longitude || station.lng
                    );

                return {
                    ...station,
                    distanceFromUserLocation: distanceFromUserLocation,
                    isRecommended: this.isStationRecommended(
                        station,
                        chargingStrategy,
                        batteryPercentage,
                        chargingStrategy.usableRangeKm
                    ),
                };
            });

            // Sort stations by distance from user location (closest first)
            processedStations.sort(
                (a, b) =>
                    a.distanceFromUserLocation - b.distanceFromUserLocation
            );

            return {
                zoneResults: {
                    priority: [],
                    optimal: [],
                    extended: [],
                    emergency: [],
                },
                allStations: processedStations,
                totalFound: processedStations.length,
                routeStations: processedStations,
                totalRouteDistance,
            };
        } catch (error) {
            logger.error("Failed to find stations along route", {
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * Calculate the optimal charging point based on battery percentage and usable range
     * @param {number} batteryPercentage - Current battery percentage
     * @param {number} usableRangeKm - Usable range in kilometers
     * @returns {number} Optimal distance to travel before charging
     */
    calculateOptimalChargingPoint(batteryPercentage, usableRangeKm) {
        // Calculate how far the car can travel with current battery
        const maxTravelDistance = usableRangeKm * 0.8; // Use 80% of range for safety

        // Calculate optimal charging point based on battery percentage
        let optimalChargingDistance;

        if (batteryPercentage <= 20) {
            // Critical battery - charge immediately
            optimalChargingDistance = 5; // Within 5km
        } else if (batteryPercentage <= 35) {
            // Low battery - charge soon
            optimalChargingDistance = maxTravelDistance * 0.3; // Within 30% of range
        } else if (batteryPercentage <= 50) {
            // Medium battery - charge at optimal point
            optimalChargingDistance = maxTravelDistance * 0.5; // Within 50% of range
        } else if (batteryPercentage <= 70) {
            // Good battery - charge at optimal point
            optimalChargingDistance = maxTravelDistance * 0.7; // Within 70% of range
        } else {
            // High battery - charge at optimal point
            optimalChargingDistance = maxTravelDistance * 0.8; // Within 80% of range
        }

        // Log optimal charging point calculation for debugging
        logger.debug("Optimal charging point calculated", {
            batteryPercentage,
            usableRangeKm,
            maxTravelDistance,
            optimalChargingDistance,
        });

        return optimalChargingDistance;
    }

    /**
     * Determine if a station should be recommended based on battery percentage and travel range
     * @param {object} station - Station data
     * @param {object} chargingStrategy - Charging strategy
     * @param {number} batteryPercentage - Current battery percentage
     * @param {number} usableRangeKm - Usable range in kilometers
     * @returns {boolean} True if station should be recommended
     */
    isStationRecommended(
        station,
        chargingStrategy,
        batteryPercentage,
        usableRangeKm
    ) {
        // Calculate optimal charging point
        const optimalChargingDistance = this.calculateOptimalChargingPoint(
            batteryPercentage,
            usableRangeKm
        );

        // Use distanceFromUserLocation if available, otherwise fallback to distanceKm
        const stationDistance =
            station.distanceFromUserLocation || station.distanceKm;

        // Calculate the distance from optimal charging point
        const distanceFromOptimalPoint = Math.abs(
            stationDistance - optimalChargingDistance
        );

        // Recommend stations within 15km radius of the optimal charging point
        const isWithinRecommendationRadius = distanceFromOptimalPoint <= 15;

        // Additional criteria based on battery percentage
        let isRecommended = false;

        if (batteryPercentage <= 20) {
            // Critical battery - recommend any station within 15km of current location
            isRecommended = stationDistance <= 15;
        } else if (batteryPercentage <= 35) {
            // Low battery - recommend stations within 15km of optimal point or closer
            isRecommended =
                isWithinRecommendationRadius || stationDistance <= 30;
        } else if (batteryPercentage <= 50) {
            // Medium battery - recommend stations within 15km of optimal point
            isRecommended = isWithinRecommendationRadius;
        } else if (batteryPercentage <= 70) {
            // Good battery - recommend stations within 15km of optimal point
            isRecommended = isWithinRecommendationRadius;
        } else {
            // High battery - recommend stations within 15km of optimal point
            isRecommended = isWithinRecommendationRadius;
        }

        // Log recommendation decision for debugging
        logger.debug("Station recommendation decision", {
            stationId: station.id,
            stationName: station.name,
            batteryPercentage,
            usableRangeKm,
            optimalChargingDistance,
            stationDistanceKm: stationDistance,
            distanceFromOptimalPoint,
            isWithinRecommendationRadius,
            isRecommended,
        });

        return isRecommended;
    }

    /**
     * Find stations in optimal charging zones using parallel queries (fallback method)
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {object} chargingStrategy - Charging strategy with zones
     * @returns {Promise<object>} Zone-based station results
     */
    async findStationsInOptimalZones(lat, lng, chargingStrategy) {
        const { zones } = chargingStrategy;

        // Simplified fallback method for when route-based search fails
        try {
            const stations = await redisGeoService.findStationsWithinRadius(
                lat,
                lng,
                zones.unreachable.end,
                50
            );

            if (stations.length === 0) {
                return {
                    zoneResults: {
                        priority: [],
                        optimal: [],
                        extended: [],
                        emergency: [],
                    },
                    allStations: [],
                    totalFound: 0,
                };
            }

            const stationIds = stations.map((s) => s.id);
            const metadata = await redisGeoService.batchGetStationMetadata(
                stationIds
            );

            const allStations = stations.map((station) => {
                const meta = metadata.find((m) => m.id === station.id);

                // Calculate accurate distance from user location to station
                const distanceFromUserLocation =
                    this.calculateHaversineDistance(
                        lat,
                        lng,
                        meta?.latitude || station.latitude || station.lat,
                        meta?.longitude || station.longitude || station.lng
                    );

                return {
                    id: station.id,
                    name: meta?.name || "Unknown Station",
                    powerKw: meta?.powerKw || 0,
                    plugs: meta?.plugs || [],
                    availability: meta?.availability || "unknown",
                    operator: meta?.operator || "",
                    address: meta?.address || "",
                    city: meta?.city || "",
                    state: meta?.state || "",
                    pricing: meta?.pricing || {},
                    amenities: meta?.amenities || [],
                    latitude: meta?.latitude || station.latitude || station.lat,
                    longitude:
                        meta?.longitude || station.longitude || station.lng,
                    distanceKm: station.distanceKm,
                    distanceFromUserLocation: distanceFromUserLocation,
                };
            });

            // Return empty zone results since we're no longer using zones
            const zoneResults = {
                priority: [],
                optimal: [],
                extended: [],
                emergency: [],
            };

            return {
                zoneResults,
                allStations,
                totalFound: allStations.length,
            };
        } catch (error) {
            logger.error("Fallback station search failed", {
                error: error.message,
            });
            return {
                zoneResults: {
                    priority: [],
                    optimal: [],
                    extended: [],
                    emergency: [],
                },
                allStations: [],
                totalFound: 0,
            };
        }
    }

    /**
     * Find stations along the route between user location and destination
     * @param {string} regNumber - Vehicle registration number
     * @param {number} batteryPercentage - Current battery percentage (0-100)
     * @param {object} userLocation - User location {lat, lng}
     * @param {object} destination - Destination {lat, lng} (optional)
     * @returns {Promise<object>} Station discovery result with route-based recommendations
     */
    async findStationsInRange(
        regNumber,
        batteryPercentage,
        userLocation,
        destination = null
    ) {
        const startTime = Date.now();

        try {
            // Get vehicle data
            const vehicle = await this.getVehicleData(regNumber);
            if (!vehicle) {
                logger.warn({ regNumber }, "Vehicle not found");
                throw new Error("Vehicle not found");
            }

            // Compute usable range using dynamic battery percentage
            const usableRangeKm = this.computeUsableRange(
                vehicle,
                batteryPercentage
            );

            // Compute optimal charging strategy
            const chargingStrategy = this.computeOptimalChargingStrategy(
                usableRangeKm,
                batteryPercentage
            );

            // Calculate route distance and determine search strategy
            let totalRouteDistance = 0;
            let searchRadius = usableRangeKm;

            if (destination) {
                totalRouteDistance = this.calculateHaversineDistance(
                    userLocation.lat,
                    userLocation.lng,
                    destination.lat,
                    destination.lng
                );

                // If destination is beyond usable range, expand search radius
                if (totalRouteDistance > usableRangeKm) {
                    searchRadius = Math.max(
                        usableRangeKm * 1.5,
                        totalRouteDistance * 1.2
                    );
                }
            }

            // Create cache key for route-based search
            const roundedLat = Math.round(userLocation.lat * 10) / 10;
            const roundedLng = Math.round(userLocation.lng * 10) / 10;
            const roundedRange = Math.floor(searchRadius / 10) * 10;
            const zoneKey = Math.floor(batteryPercentage / 10) * 10;
            const routeKey = destination
                ? `${Math.round(destination.lat * 10) / 10}:${
                      Math.round(destination.lng * 10) / 10
                  }`
                : "no_dest";
            const cacheKey = `${this.ZONE_CACHE_KEY_PREFIX}route:${roundedLat}:${roundedLng}:${roundedRange}:${zoneKey}:${routeKey}`;

            // Try cache first
            let routeResults = null;
            try {
                const cached = await this._getClient().get(cacheKey);
                if (cached) {
                    routeResults = JSON.parse(cached);
                }
            } catch (cacheError) {
                logger.warn(
                    { error: cacheError.message, cacheKey },
                    "Route cache read failed, falling back to live query"
                );
            }

            // Cache miss - execute route-based search
            if (!routeResults) {
                try {
                    // Find all stations along the route
                    routeResults = await this.findStationsAlongRoute(
                        userLocation,
                        destination,
                        searchRadius,
                        chargingStrategy,
                        totalRouteDistance,
                        batteryPercentage
                    );

                    // Cache the route results
                    try {
                        await this._getClient().setex(
                            cacheKey,
                            this.CACHE_TTL.ZONE,
                            JSON.stringify(routeResults)
                        );
                    } catch (cacheError) {
                        logger.warn(
                            { error: cacheError.message, cacheKey },
                            "Failed to cache route results"
                        );
                    }
                } catch (routeError) {
                    logger.warn(
                        {
                            error: routeError.message,
                            userLocation,
                            destination,
                            searchRadius,
                        },
                        "Route-based search failed, falling back to radius search"
                    );

                    // Fallback to radius-based search
                    routeResults = await this.findStationsInOptimalZones(
                        userLocation.lat,
                        userLocation.lng,
                        chargingStrategy
                    );
                }
            }

            // Generate route-optimized response
            const routeOptimizedResponse = this.generateRouteOptimizedResponse(
                routeResults,
                chargingStrategy,
                userLocation,
                destination,
                usableRangeKm,
                batteryPercentage,
                totalRouteDistance
            );

            const duration = Date.now() - startTime;
            logger.info(
                {
                    regNumber,
                    usableRangeKm,
                    batteryPercentage,
                    totalRouteDistance,
                    totalFound: routeResults.totalFound,
                    recommendedCount:
                        routeOptimizedResponse.allStations.stations.filter(
                            (s) => s.isRecommended
                        ).length,
                    duration: `${duration}ms`,
                    urgency: chargingStrategy.recommendations.urgency,
                },
                "Route-based station discovery completed"
            );

            return {
                googleMapsResponse: routeOptimizedResponse,
                duration,
            };
        } catch (error) {
            logger.error(
                {
                    regNumber,
                    error: error.message,
                    stack: error.stack,
                },
                "Route-based station discovery failed"
            );
            throw error;
        }
    }
}

// Export singleton instance
export default new StationLookupService();
