import { DroneCameraProfile, FlightConfig, UtmCoordinate, Waypoint, FlightLine } from '../types';

export const EARTH_RADIUS_M = 6371000;

/** Convert degrees to radians */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Convert radians to degrees */
export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Compute Haversine distance between two coordinates in meters */
export function getDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/** Compute initial bearing from point 1 to point 2 in degrees (0 - 360) */
export function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

/** Compute destination point given start point, distance (m) and bearing (deg) */
export function getDestinationPoint(
  lat: number,
  lng: number,
  distanceM: number,
  bearingDeg: number
): [number, number] {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(lat);
  const λ1 = toRad(lng);

  const sinφ2 = Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const y = Math.sin(θ) * Math.sin(δ) * Math.cos(φ1);
  const x = Math.cos(δ) - Math.sin(φ1) * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  return [toDeg(φ2), ((toDeg(λ2) + 540) % 360) - 180];
}

/** Convert WGS84 Lat/Lng to UTM (Universal Transverse Mercator) */
export function latLngToUtm(lat: number, lng: number): UtmCoordinate {
  const a = 6378137.0; // WGS84 semi-major axis
  const f = 1 / 298.257223563; // Flattening
  const k0 = 0.9996; // Scale factor

  const latRad = toRad(lat);
  const lngRad = toRad(lng);

  let zone = Math.floor((lng + 180) / 6) + 1;
  if (lat >= 56.0 && lat < 64.0 && lng >= 3.0 && lng < 12.0) zone = 32;
  if (lat >= 72.0 && lat < 84.0) {
    if (lng >= 0.0 && lng < 9.0) zone = 31;
    else if (lng >= 9.0 && lng < 21.0) zone = 33;
    else if (lng >= 21.0 && lng < 33.0) zone = 35;
    else if (lng >= 33.0 && lng < 42.0) zone = 37;
  }

  const centralLng = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);

  const e = Math.sqrt(2 * f - f * f);
  const eSq = e * e;
  const ePrimeSq = eSq / (1 - eSq);

  const N = a / Math.sqrt(1 - eSq * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = ePrimeSq * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - centralLng);

  const M =
    a *
    ((1 - eSq / 4 - (3 * eSq * eSq) / 64 - (5 * eSq * eSq * eSq) / 256) * latRad -
      ((3 * eSq) / 8 + (3 * eSq * eSq) / 32 + (45 * eSq * eSq * eSq) / 1024) * Math.sin(2 * latRad) +
      ((15 * eSq * eSq) / 256 + (45 * eSq * eSq * eSq) / 1024) * Math.sin(4 * latRad) -
      ((35 * eSq * eSq * eSq) / 3072) * Math.sin(6 * latRad));

  const easting =
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * ePrimeSq) * A * A * A * A * A) / 120) +
    500000.0;

  let northing =
    k0 *
    (M +
      N *
        Math.tan(latRad) *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * ePrimeSq) * A * A * A * A * A * A) / 720));

  const hemisphere: 'N' | 'S' = lat < 0 ? 'S' : 'N';
  if (lat < 0) {
    northing += 10000000.0; // False northing for southern hemisphere
  }

  return {
    zone,
    hemisphere,
    easting: Math.round(easting * 100) / 100,
    northing: Math.round(northing * 100) / 100,
    formatted: `${zone}${hemisphere} E:${easting.toFixed(2)} N:${northing.toFixed(2)}`
  };
}

/** Calculate GSD and footprint for given camera and altitude */
export function calculatePhotogrammetryParameters(
  camera: DroneCameraProfile,
  altitudeM: number,
  frontalOverlap: number,
  sideOverlap: number
) {
  // GSD in cm/pixel
  const gsdWidthCm = (camera.sensorWidthMm * altitudeM * 100) / (camera.focalLengthMm * camera.imageWidthPx);
  const gsdHeightCm = (camera.sensorHeightMm * altitudeM * 100) / (camera.focalLengthMm * camera.imageHeightPx);
  const gsdCmPx = Math.max(gsdWidthCm, gsdHeightCm);

  // Ground Footprint in meters
  const footprintWidthM = (camera.sensorWidthMm * altitudeM) / camera.focalLengthMm;
  const footprintHeightM = (camera.sensorHeightMm * altitudeM) / camera.focalLengthMm;

  // Spacing between photos and flight lines
  const forwardSpacingM = Math.max(2, footprintHeightM * (1 - frontalOverlap / 100));
  const lateralSpacingM = Math.max(2, footprintWidthM * (1 - sideOverlap / 100));

  return {
    gsdCmPx: Math.round(gsdCmPx * 100) / 100,
    footprintWidthM: Math.round(footprintWidthM * 10) / 10,
    footprintHeightM: Math.round(footprintHeightM * 10) / 10,
    forwardSpacingM: Math.round(forwardSpacingM * 10) / 10,
    lateralSpacingM: Math.round(lateralSpacingM * 10) / 10
  };
}

