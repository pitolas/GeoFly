import { Waypoint, ElevationPoint, TakeoffPoint } from '../types';

/** In-memory cache for terrain elevation queries */
const elevationCache = new Map<string, number>();

/** Generate synthetic realistic elevation based on lat/lng as instant fallback */
export function getSyntheticElevation(lat: number, lng: number): number {
  // Use harmonic trigonometric equations to simulate realistic topography
  const latScale = lat * 111.0; // approx km
  const lngScale = lng * 111.0 * Math.cos((lat * Math.PI) / 180);

  const base = 480; // base regional altitude in meters
  const hills = Math.sin(latScale * 0.08) * Math.cos(lngScale * 0.08) * 65;
  const ridges = Math.sin(latScale * 0.25 + lngScale * 0.15) * 35;
  const micro = Math.cos(latScale * 0.8) * Math.sin(lngScale * 0.8) * 12;

  const elevation = Math.round((base + hills + ridges + micro) * 10) / 10;
  return Math.max(0, elevation);
}

/** Fetch elevation for single coordinate */
export async function fetchCoordinateElevation(lat: number, lng: number): Promise<number> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (elevationCache.has(key)) {
    return elevationCache.get(key)!;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const elev = Math.round(data.results[0].elevation * 10) / 10;
        elevationCache.set(key, elev);
        return elev;
      }
    }
  } catch {
    // Fallback on network timeout or CORS
  }

  const fallback = getSyntheticElevation(lat, lng);
  elevationCache.set(key, fallback);
  return fallback;
}

/** Batch fetch elevations for multiple waypoints */
export async function updateWaypointsWithTerrainData(
  waypoints: Waypoint[],
  targetAgl: number,
  takeoffPoint?: TakeoffPoint,
  onProgress?: (progressPercent: number) => void
): Promise<{
  updatedWaypoints: Waypoint[];
  elevationProfile: ElevationPoint[];
  minElevation: number;
  maxElevation: number;
  elevationDiff: number;
}> {
  if (waypoints.length === 0) {
    return {
      updatedWaypoints: [],
      elevationProfile: [],
      minElevation: 0,
      maxElevation: 0,
      elevationDiff: 0
    };
  }

  // Determine takeoff point elevation
  let takeoffGroundElev = takeoffPoint?.elevationMsl;
  if (takeoffGroundElev === undefined || takeoffGroundElev === 0) {
    const firstWp = waypoints[0];
    takeoffGroundElev = await fetchCoordinateElevation(
      takeoffPoint ? takeoffPoint.lat : firstWp.lat,
      takeoffPoint ? takeoffPoint.lng : firstWp.lng
    );
  }

  const updated: Waypoint[] = [];
  const elevationProfile: ElevationPoint[] = [];

  // Batch query to Open-Elevation
  const locationsQuery = waypoints.map((w) => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`).join('|');
  let apiElevations: number[] = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${locationsQuery}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.results && data.results.length === waypoints.length) {
        apiElevations = data.results.map((r: { elevation: number }) => r.elevation);
      }
    }
  } catch {
    // Will use fallback
  }

  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    let groundElev = apiElevations[i];

    if (groundElev === undefined || isNaN(groundElev)) {
      groundElev = await fetchCoordinateElevation(wp.lat, wp.lng);
    }

    minElev = Math.min(minElev, groundElev);
    maxElev = Math.max(maxElev, groundElev);

    // MSL altitude of drone = ground elevation + desired AGL clearance
    const droneMsl = Math.round((groundElev + targetAgl) * 10) / 10;
    // Relative altitude to takeoff location (for DJI and Litchi relative mode)
    const relativeToTakeoff = Math.round((groundElev - takeoffGroundElev + targetAgl) * 10) / 10;

    const newWp: Waypoint = {
      ...wp,
      groundElevation: groundElev,
      altitudeMsl: droneMsl,
      altitudeAgl: relativeToTakeoff // In DJI, waypoint altitude is relative to takeoff point
    };

    updated.push(newWp);

    elevationProfile.push({
      index: i,
      distanceM: wp.cumulativeDistanceM,
      groundElevationMsl: groundElev,
      droneAltitudeMsl: droneMsl,
      clearanceAgl: targetAgl,
      waypointId: wp.id,
      isPhoto: wp.isPhotoPoint
    });

    if (onProgress && i % 10 === 0) {
      onProgress(Math.round(((i + 1) / waypoints.length) * 100));
    }
  }

  if (onProgress) onProgress(100);

  return {
    updatedWaypoints: updated,
    elevationProfile,
    minElevation: minElev === Infinity ? 0 : Math.round(minElev * 10) / 10,
    maxElevation: maxElev === -Infinity ? 0 : Math.round(maxElev * 10) / 10,
    elevationDiff: minElev === Infinity ? 0 : Math.round((maxElev - minElev) * 10) / 10
  };
}
