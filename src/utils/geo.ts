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
  distanceKm: number,
  maxRadiusKm: number
): boolean {
  return distanceKm <= maxRadiusKm;
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
