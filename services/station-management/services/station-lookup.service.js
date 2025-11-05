/**
 * Station Lookup Service
 * High-performance station discovery with caching and range calculation
 */

import { redis } from "@ev-platform/shared";
import { createLogger } from "@ev-platform/shared";
import { Station, Vehicle } from "../models/index.js";
import redisGeoService from "./redis-geo.service.js";

const logger = createLogger("station-management");

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

        // Google API configuration
        this.googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

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
     * Find stations near a given location within a radius
     * Simple nearby search using Redis Geo (fallback to DB)
     * @param {{lat:number,lng:number}} userLocation
     * @param {number} radiusKm
     * @param {number} limit
     * @returns {Promise<Array>} stations with distanceKm and metadata
     */
    async findStationsNearLocation(userLocation, radiusKm = 20) {
        const { lat, lng } = userLocation || {};
        if (typeof lat !== "number" || typeof lng !== "number") {
            throw new Error("Invalid userLocation");
        }

        // Build a cache key using rounded location and radius
        const roundedLat = Math.round(lat * 1000) / 1000;
        const roundedLng = Math.round(lng * 1000) / 1000;
        const roundedRadius = Math.round(radiusKm * 10) / 10;
        const cacheKey = `${this.STATION_CACHE_KEY_PREFIX}${roundedLat}:${roundedLng}:${roundedRadius}`;

        // Try cache first
        try {
            const cached = await this._getClient().get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (cacheError) {
            logger.warn(
                { error: cacheError.message, cacheKey },
                "Nearby cache read failed, falling back to live query"
            );
        }

        // Reuse internal aggregator with requested radius
        const stations = await this._gatherStationsWithinRadius(
            lat,
            lng,
            radiusKm
        );

        // Get Google distances from user to each station
        const parameterizedStations = stations.map((s) => ({
            ...s,
            lat: s.latitude || s.lat,
            lng: s.longitude || s.lng,
        }));
        const distancesMap = await this.getGoogleDistancesKm(
            userLocation,
            parameterizedStations
        );

        // Map to minimal fields with Google distance only
        const minimalStations = parameterizedStations
            .map((s) => {
                const distanceFromUserLocation = distancesMap.get(s.id);
                // Only include stations with valid Google distance
                if (
                    distanceFromUserLocation === null ||
                    distanceFromUserLocation === undefined
                ) {
                    return null;
                }
                return {
                    id: s.id,
                    name: s.name,
                    latitude: s.latitude || s.lat,
                    longitude: s.longitude || s.lng,
                    distanceFromUserLocation,
                    certified: s.certified !== undefined ? s.certified : false,
                };
            })
            .filter((s) => s !== null)
            .sort(
                (a, b) =>
                    a.distanceFromUserLocation - b.distanceFromUserLocation
            );

        // Best-effort cache write
        try {
            await this._getClient().setex(
                cacheKey,
                this.CACHE_TTL.STATION,
                JSON.stringify(minimalStations)
            );
        } catch (cacheError) {
            logger.warn(
                { error: cacheError.message, cacheKey },
                "Nearby cache write failed"
            );
        }

        return minimalStations;
    }

    /**
     * Determine route distance, midpoint and search radius for midpoint-radius query
     */
    async _determineRouteSearchParams(
        userLocation,
        destination,
        usableRangeKm
    ) {
        let totalRouteDistance = 0;
        let centerLat = userLocation.lat;
        let centerLng = userLocation.lng;
        let searchRadius = usableRangeKm;
        if (destination) {
            totalRouteDistance = await this.getGoogleRouteDistanceKm(
                userLocation,
                destination
            );
            centerLat = (userLocation.lat + destination.lat) / 2;
            centerLng = (userLocation.lng + destination.lng) / 2;
            searchRadius = Math.max(totalRouteDistance / 2, 5);
        }
        return { totalRouteDistance, centerLat, centerLng, searchRadius };
    }

    /**
     * Build cache key for midpoint-radius results
     */
    _buildMidpointCacheKey(
        centerLat,
        centerLng,
        searchRadius,
        batteryPercentage,
        destination
    ) {
        const roundedCenterLat = Math.round(centerLat * 10) / 10;
        const roundedCenterLng = Math.round(centerLng * 10) / 10;
        const roundedRange = Math.floor(searchRadius / 10) * 10;
        const zoneKey = Math.floor(batteryPercentage / 10) * 10;
        const destKey = destination
            ? `${Math.round(destination.lat * 10) / 10}:${
                  Math.round(destination.lng * 10) / 10
              }`
            : "no_dest";
        return `${this.ZONE_CACHE_KEY_PREFIX}midcircle:${roundedCenterLat}:${roundedCenterLng}:${roundedRange}:${zoneKey}:${destKey}`;
    }

    /**
     * Gather stations within radius (Redis geo first, then DB fallback)
     */
    async _gatherStationsWithinRadius(centerLat, centerLng, searchRadius) {
        let allStations = [];
        try {
            const geoResults = await redisGeoService.findStationsWithinRadius(
                centerLat,
                centerLng,
                searchRadius,
                100
            );
            if (geoResults.length > 0) {
                const stationIds = geoResults.map((r) => r.id);
                const metadata = await redisGeoService.batchGetStationMetadata(
                    stationIds
                );
                allStations = geoResults.map((geoResult) => {
                    const meta = metadata.find((m) => m.id === geoResult.id);
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
                        certified:
                            meta?.certified !== undefined
                                ? meta.certified
                                : false,
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
            logger.warn("Redis geo search failed, falling back to database", {
                error: geoError.message,
            });
        }
        if (allStations.length === 0) {
            const dbResults = await Station.findWithinRadius(
                centerLat,
                centerLng,
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
                certified:
                    station.certified !== undefined ? station.certified : false,
                latitude: station.latitude,
                longitude: station.longitude,
            }));
        }
        return allStations;
    }

    /**
     * Score, recommend and sort stations using strategy and distances
     */
    _recommendAndSortStations(
        parameterizedStations,
        distancesMap,
        userLocation,
        chargingStrategy,
        usableRangeKm
    ) {
        const processedStations = parameterizedStations
            .map((station) => {
                const distanceFromUserLocation = distancesMap.get(station.id);
                // Only process stations with valid Google distance
                if (
                    distanceFromUserLocation === null ||
                    distanceFromUserLocation === undefined
                ) {
                    return null;
                }
                const { zones, maxReachableDistance, recommendations } =
                    chargingStrategy || {};
                const inRange =
                    distanceFromUserLocation <=
                    (maxReachableDistance ?? usableRangeKm);
                const inOptimalZone = zones
                    ? distanceFromUserLocation >= zones.optimal.start &&
                      distanceFromUserLocation <= zones.optimal.end
                    : false;
                const inPriorityZone = zones
                    ? distanceFromUserLocation >= zones.priority.start &&
                      distanceFromUserLocation <= zones.priority.end
                    : false;
                let isRecommended =
                    inRange && (inOptimalZone || inPriorityZone);
                if (recommendations?.urgency === "critical") {
                    isRecommended = inRange && distanceFromUserLocation <= 15;
                } else if (recommendations?.urgency === "high") {
                    isRecommended =
                        inRange &&
                        (inPriorityZone || distanceFromUserLocation <= 30);
                }
                return {
                    ...station,
                    distanceFromUserLocation,
                    isRecommended,
                };
            })
            .filter((s) => s !== null);
        processedStations.sort(
            (a, b) => a.distanceFromUserLocation - b.distanceFromUserLocation
        );
        return processedStations;
    }

    /**
     * Shape midpoint results object
     */
    _buildMidpointResults(processedStations, totalRouteDistance) {
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
    }

    /**
     * Cache midpoint results (best-effort)
     */
    async _cacheMidpointResults(cacheKey, results) {
        try {
            await this._getClient().setex(
                cacheKey,
                this.CACHE_TTL.ZONE,
                JSON.stringify(results)
            );
        } catch (cacheError) {
            logger.warn(
                { error: cacheError.message, cacheKey },
                "Failed to cache midpoint-radius results"
            );
        }
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
     * Fetch route distance from Google Directions API (km)
     * Centralized usage of Google API key configured at class level
     */
    async getGoogleRouteDistanceKm(origin, dest) {
        if (!dest) {
            return 0;
        }
        const apiKey = this.googleApiKey;
        if (!apiKey) {
            throw new Error("GOOGLE_MAPS_API_KEY is not configured");
        }
        const params = new URLSearchParams({
            origin: `${origin.lat},${origin.lng}`,
            destination: `${dest.lat},${dest.lng}`,
            key: apiKey,
        });
        const url = `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`Directions API failed with status ${resp.status}`);
        }
        const data = await resp.json();
        const meters = data?.routes?.[0]?.legs?.[0]?.distance?.value || 0;
        return meters / 1000;
    }

    /**
     * Batch distance matrix from user to stations (km)
     * Returns Map<stationId, km|null>
     */
    async getGoogleDistancesKm(origin, stations) {
        const apiKey = this.googleApiKey;
        if (!apiKey) {
            throw new Error("GOOGLE_MAPS_API_KEY is not configured");
        }
        const results = new Map();
        const batchSize = 25; // Distance Matrix limit per request
        for (let i = 0; i < stations.length; i += batchSize) {
            const batch = stations.slice(i, i + batchSize);
            const destinations = batch
                .map((s) => `${s.latitude || s.lat},${s.longitude || s.lng}`)
                .join("|");
            const params = new URLSearchParams({
                origins: `${origin.lat},${origin.lng}`,
                destinations,
                key: apiKey,
            });
            const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`;
            const resp = await fetch(url);
            if (!resp.ok) {
                throw new Error(
                    `Distance Matrix API failed with status ${resp.status}`
                );
            }
            const data = await resp.json();
            const elements = data?.rows?.[0]?.elements || [];
            elements.forEach((el, idx) => {
                const km = el?.distance?.value
                    ? el.distance.value / 1000
                    : null;
                results.set(batch[idx].id, km);
            });
        }
        return results;
    }

    /**
     * Compute usable range for a vehicle with dynamic battery percentage
     * @param {object} vehicle - Vehicle data
     * @param {number} batteryPercentage - Current battery percentage (0-100)
     * @returns {number} Usable range in kilometers
     */
    computeUsableRange(vehicle, batteryPercentage) {
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
     * Generate route-optimized response structure with battery-based recommendations
     * @param {object} routeResults - Route-based station results
     * @param {object} userLocation - User location
     * @param {object} destination - Destination location
     * @param {number} usableRangeKm - Usable range in km
     * @returns {object} Route-optimized response with recommendations
     */
    generateRouteOptimizedResponse(
        routeResults,
        userLocation,
        destination,
        usableRangeKm
    ) {
        return {
            usableRangeKm,
            totalFound: routeResults.totalFound,
            // Map data for visualization
            mapData: {
                userLocation: {
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                },
                destination: destination
                    ? {
                          lat: destination.lat,
                          lng: destination.lng,
                      }
                    : null,
            },

            // All stations along the route
            allStations: {
                totalCount: routeResults.totalFound,
                stations: routeResults.allStations.map((station) => ({
                    id: station.id,
                    name: station.name,
                    latitude: station.latitude || station.lat,
                    longitude: station.longitude || station.lng,
                    distanceFromUserLocation:
                        station.distanceFromUserLocation || null,
                    isRecommended: station.isRecommended,
                    certified:
                        station.certified !== undefined
                            ? station.certified
                            : false,
                })),
            },
        };
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
            // Determine route/search params and cache key
            const { totalRouteDistance, centerLat, centerLng, searchRadius } =
                await this._determineRouteSearchParams(
                    userLocation,
                    destination,
                    usableRangeKm
                );
            logger.info(
                { totalRouteDistance, centerLat, centerLng, searchRadius },
                "Route distance and midpoint"
            );
            const cacheKey = this._buildMidpointCacheKey(
                centerLat,
                centerLng,
                searchRadius,
                batteryPercentage,
                destination
            );
            // Try cache first
            let results = null;
            try {
                const cached = await this._getClient().get(cacheKey);
                if (cached) {
                    results = JSON.parse(cached);
                }
            } catch (cacheError) {
                logger.warn(
                    { error: cacheError.message, cacheKey },
                    "Midpoint cache read failed, falling back to live query"
                );
            }
            // Cache miss: execute midpoint-radius search
            if (!results) {
                // 1) Gather stations within radius of the midpoint
                const allStations = await this._gatherStationsWithinRadius(
                    centerLat,
                    centerLng,
                    searchRadius
                );
                // 2) Get Google distances from user to each station
                const parameterizedStations = allStations.map((s) => ({
                    ...s,
                    lat: s.latitude,
                    lng: s.longitude,
                }));
                const distancesMap = await this.getGoogleDistancesKm(
                    userLocation,
                    parameterizedStations
                );
                const processedStations = this._recommendAndSortStations(
                    parameterizedStations,
                    distancesMap,
                    userLocation,
                    chargingStrategy,
                    usableRangeKm
                );
                results = this._buildMidpointResults(
                    processedStations,
                    totalRouteDistance
                );
                await this._cacheMidpointResults(cacheKey, results);
            }
            // Generate response
            const routeOptimizedResponse = this.generateRouteOptimizedResponse(
                results,
                userLocation,
                destination,
                usableRangeKm
            );
            const duration = Date.now() - startTime;
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
