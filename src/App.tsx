import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DroneCameraProfile,
  FlightConfig,
  MissionStats,
  Waypoint,
  FlightLine,
  TakeoffPoint,
  ElevationPoint,
  SimDronePosition
} from './types';
import { DRONE_PROFILES, DEFAULT_FLIGHT_CONFIG } from './constants/drones';
import { SAMPLE_MISSIONS } from './constants/sampleMissions';
import {
  generateGridFlightMission,
  generateCorridorMission,
  calculateOptimalFlightAngle
} from './utils/geometry';
import { updateWaypointsWithTerrainData } from './utils/srtm';
import { exportDjiKmz, exportGoogleEarthKmz } from './utils/exporters';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ImportModal } from './components/ImportModal';

export default function App() {
  const [missionName, setMissionName] = useState('Missão_Mapeamento_01');
  const [selectedDrone, setSelectedDrone] = useState<DroneCameraProfile>(DRONE_PROFILES[0]);
  const [config, setConfig] = useState<FlightConfig>(DEFAULT_FLIGHT_CONFIG);

  // Geographic state (starts clean without initial flight plan)
  const [polygon, setPolygon] = useState<[number, number][]>([]);
  const [takeoffPoint, setTakeoffPoint] = useState<TakeoffPoint | undefined>(undefined);

  // Calculated flight plan
  const [flightLines, setFlightLines] = useState<FlightLine[]>([]);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [stats, setStats] = useState<MissionStats | null>(null);

  // Terrain elevation profile
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const [minElevation, setMinElevation] = useState<number>(0);
  const [maxElevation, setMaxElevation] = useState<number>(0);
  const [elevationDiff, setElevationDiff] = useState<number>(0);
  const [isRecalculatingTerrain, setIsRecalculatingTerrain] = useState<boolean>(false);

  // Map drawing state
  const [drawingMode, setDrawingMode] = useState<'none' | 'polygon' | 'corridor' | 'takeoff' | 'edit'>('none');
  const [selectedWaypointId, setSelectedWaypointId] = useState<number | null>(null);

  // Modals & Simulation
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simDronePosition, setSimDronePosition] = useState<SimDronePosition | null>(null);

  // Calculate flight mission whenever polygon, drone, or flight config changes
  useEffect(() => {
    if (polygon.length < 2) {
      setFlightLines([]);
      setWaypoints([]);
      setStats(null);
      setElevationProfile([]);
      return;
    }

    let missionResult: {
      waypoints: Waypoint[];
      flightLines: FlightLine[];
      stats: any;
    };

    if (config.gridType === 'corridor') {
      missionResult = generateCorridorMission(polygon, selectedDrone, config, takeoffPoint);
    } else {
      missionResult = generateGridFlightMission(polygon, selectedDrone, config, takeoffPoint);
    }

    setFlightLines(missionResult.flightLines);
    setWaypoints(missionResult.waypoints);
    setStats(missionResult.stats);

    // Update with SRTM terrain data
    let isCancelled = false;
    const fetchTerrain = async () => {
      setIsRecalculatingTerrain(true);
      try {
        const terrainResult = await updateWaypointsWithTerrainData(
          missionResult.waypoints,
          config.targetAltitudeAgl,
          takeoffPoint
        );

        if (!isCancelled) {
          setWaypoints(terrainResult.updatedWaypoints);
          setElevationProfile(terrainResult.elevationProfile);
          setMinElevation(terrainResult.minElevation);
          setMaxElevation(terrainResult.maxElevation);
          setElevationDiff(terrainResult.elevationDiff);

          if (missionResult.stats) {
            setStats({
              ...missionResult.stats,
              minElevationM: terrainResult.minElevation,
              maxElevationM: terrainResult.maxElevation,
              elevationDiffM: terrainResult.elevationDiff
            });
          }
        }
      } catch (err) {
        console.error('Failed to update terrain:', err);
      } finally {
        if (!isCancelled) setIsRecalculatingTerrain(false);
      }
    };

    fetchTerrain();

    return () => {
      isCancelled = true;
    };
  }, [
    polygon,
    selectedDrone,
    config.gridType,
    config.targetAltitudeAgl,
    config.frontalOverlap,
    config.sideOverlap,
    config.stripAngle,
    config.corridorWidthM,
    config.marginBufferM,
    config.flightSpeedMs,
    config.gimbalPitchDeg,
    config.curvedTurns,
    config.maxWaypointsPerFile,
    takeoffPoint
  ]);

  // Recalculate SRTM manually
  const handleRecalculateTerrain = async () => {
    if (waypoints.length === 0) return;
    setIsRecalculatingTerrain(true);
    try {
      const terrainResult = await updateWaypointsWithTerrainData(
        waypoints,
        config.targetAltitudeAgl,
        takeoffPoint
      );
      setWaypoints(terrainResult.updatedWaypoints);
      setElevationProfile(terrainResult.elevationProfile);
      setMinElevation(terrainResult.minElevation);
      setMaxElevation(terrainResult.maxElevation);
      setElevationDiff(terrainResult.elevationDiff);
    } finally {
      setIsRecalculatingTerrain(false);
    }
  };

  // Automatic optimal flight angle finder
  const handleAutoAngle = () => {
    if (polygon.length < 3) return;
    const optimal = calculateOptimalFlightAngle(polygon);
    setConfig((prev) => ({
      ...prev,
      stripAngle: optimal,
      autoAngle: true
    }));
  };

  // Load sample mission
  const handleLoadSampleMission = (missionId: string) => {
    const sample = SAMPLE_MISSIONS.find((m) => m.id === missionId);
    if (!sample) return;

    const drone = DRONE_PROFILES.find((d) => d.id === sample.droneId) || DRONE_PROFILES[0];
    setSelectedDrone(drone);
    setMissionName(sample.name);
    setPolygon(sample.polygon);
    setConfig((prev) => ({
      ...prev,
      droneId: drone.id,
      gridType: sample.gridType,
      targetAltitudeAgl: sample.targetAltitudeAgl,
      stripAngle: sample.stripAngle,
      frontalOverlap: sample.frontalOverlap,
      sideOverlap: sample.sideOverlap,
      corridorWidthM: sample.corridorWidthM || prev.corridorWidthM
    }));

    if (sample.polygon.length > 0) {
      setTakeoffPoint({
        lat: sample.polygon[0][0] - 0.0004,
        lng: sample.polygon[0][1] - 0.0004,
        elevationMsl: 500
      });
    }
  };

  // Handle polygon import from modal
  const handleImportPolygon = (newPoly: [number, number][], importedName?: string) => {
    setPolygon(newPoly);
    if (importedName) setMissionName(importedName);
    if (newPoly.length > 0) {
      setTakeoffPoint({
        lat: newPoly[0][0] - 0.0005,
        lng: newPoly[0][1] - 0.0005,
        elevationMsl: 500
      });
    }
  };

  const handleExportGoogleEarthKmz = async () => {
    if (waypoints.length === 0) return;
    await exportGoogleEarthKmz(missionName, polygon, waypoints, takeoffPoint, config.altitudeMode);
  };

  const handleExportDjiKmz = async () => {
    if (waypoints.length === 0) return;
    await exportDjiKmz(missionName, polygon, waypoints, selectedDrone, config, takeoffPoint);
  };

  return (
    <div className="flex flex-col w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Top Navbar */}
      <Header
        missionName={missionName}
        setMissionName={setMissionName}
        stats={stats}
        onOpenImportModal={() => setIsImportModalOpen(true)}
        onExportGoogleEarthKmz={handleExportGoogleEarthKmz}
        onExportDjiKmz={handleExportDjiKmz}
        waypointsCount={waypoints.length}
      />

      {/* Main Workspace: Left Map + Right Planning Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Interactive Map View */}
        <main className="flex-1 h-[50vh] lg:h-full relative overflow-hidden">
          <MapView
            polygon={polygon}
            setPolygon={setPolygon}
            flightLines={flightLines}
            waypoints={waypoints}
            takeoffPoint={takeoffPoint}
            setTakeoffPoint={setTakeoffPoint}
            selectedWaypointId={selectedWaypointId}
            onSelectWaypoint={(wp) => setSelectedWaypointId(wp.id)}
            isSimulating={isSimulating}
            simDronePosition={simDronePosition}
            gridType={config.gridType}
            drawingMode={drawingMode}
            setDrawingMode={setDrawingMode}
          />
        </main>

        {/* Right Planning Sidebar */}
        <Sidebar
          config={config}
          setConfig={setConfig}
          selectedDrone={selectedDrone}
          setSelectedDrone={setSelectedDrone}
          stats={stats}
          polygon={polygon}
          setPolygon={setPolygon}
          drawingMode={drawingMode}
          setDrawingMode={setDrawingMode}
          waypoints={waypoints}
          takeoffPoint={takeoffPoint}
          elevationProfile={elevationProfile}
          minElevation={minElevation}
          maxElevation={maxElevation}
          elevationDiff={elevationDiff}
          isRecalculatingTerrain={isRecalculatingTerrain}
          onRecalculateTerrain={handleRecalculateTerrain}
          onAutoAngle={handleAutoAngle}
          onLoadSampleMission={handleLoadSampleMission}
          onOpenImportModal={() => setIsImportModalOpen(true)}
          isSimulating={isSimulating}
          setIsSimulating={setIsSimulating}
          onDronePositionChange={setSimDronePosition}
          selectedWaypointId={selectedWaypointId}
          onSelectWaypoint={(wp) => setSelectedWaypointId(wp.id)}
        />
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportPolygon={handleImportPolygon}
      />
    </div>
  );
}
