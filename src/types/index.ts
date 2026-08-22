export interface DroneCameraProfile {
  id: string;
  name: string;
  manufacturer: string;
  sensorWidthMm: number;
  sensorHeightMm: number;
  imageWidthPx: number;
  imageHeightPx: number;
  focalLengthMm: number;
  maxFlightTimeMin: number;
  safeFlightTimeMin: number;
  defaultSpeedMs: number;
  maxSpeedMs: number;
  hasMechanicalShutter: boolean;
  notes?: string;
  isCustom?: boolean;
}

export type AltitudeMode = 'AGL' | 'MSL' | 'TERRAIN_FOLLOW';

export type GridType = 'single' | 'double' | 'corridor' | 'perimeter';

export type FinishAction = 'RTH' | 'HOVER' | 'LAND' | 'GOTO_FIRST';

export type PhotoTriggerMode = 'distance' | 'time' | 'waypoint';

export type DrawingMode = 'none' | 'polygon' | 'corridor' | 'takeoff' | 'edit_polygon';

export interface TakeoffPoint {
  lat: number;
  lng: number;
  elevationMsl: number;
}

export interface FlightConfig {
  droneId: string;
  customCamera?: Partial<DroneCameraProfile>;
  altitudeMode: AltitudeMode;
  targetAltitudeAgl: number; // in meters AGL
  targetGsdCmPx?: number;
  flightSpeedMs: number;
  frontalOverlap: number; // e.g. 75%
  sideOverlap: number; // e.g. 65%
  stripAngle: number; // degrees 0-360
  autoAngle: boolean;
  gridType: GridType;
  corridorWidthM: number; // for corridor missions
  marginBufferM: number; // external/internal buffer
  gimbalPitchDeg: number; // -90 nadir, -60 oblique
  finishAction: FinishAction;
  maxWaypointsPerFile: number; // default 200 (DJI limit)
  photoTriggerMode: PhotoTriggerMode;
  terrainFollowEnabled: boolean;
  curvedTurns: boolean;
}

export interface UtmCoordinate {
  zone: number;
  hemisphere: 'N' | 'S';
  easting: number;
  northing: number;
  formatted: string;
}

export interface Waypoint {
  id: number;
  lat: number;
  lng: number;
  altitudeAgl: number;
  altitudeMsl: number;
  groundElevation: number;
  speedMs: number;
  action: 'photo' | 'turn' | 'takeoff' | 'land';
  headingDeg: number;
  gimbalPitchDeg: number;
  distanceToNextM: number;
  cumulativeDistanceM: number;
  timeToNextSec: number;
  cumulativeTimeSec: number;
  utm: UtmCoordinate;
  batchIndex: number;
  isPhotoPoint: boolean;
}

export interface FlightLine {
  id: number;
  points: [number, number][]; // [lat, lng]
  lengthM: number;
}

export interface MissionStats {
  totalAreaHa: number;
  totalAreaM2: number;
  totalDistanceM: number;
  totalFlightTimeSec: number;
  numFlightLines: number;
  totalWaypoints: number;
  totalPhotos: number;
  requiredBatteries: number;
  gsdCmPx: number;
  forwardSpacingM: number;
  lateralSpacingM: number;
  footprintWidthM: number;
  footprintHeightM: number;
  minElevationM: number;
  maxElevationM: number;
  elevationDiffM: number;
  numBatches: number;
}

export interface ElevationPoint {
  index: number;
  distanceM: number;
  groundElevationMsl: number;
  droneAltitudeMsl: number;
  clearanceAgl: number;
  waypointId: number;
  isPhoto: boolean;
}

export interface WeatherReport {
  stationIcao: string;
  temperatureC: number;
  windSpeedKt: number;
  windDirectionDeg: number;
  visibilityKm: number;
  condition: string;
  rawMetar: string;
  kpIndex: number;
  isGpsSafe: boolean;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  flightCondition: 'EXCELLENT' | 'GOOD' | 'CAUTION' | 'POOR';
}

export interface SimDronePosition {
  lat: number;
  lng: number;
  heading: number;
  altAgl: number;
  altMsl: number;
  speedMs: number;
  currentWpIndex: number;
  photosTaken: number;
  flownPath: [number, number][];
  isTakingPhoto?: boolean;
}
