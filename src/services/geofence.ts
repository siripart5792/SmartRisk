/**
 * Geodesic Distance and Geofencing Service
 * Accurately computes Haversine distances, bearings, and geofence thresholds in real-time.
 */

import { RiskPoint, GPSPosition, GeofenceAlert } from '../types';

/**
 * Calculates distance between two coordinates in meters using Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates bearing angle in degrees (0 - 360) from point A to point B
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const bearing = ((theta * 180) / Math.PI + 360) % 360;
  return Math.round(bearing);
}

/**
 * Evaluates active geofence alerts given current GPS position and risk points list
 */
export function evaluateGeofence(
  currentPos: GPSPosition,
  points: RiskPoint[],
  radiusMeters: number,
  previouslyAlertedIds: Set<string>
): {
  newAlerts: GeofenceAlert[];
  allNearby: { point: RiskPoint; distance: number; bearing: number }[];
} {
  const allNearby: { point: RiskPoint; distance: number; bearing: number }[] = [];
  const newAlerts: GeofenceAlert[] = [];

  points.forEach((point) => {
    // Only alert for points that are approved or pending review (skip resolved/rejected)
    if (point.status === 'resolved' || point.status === 'rejected') return;

    const distance = calculateDistanceMeters(
      currentPos.lat,
      currentPos.lng,
      point.lat,
      point.lng
    );

    const bearing = calculateBearing(
      currentPos.lat,
      currentPos.lng,
      point.lat,
      point.lng
    );

    if (distance <= radiusMeters) {
      allNearby.push({ point, distance, bearing });

      if (!previouslyAlertedIds.has(point.id)) {
        newAlerts.push({
          point,
          distance,
          acknowledged: false,
          timestamp: Date.now(),
        });
      }
    }
  });

  // Sort nearest first
  allNearby.sort((a, b) => a.distance - b.distance);
  newAlerts.sort((a, b) => a.distance - b.distance);

  return { newAlerts, allNearby };
}
