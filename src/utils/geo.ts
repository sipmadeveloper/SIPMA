/**
 * Geospatial utility functions for SIPMA Zonasi calculation
 */

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates the great-circle distance between two points on the Earth's surface
 * using the Haversine formula.
 * @param lat1 Latitude of point 1 in decimal degrees
 * @param lon1 Longitude of point 1 in decimal degrees
 * @param lat2 Latitude of point 2 in decimal degrees
 * @param lon2 Longitude of point 2 in decimal degrees
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === 0 || lon1 === 0 || lat2 === 0 || lon2 === 0) return 0;

  const toRad = (angle: number) => (angle * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_KM * c;
  return Number(distance.toFixed(3)); // 3 decimal places (precision ~ 1 meter)
}

/**
 * Checks if candidate distance is within school zoning radius
 */
export function checkZoningCompliance(
  distanceKm?: number | null,
  maxRadiusKm?: number | null
): boolean {
  if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm)) {
    return false;
  }
  const radius =
    typeof maxRadiusKm === 'number' && !isNaN(maxRadiusKm) && maxRadiusKm > 0
      ? maxRadiusKm
      : 5.0;
  // Safe comparison with micro-epsilon to prevent floating point inaccuracies
  return Number(distanceKm) <= radius + 0.0001;
}

/**
 * Evaluates application zoning parameters against school coordinates and radius.
 * Returns consistent distance, max radius, and zoning status.
 */
export function evaluateApplicationZoning(
  app: {
    latitude?: number | null;
    longitude?: number | null;
    distance_km?: number | null;
    max_distance_km?: number | null;
    zoning_status?: 'memenuhi' | 'tidak_memenuhi';
  },
  school?: {
    latitude?: number | null;
    longitude?: number | null;
    zoning_radius_km?: number | null;
  } | null
): {
  distance_km: number;
  max_distance_km: number;
  isCompliant: boolean;
  zoning_status: 'memenuhi' | 'tidak_memenuhi';
} {
  const maxRadius =
    typeof school?.zoning_radius_km === 'number' && !isNaN(school.zoning_radius_km) && school.zoning_radius_km > 0
      ? school.zoning_radius_km
      : typeof app.max_distance_km === 'number' && !isNaN(app.max_distance_km) && app.max_distance_km > 0
      ? app.max_distance_km
      : 5.0;

  let dist =
    typeof app.distance_km === 'number' && !isNaN(app.distance_km) ? app.distance_km : 0;

  // If both student and school have valid non-zero coordinates, calculate real-time Haversine distance
  if (
    typeof app.latitude === 'number' &&
    typeof app.longitude === 'number' &&
    app.latitude !== 0 &&
    app.longitude !== 0 &&
    school &&
    typeof school.latitude === 'number' &&
    typeof school.longitude === 'number' &&
    school.latitude !== 0 &&
    school.longitude !== 0
  ) {
    dist = calculateHaversineDistance(app.latitude, app.longitude, school.latitude, school.longitude);
  }

  const isCompliant = checkZoningCompliance(dist, maxRadius);
  return {
    distance_km: dist,
    max_distance_km: maxRadius,
    isCompliant,
    zoning_status: isCompliant ? 'memenuhi' : 'tidak_memenuhi',
  };
}

/**
 * Formats distance with Indonesian locale (e.g. 2,35 km or 850 m)
 */
export function formatDistanceIndonesian(distanceKm?: number | null): string {
  if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm)) {
    return '0 m';
  }
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(2).replace('.', ',')} km`;
}

/**
 * Formats coordinates for clean display
 */
export function formatCoordinates(lat?: number | null, lon?: number | null): string {
  if (lat === undefined || lat === null || lon === undefined || lon === null || isNaN(lat) || isNaN(lon) || (!lat && !lon)) {
    return 'Belum ditentukan';
  }
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

/**
 * Helper to get approximate human-readable address from coordinates
 * using open reverse-geocoding (Nominatim OpenStreetMap) with local fallback
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'id,en',
        },
      }
    );
    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch {
    // Fail silently and return fallback
  }
  return `Titik Koordinat: ${formatCoordinates(lat, lon)}`;
}