/** Compute required flight altitude given desired GSD in cm/pixel */
export function calculateAltitudeFromGsd(
  camera: DroneCameraProfile,
  desiredGsdCmPx: number
): number {
  const alt = (desiredGsdCmPx * camera.focalLengthMm * camera.imageWidthPx) / (camera.sensorWidthMm * 100);
  return Math.round(alt * 10) / 10;
}

/** Calculate polygon centroid [lat, lng] */
export function getPolygonCentroid(polygon: [number, number][]): [number, number] {
  let latSum = 0;
  let lngSum = 0;
  for (const [lat, lng] of polygon) {
    latSum += lat;
    lngSum += lng;
  }
  return [latSum / polygon.length, lngSum / polygon.length];
}

/** Calculate spherical area of a polygon in m² */
export function getPolygonAreaM2(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  let total = 0;
  const len = polygon.length;
  for (let i = 0; i < len; i++) {
    const [lat1, lng1] = polygon[i];
    const [lat2, lng2] = polygon[(i + 1) % len];
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Convert [lat, lng] to local tangent plane meter coordinates [x, y] around centroid */
function toLocalMeters(lat: number, lng: number, centerLat: number, centerLng: number): [number, number] {
  const dLat = lat - centerLat;
  const dLng = lng - centerLng;
  const y = dLat * (Math.PI / 180) * EARTH_RADIUS_M;
  const x = dLng * (Math.PI / 180) * EARTH_RADIUS_M * Math.cos(toRad(centerLat));
  return [x, y];
}

/** Convert local [x, y] meters back to [lat, lng] */
function fromLocalMeters(x: number, y: number, centerLat: number, centerLng: number): [number, number] {
  const lat = centerLat + (y / EARTH_RADIUS_M) * (180 / Math.PI);
  const lng = centerLng + (x / (EARTH_RADIUS_M * Math.cos(toRad(centerLat)))) * (180 / Math.PI);
  return [lat, lng];
}

/** Check if point is inside polygon (ray-casting) in local metric coordinates */
function isPointInLocalPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Find intersections between a horizontal line y = const and polygon edges in local coordinates */
function findLinePolygonIntersections(y: number, poly: [number, number][]): number[] {
  const intersections: number[] = [];
  const n = poly.length;

  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];

    if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
      // Calculate x coordinate of intersection
      const t = (y - p1[1]) / (p2[1] - p1[1]);
      const x = p1[0] + t * (p2[0] - p1[0]);
      intersections.push(x);
    }
  }

  return intersections.sort((a, b) => a - b);
}

/** Calculate optimal flight line angle (minimizes turns and flight duration) */
export function calculateOptimalFlightAngle(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;
  const centroid = getPolygonCentroid(polygon);
  const localPoly = polygon.map(([lat, lng]) => toLocalMeters(lat, lng, centroid[0], centroid[1]));

  let bestAngle = 0;
  let minLines = Infinity;

  // Test every 5 degrees from 0 to 175
  for (let deg = 0; deg < 180; deg += 5) {
    const rad = toRad(deg);
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    let minY = Infinity;
    let maxY = -Infinity;

    for (const [x, y] of localPoly) {
      const rotY = -x * sinA + y * cosA;
      minY = Math.min(minY, rotY);
      maxY = Math.max(maxY, rotY);
    }

    const span = maxY - minY;
    if (span < minLines) {
      minLines = span;
      bestAngle = deg;
    }
  }

  return bestAngle;
}

/** Generate flight lines and waypoints for Single / Double Grid */
export function generateGridFlightMission(
  polygon: [number, number][],
  camera: DroneCameraProfile,
  config: FlightConfig,
  takeoffPoint?: { lat: number; lng: number }
): {
  waypoints: Waypoint[];
  flightLines: FlightLine[];
  stats: any;
} {
  if (!polygon || polygon.length < 3) {
    return { waypoints: [], flightLines: [], stats: null };
  }

  const centroid = getPolygonCentroid(polygon);
  if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) {
    return { waypoints: [], flightLines: [], stats: null };
  }

  const localPoly = polygon.map(([lat, lng]) => toLocalMeters(lat, lng, centroid[0], centroid[1]));

  const photoParams = calculatePhotogrammetryParameters(
    camera,
    Math.max(10, config.targetAltitudeAgl || 60),
    Math.min(95, Math.max(10, config.frontalOverlap || 75)),
    Math.min(95, Math.max(10, config.sideOverlap || 65))
  );

  const angleRad = toRad(config.stripAngle || 0);
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  // Rotate local polygon by -stripAngle so flight lines are horizontal (parallel to x-axis)
  const rotatedPoly: [number, number][] = localPoly.map(([x, y]) => [
    x * cosA + y * sinA,
    -x * sinA + y * cosA
  ]);

  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;

  for (const [rx, ry] of rotatedPoly) {
    if (!isNaN(rx) && !isNaN(ry)) {
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry);
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
    }
  }

  if (!isFinite(minY) || !isFinite(maxY) || minY >= maxY) {
    return { waypoints: [], flightLines: [], stats: null };
  }

  const margin = Math.max(0, config.marginBufferM || 0);
  minY -= margin;
  maxY += margin;

  const rawFlightLines: { y: number; segments: [number, number][] }[] = [];
  const lateralSpacing = Math.max(3, photoParams.lateralSpacingM || 15);
  const forwardSpacing = Math.max(2, photoParams.forwardSpacingM || 10);

  // Generate sweep lines from minY to maxY with safe bounds (max 120 lines to prevent CPU lock)
  const rawLineCount = Math.ceil((maxY - minY) / lateralSpacing);
  const lineCount = Math.min(120, Math.max(2, rawLineCount));
  const actualLateralStep = (maxY - minY) / lineCount;

  for (let i = 0; i <= lineCount; i++) {
    const y = minY + i * actualLateralStep;
    const intersections = findLinePolygonIntersections(y, rotatedPoly);

    // Pair intersections into valid segments inside polygon
    for (let j = 0; j < intersections.length - 1; j += 2) {
      const x1 = intersections[j] - margin;
      const x2 = intersections[j + 1] + margin;
      if (x2 > x1 && isFinite(x1) && isFinite(x2)) {
        rawFlightLines.push({ y, segments: [[x1, x2]] });
      }
    }
  }

  // Build sequenced waypoints (lawnmower pattern)
  const waypointsList: Waypoint[] = [];
  const flightLinesList: FlightLine[] = [];
  let isReversed = false;
  let waypointId = 1;
  let cumulativeDist = 0;
  let cumulativeTime = 0;
  let totalPhotos = 0;
  const maxWaypointsLimit = 1200;

  // Include optional takeoff initial waypoint
  if (takeoffPoint && !isNaN(takeoffPoint.lat) && !isNaN(takeoffPoint.lng)) {
    const utm = latLngToUtm(takeoffPoint.lat, takeoffPoint.lng);
    waypointsList.push({
      id: waypointId++,
      lat: takeoffPoint.lat,
      lng: takeoffPoint.lng,
      altitudeAgl: 0,
      altitudeMsl: 0,
      groundElevation: 0,
      speedMs: config.flightSpeedMs,
      action: 'takeoff',
      headingDeg: 0,
      gimbalPitchDeg: config.gimbalPitchDeg,
      distanceToNextM: 0,
      cumulativeDistanceM: 0,
      timeToNextSec: 0,
      cumulativeTimeSec: 0,
      utm,
      batchIndex: 0,
      isPhotoPoint: false
    });
  }

  // Generate main grid lines
  for (let lIdx = 0; lIdx < rawFlightLines.length; lIdx++) {
    if (waypointsList.length >= maxWaypointsLimit) break;

    const line = rawFlightLines[lIdx];
    const segment = line.segments[0];
    if (!segment) continue;

    let [xStart, xEnd] = segment;
    if (isReversed) {
      [xStart, xEnd] = [xEnd, xStart];
    }
    isReversed = !isReversed;

    const linePoints: [number, number][] = [];
    const segDist = Math.abs(xEnd - xStart);
    // Limit steps per flight line to safe number
    const rawSteps = Math.ceil(segDist / forwardSpacing);
    const steps = Math.min(80, Math.max(1, rawSteps));
    const stepSize = (xEnd - xStart) / steps;

    for (let s = 0; s <= steps; s++) {
      if (waypointsList.length >= maxWaypointsLimit) break;

      const rx = xStart + s * stepSize;
      const ry = line.y;

      // Rotate back by +stripAngle
      const lx = rx * cosA - ry * sinA;
      const ly = rx * sinA + ry * cosA;

      const [lat, lng] = fromLocalMeters(lx, ly, centroid[0], centroid[1]);
      if (isNaN(lat) || isNaN(lng)) continue;

      linePoints.push([lat, lng]);

      const isPhoto = s > 0 && s < steps;
      if (isPhoto) totalPhotos++;

      const utm = latLngToUtm(lat, lng);
      const wp: Waypoint = {
        id: waypointId++,
        lat,
        lng,
        altitudeAgl: config.targetAltitudeAgl,
        altitudeMsl: config.targetAltitudeAgl, // will be updated with SRTM
        groundElevation: 0,
        speedMs: config.flightSpeedMs,
        action: isPhoto ? 'photo' : 'turn',
        headingDeg: 0,
        gimbalPitchDeg: config.gimbalPitchDeg,
        distanceToNextM: 0,
        cumulativeDistanceM: 0,
        timeToNextSec: 0,
        cumulativeTimeSec: 0,
        utm,
        batchIndex: Math.floor((waypointId - 2) / (config.maxWaypointsPerFile || 200)),
        isPhotoPoint: isPhoto
      };
      waypointsList.push(wp);
    }

    if (linePoints.length > 0) {
      flightLinesList.push({
        id: lIdx + 1,
        points: linePoints,
        lengthM: segDist
      });
    }
  }

  // If Double Grid (Cross-Grid) is requested, add 90-degree transversal lines
  if (config.gridType === 'double' && waypointsList.length < maxWaypointsLimit) {
    const crossAngleRad = toRad((config.stripAngle + 90) % 360);
    const cosCross = Math.cos(crossAngleRad);
    const sinCross = Math.sin(crossAngleRad);

    const crossRotPoly: [number, number][] = localPoly.map(([x, y]) => [
      x * cosCross + y * sinCross,
      -x * sinCross + y * cosCross
    ]);

    let minCrossY = Infinity;
    let maxCrossY = -Infinity;
    for (const [rx, ry] of crossRotPoly) {
      if (!isNaN(rx) && !isNaN(ry)) {
        minCrossY = Math.min(minCrossY, ry);
        maxCrossY = Math.max(maxCrossY, ry);
      }
    }

    if (isFinite(minCrossY) && isFinite(maxCrossY) && minCrossY < maxCrossY) {
      minCrossY -= margin;
      maxCrossY += margin;

      const rawCrossLinesCount = Math.ceil((maxCrossY - minCrossY) / lateralSpacing);
      const crossLinesCount = Math.min(80, Math.max(2, rawCrossLinesCount));
      const crossStep = (maxCrossY - minCrossY) / crossLinesCount;

      for (let i = 0; i <= crossLinesCount; i++) {
        if (waypointsList.length >= maxWaypointsLimit) break;

        const y = minCrossY + i * crossStep;
        const intersections = findLinePolygonIntersections(y, crossRotPoly);

        for (let j = 0; j < intersections.length - 1; j += 2) {
          if (waypointsList.length >= maxWaypointsLimit) break;

          let x1 = intersections[j] - margin;
          let x2 = intersections[j + 1] + margin;

          if (x2 <= x1 || !isFinite(x1) || !isFinite(x2)) continue;

          if (isReversed) {
            [x1, x2] = [x2, x1];
          }
          isReversed = !isReversed;

          const linePoints: [number, number][] = [];
          const segDist = Math.abs(x2 - x1);
          const rawSteps = Math.ceil(segDist / forwardSpacing);
          const steps = Math.min(60, Math.max(1, rawSteps));
          const stepSize = (x2 - x1) / steps;

          for (let s = 0; s <= steps; s++) {
            if (waypointsList.length >= maxWaypointsLimit) break;

            const rx = x1 + s * stepSize;
            const ry = y;

            const lx = rx * cosCross - ry * sinCross;
            const ly = rx * sinCross + ry * cosCross;

            const [lat, lng] = fromLocalMeters(lx, ly, centroid[0], centroid[1]);
            if (isNaN(lat) || isNaN(lng)) continue;

            linePoints.push([lat, lng]);

            const isPhoto = s > 0 && s < steps;
            if (isPhoto) totalPhotos++;

            const utm = latLngToUtm(lat, lng);
            const wp: Waypoint = {
              id: waypointId++,
              lat,
              lng,
              altitudeAgl: config.targetAltitudeAgl,
              altitudeMsl: config.targetAltitudeAgl,
              groundElevation: 0,
              speedMs: config.flightSpeedMs,
              action: isPhoto ? 'photo' : 'turn',
              headingDeg: 0,
              gimbalPitchDeg: config.gimbalPitchDeg,
              distanceToNextM: 0,
              cumulativeDistanceM: 0,
              timeToNextSec: 0,
              cumulativeTimeSec: 0,
              utm,
              batchIndex: Math.floor((waypointId - 2) / (config.maxWaypointsPerFile || 200)),
              isPhotoPoint: isPhoto
            };
            waypointsList.push(wp);
          }

          if (linePoints.length > 0) {
            flightLinesList.push({
              id: flightLinesList.length + 1,
              points: linePoints,
              lengthM: segDist
            });
          }
        }
      }
    }
  }

  // Calculate bearings, distances, and cumulative metrics
  for (let i = 0; i < waypointsList.length; i++) {
    const curr = waypointsList[i];
    if (i < waypointsList.length - 1) {
      const next = waypointsList[i + 1];
      const dist = getDistanceM(curr.lat, curr.lng, next.lat, next.lng);
      const bearing = getBearing(curr.lat, curr.lng, next.lat, next.lng);
      const timeSec = config.flightSpeedMs > 0 ? dist / config.flightSpeedMs : 0;

      curr.distanceToNextM = Math.round(dist * 10) / 10;
      curr.headingDeg = Math.round(bearing);
      curr.timeToNextSec = Math.round(timeSec);

      cumulativeDist += dist;
      cumulativeTime += timeSec;
    } else {
      curr.distanceToNextM = 0;
      curr.timeToNextSec = 0;
      curr.headingDeg = waypointsList[i - 1]?.headingDeg || 0;
    }
    curr.cumulativeDistanceM = Math.round(cumulativeDist * 10) / 10;
    curr.cumulativeTimeSec = Math.round(cumulativeTime);
  }

  const totalAreaM2 = getPolygonAreaM2(polygon);
  const totalAreaHa = Math.round((totalAreaM2 / 10000) * 100) / 100;
  const flightTimeMins = cumulativeTime / 60;
  const safeTime = camera.safeFlightTimeMin || 20;
  const requiredBatteries = Math.max(1, Math.ceil(flightTimeMins / safeTime));
  const numBatches = Math.max(1, Math.ceil(waypointsList.length / config.maxWaypointsPerFile));

  const stats = {
    totalAreaHa,
    totalAreaM2: Math.round(totalAreaM2),
    totalDistanceM: Math.round(cumulativeDist),
    totalFlightTimeSec: Math.round(cumulativeTime),
    numFlightLines: flightLinesList.length,
    totalWaypoints: waypointsList.length,
    totalPhotos: Math.max(totalPhotos, waypointsList.filter((w) => w.isPhotoPoint).length),
    requiredBatteries,
    gsdCmPx: photoParams.gsdCmPx,
    forwardSpacingM: photoParams.forwardSpacingM,
    lateralSpacingM: photoParams.lateralSpacingM,
    footprintWidthM: photoParams.footprintWidthM,
    footprintHeightM: photoParams.footprintHeightM,
    minElevationM: 0,
    maxElevationM: 0,
    elevationDiffM: 0,
    numBatches
  };

  return { waypoints: waypointsList, flightLines: flightLinesList, stats };
}

/** Generate Corridor Linear Mission (roads, transmission lines, canals) */
export function generateCorridorMission(
  centerline: [number, number][],
  camera: DroneCameraProfile,
  config: FlightConfig,
  takeoffPoint?: { lat: number; lng: number }
): {
  waypoints: Waypoint[];
  flightLines: FlightLine[];
  stats: any;
} {
  if (centerline.length < 2) {
    return { waypoints: [], flightLines: [], stats: null };
  }

  const photoParams = calculatePhotogrammetryParameters(
    camera,
    config.targetAltitudeAgl,
    config.frontalOverlap,
    config.sideOverlap
  );

  const halfWidth = config.corridorWidthM / 2;
  const lateralStep = photoParams.lateralSpacingM;
  const numPasses = Math.max(1, Math.ceil(config.corridorWidthM / lateralStep));

  // Offsets for parallel passes relative to center
  const offsets: number[] = [];
  if (numPasses === 1) {
    offsets.push(0);
  } else {
    for (let i = 0; i < numPasses; i++) {
      const offset = -halfWidth + (i / (numPasses - 1)) * (2 * halfWidth);
      offsets.push(offset);
    }
  }

  const waypointsList: Waypoint[] = [];
  const flightLinesList: FlightLine[] = [];
  let waypointId = 1;
  let totalPhotos = 0;
  let cumulativeDist = 0;
  let cumulativeTime = 0;

  if (takeoffPoint) {
    const utm = latLngToUtm(takeoffPoint.lat, takeoffPoint.lng);
    waypointsList.push({
      id: waypointId++,
      lat: takeoffPoint.lat,
      lng: takeoffPoint.lng,
      altitudeAgl: 0,
      altitudeMsl: 0,
      groundElevation: 0,
      speedMs: config.flightSpeedMs,
      action: 'takeoff',
      headingDeg: 0,
      gimbalPitchDeg: config.gimbalPitchDeg,
      distanceToNextM: 0,
      cumulativeDistanceM: 0,
      timeToNextSec: 0,
      cumulativeTimeSec: 0,
      utm,
      batchIndex: 0,
      isPhotoPoint: false
    });
  }

  let isReversed = false;

  offsets.forEach((offset, passIdx) => {
    const path = isReversed ? [...centerline].reverse() : [...centerline];
    isReversed = !isReversed;

    const passPoints: [number, number][] = [];

    for (let i = 0; i < path.length; i++) {
      const curr = path[i];
      let bearing = 0;
      if (i < path.length - 1) {
        bearing = getBearing(curr[0], curr[1], path[i + 1][0], path[i + 1][1]);
      } else {
        bearing = getBearing(path[i - 1][0], path[i - 1][1], curr[0], curr[1]);
      }

      // Offset perpendicular to bearing
      const normalBearing = (bearing + 90) % 360;
      const offsetPoint = offset !== 0 ? getDestinationPoint(curr[0], curr[1], offset, normalBearing) : curr;
      passPoints.push(offsetPoint);
    }

    // Interpolate points along pass
    const densePoints: [number, number][] = [];
    for (let i = 0; i < passPoints.length - 1; i++) {
      const p1 = passPoints[i];
      const p2 = passPoints[i + 1];
      const segDist = getDistanceM(p1[0], p1[1], p2[0], p2[1]);
      const steps = Math.max(1, Math.ceil(segDist / photoParams.forwardSpacingM));

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const lat = p1[0] + t * (p2[0] - p1[0]);
        const lng = p1[1] + t * (p2[1] - p1[1]);
        densePoints.push([lat, lng]);

        const utm = latLngToUtm(lat, lng);
        totalPhotos++;
        waypointsList.push({
          id: waypointId++,
          lat,
          lng,
          altitudeAgl: config.targetAltitudeAgl,
          altitudeMsl: config.targetAltitudeAgl,
          groundElevation: 0,
          speedMs: config.flightSpeedMs,
          action: 'photo',
          headingDeg: 0,
          gimbalPitchDeg: config.gimbalPitchDeg,
          distanceToNextM: 0,
          cumulativeDistanceM: 0,
          timeToNextSec: 0,
          cumulativeTimeSec: 0,
          utm,
          batchIndex: Math.floor((waypointId - 2) / config.maxWaypointsPerFile),
          isPhotoPoint: true
        });
      }
    }

    const lastPt = passPoints[passPoints.length - 1];
    densePoints.push(lastPt);
    const utmLast = latLngToUtm(lastPt[0], lastPt[1]);
    waypointsList.push({
      id: waypointId++,
      lat: lastPt[0],
      lng: lastPt[1],
      altitudeAgl: config.targetAltitudeAgl,
      altitudeMsl: config.targetAltitudeAgl,
      groundElevation: 0,
      speedMs: config.flightSpeedMs,
      action: 'turn',
      headingDeg: 0,
      gimbalPitchDeg: config.gimbalPitchDeg,
      distanceToNextM: 0,
      cumulativeDistanceM: 0,
      timeToNextSec: 0,
      cumulativeTimeSec: 0,
      utm: utmLast,
      batchIndex: Math.floor((waypointId - 2) / config.maxWaypointsPerFile),
      isPhotoPoint: false
    });

    flightLinesList.push({
      id: passIdx + 1,
      points: densePoints,
      lengthM: 0
    });
  });

  // Calculate metrics
  for (let i = 0; i < waypointsList.length; i++) {
    const curr = waypointsList[i];
    if (i < waypointsList.length - 1) {
      const next = waypointsList[i + 1];
      const dist = getDistanceM(curr.lat, curr.lng, next.lat, next.lng);
      const bearing = getBearing(curr.lat, curr.lng, next.lat, next.lng);
      const timeSec = config.flightSpeedMs > 0 ? dist / config.flightSpeedMs : 0;

      curr.distanceToNextM = Math.round(dist * 10) / 10;
      curr.headingDeg = Math.round(bearing);
      curr.timeToNextSec = Math.round(timeSec);

      cumulativeDist += dist;
      cumulativeTime += timeSec;
    } else {
      curr.distanceToNextM = 0;
      curr.timeToNextSec = 0;
      curr.headingDeg = waypointsList[i - 1]?.headingDeg || 0;
    }
    curr.cumulativeDistanceM = Math.round(cumulativeDist * 10) / 10;
    curr.cumulativeTimeSec = Math.round(cumulativeTime);
  }

  // Corridor area approximation (length * corridorWidth)
  let centerlineLength = 0;
  for (let i = 0; i < centerline.length - 1; i++) {
    centerlineLength += getDistanceM(centerline[i][0], centerline[i][1], centerline[i + 1][0], centerline[i + 1][1]);
  }
  const totalAreaM2 = centerlineLength * config.corridorWidthM;
  const totalAreaHa = Math.round((totalAreaM2 / 10000) * 100) / 100;
  const flightTimeMins = cumulativeTime / 60;
  const safeTime = camera.safeFlightTimeMin || 20;

  const stats = {
    totalAreaHa,
    totalAreaM2: Math.round(totalAreaM2),
    totalDistanceM: Math.round(cumulativeDist),
    totalFlightTimeSec: Math.round(cumulativeTime),
    numFlightLines: flightLinesList.length,
    totalWaypoints: waypointsList.length,
    totalPhotos,
    requiredBatteries: Math.max(1, Math.ceil(flightTimeMins / safeTime)),
    gsdCmPx: photoParams.gsdCmPx,
    forwardSpacingM: photoParams.forwardSpacingM,
    lateralSpacingM: photoParams.lateralSpacingM,
    footprintWidthM: photoParams.footprintWidthM,
    footprintHeightM: photoParams.footprintHeightM,
    minElevationM: 0,
    maxElevationM: 0,
    elevationDiffM: 0,
    numBatches: Math.max(1, Math.ceil(waypointsList.length / config.maxWaypointsPerFile))
  };

  return { waypoints: waypointsList, flightLines: flightLinesList, stats };
}
