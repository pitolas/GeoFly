import React, { useState } from 'react';
import {
  DroneCameraProfile,
  FlightConfig,
  MissionStats,
  Waypoint,
  TakeoffPoint,
  ElevationPoint,
  GridType,
  SimDronePosition
} from '../types';
import { DRONE_PROFILES } from '../constants/drones';
import { SAMPLE_MISSIONS } from '../constants/sampleMissions';
import { calculateAltitudeFromGsd } from '../utils/geometry';
import {
  exportDjiKmz,
  exportGoogleEarthKmz,
  generateGoogleEarthKml,
  generateLitchiCsv,
  generateUtmTopographyCsv,
  generateGeoJson,
  downloadFile
} from '../utils/exporters';
import { ElevationProfileChart } from './ElevationProfileChart';
import { FlightSimulator } from './FlightSimulator';
import { PreflightChecklist } from './PreflightChecklist';
import { WaypointsTable } from './WaypointsTable';
import {
  Layers,
  Plane,
  Mountain,
  Sliders,
  Download,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Camera,
  RotateCw,
  Compass,
  Zap,
  Info,
  CheckCircle,
  Globe,
  HelpCircle,
  FolderOpen
} from 'lucide-react';

interface SidebarProps {
  missionName?: string;
  config: FlightConfig;
  setConfig: React.Dispatch<React.SetStateAction<FlightConfig>>;
  selectedDrone: DroneCameraProfile;
  setSelectedDrone: (drone: DroneCameraProfile) => void;
  stats: MissionStats | null;
  polygon: [number, number][];
  waypoints: Waypoint[];
  takeoffPoint?: TakeoffPoint;
  elevationProfile: ElevationPoint[];
  minElevation: number;
  maxElevation: number;
  elevationDiff: number;
  isRecalculatingTerrain: boolean;
  onRecalculateTerrain: () => void;
  onAutoAngle: () => void;
  onLoadSampleMission: (missionId: string) => void;
  onOpenImportModal: () => void;
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
  onDronePositionChange: (pos: SimDronePosition | null) => void;
  selectedWaypointId?: number | null;
  onSelectWaypoint?: (wp: Waypoint) => void;
}

export type SidebarTab = 'params' | 'terrain' | 'waypoints' | 'export' | 'simulation' | 'checklist';

export const Sidebar: React.FC<SidebarProps> = ({
  missionName = 'Missao_GeoFly',
  config,
  setConfig,
  selectedDrone,
  setSelectedDrone,
  stats,
  polygon,
  waypoints,
  takeoffPoint,
  elevationProfile,
  minElevation,
  maxElevation,
  elevationDiff,
  isRecalculatingTerrain,
  onRecalculateTerrain,
  onAutoAngle,
  onLoadSampleMission,
  onOpenImportModal,
  isSimulating,
  setIsSimulating,
  onDronePositionChange,
  selectedWaypointId,
  onSelectWaypoint
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('params');
  const [exportLoading, setExportLoading] = useState(false);
  const [showSamplesMenu, setShowSamplesMenu] = useState(false);

  const handleDroneChange = (droneId: string) => {
    const drone = DRONE_PROFILES.find((d) => d.id === droneId) || DRONE_PROFILES[0];
    setSelectedDrone(drone);
    setConfig((prev) => ({
      ...prev,
      droneId: drone.id,
      flightSpeedMs: drone.defaultSpeedMs
    }));
  };

  const handleAltitudeChange = (newAlt: number) => {
    setConfig((prev) => ({
      ...prev,
      targetAltitudeAgl: newAlt
    }));
  };

  const handleGsdChange = (newGsd: number) => {
    const calcAlt = calculateAltitudeFromGsd(selectedDrone, newGsd);
    setConfig((prev) => ({
      ...prev,
      targetAltitudeAgl: calcAlt
    }));
  };

  const handleExportDjiKmz = async () => {
    if (waypoints.length === 0) return;
    setExportLoading(true);
    try {
      await exportDjiKmz(missionName, polygon, waypoints, selectedDrone, config, takeoffPoint);
    } catch (err: any) {
      console.error('Error exporting DJI KMZ:', err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportGoogleEarthKmz = async () => {
    if (waypoints.length === 0) return;
    try {
      await exportGoogleEarthKmz(missionName, polygon, waypoints, takeoffPoint, config.altitudeMode);
    } catch (err: any) {
      console.error('Error exporting Google Earth KMZ:', err);
    }
  };

  const handleExportKml = () => {
    if (waypoints.length === 0) return;
    const kml = generateGoogleEarthKml(missionName, polygon, waypoints, takeoffPoint, config.altitudeMode);
    downloadFile(`${missionName}_GoogleEarth.kml`, kml, 'application/vnd.google-earth.kml+xml');
  };

  const handleExportLitchi = () => {
    if (waypoints.length === 0) return;
    const csv = generateLitchiCsv(waypoints, config);
    downloadFile(`${missionName}_Litchi.csv`, csv, 'text/csv');
  };

  const handleExportUtm = () => {
    if (waypoints.length === 0) return;
    const csv = generateUtmTopographyCsv(missionName, waypoints);
    downloadFile(`${missionName}_Coordenadas_UTM_Topografia.csv`, csv, 'text/csv');
  };

  const handleExportGeoJson = () => {
    if (waypoints.length === 0) return;
    const geojson = generateGeoJson(missionName, polygon, waypoints);
    downloadFile(`${missionName}_QGIS.geojson`, geojson, 'application/geo+json');
  };

  return (
    <aside className="w-full lg:w-[440px] bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden shadow-2xl z-20">
      {/* Navigation Tabs */}
      <div className="flex items-center bg-slate-950 border-b border-slate-800 px-2 py-2 gap-1 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('params')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'params'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Voo</span>
        </button>

        <button
          onClick={() => setActiveTab('terrain')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'terrain'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>Relevo SRTM</span>
        </button>

        <button
          onClick={() => setActiveTab('waypoints')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'waypoints'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Pontos ({waypoints.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('simulation')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'simulation'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          <span>Simulador</span>
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'export'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>

        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'checklist'
              ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Segurança</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-slate-200">
        {/* Quick Sample Mission Bar & Actions */}
        <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-2xl border border-slate-800">
          <div className="relative">
            <button
              onClick={() => setShowSamplesMenu(!showSamplesMenu)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Missões de Exemplo</span>
            </button>

            {showSamplesMenu && (
              <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl z-30 flex flex-col gap-1.5">
                <div className="px-2 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Carregar Missões Prontas
                </div>
                {SAMPLE_MISSIONS.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => {
                      onLoadSampleMission(sample.id);
                      setShowSamplesMenu(false);
                    }}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-800 transition-colors flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{sample.name}</span>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-semibold">
                        {sample.category}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 line-clamp-1">{sample.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onOpenImportModal}
            className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>Importar KML/KMZ</span>
          </button>
        </div>

        {/* TAB 1: FLIGHT PARAMETERS */}
        {activeTab === 'params' && (
          <div className="flex flex-col gap-4">
            {/* Drone & Sensor Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-cyan-400" />
                <span>Modelo de Drone & Câmera</span>
              </label>
              <select
                value={config.droneId}
                onChange={(e) => handleDroneChange(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-semibold text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {DRONE_PROFILES.map((drone) => (
                  <option key={drone.id} value={drone.id}>
                    {drone.name}
                  </option>
                ))}
              </select>
              {selectedDrone.notes && (
                <p className="text-[11px] text-slate-400 italic px-1">{selectedDrone.notes}</p>
              )}
            </div>

            {/* Grid Pattern Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Padrão de Mapeamento
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'single', label: 'Grelha Simples' },
                  { id: 'double', label: 'Dupla Cruzada' },
                  { id: 'corridor', label: 'Corredor Linear' },
                  { id: 'perimeter', label: 'Perímetro' }
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setConfig((prev) => ({ ...prev, gridType: type.id as GridType }))}
                    className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition-all ${
                      config.gridType === type.id
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Corridor Width (if Corridor mode) */}
            {config.gridType === 'corridor' && (
              <div className="flex flex-col gap-1.5 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">Largura da Faixa do Corredor:</span>
                  <span className="text-cyan-400 font-mono font-bold">{config.corridorWidthM} metros</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={250}
                  step={5}
                  value={config.corridorWidthM}
                  onChange={(e) => setConfig((prev) => ({ ...prev, corridorWidthM: Number(e.target.value) }))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            )}

            {/* Altitude & GSD Dual Synchronized Sliders */}
            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Altitude de Voo (AGL)</span>
                  <span className="text-[10px] text-slate-400">Acima do ponto de decolagem</span>
                </div>
                <div className="flex items-baseline gap-1 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
                  <span className="text-base font-bold font-mono text-cyan-400">
                    {config.targetAltitudeAgl}
                  </span>
                  <span className="text-xs text-slate-400">m</span>
                </div>
              </div>

              <input
                type="range"
                min={20}
                max={300}
                step={5}
                value={config.targetAltitudeAgl}
                onChange={(e) => handleAltitudeChange(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />

              {/* Resulting GSD */}
              <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-2.5">
                <span className="text-slate-400 font-medium">Resolução no Solo (GSD Estimado):</span>
                <span className="text-emerald-400 font-mono font-bold text-sm">
                  {stats ? stats.gsdCmPx : '1.8'} cm/pixel
                </span>
              </div>
            </div>

            {/* Overlap Sliders (Frontal & Lateral) */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Sobreposição Frontal</span>
                  <span className="text-cyan-400 font-mono">{config.frontalOverlap}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={5}
                  value={config.frontalOverlap}
                  onChange={(e) => setConfig((prev) => ({ ...prev, frontalOverlap: Number(e.target.value) }))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Sobreposição Lateral</span>
                  <span className="text-cyan-400 font-mono">{config.sideOverlap}%</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={85}
                  step={5}
                  value={config.sideOverlap}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sideOverlap: Number(e.target.value) }))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Flight Angle / Strip Direction */}
            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Direção das Linhas de Voo</span>
                </div>
                <button
                  onClick={onAutoAngle}
                  className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/40 border border-cyan-800/60 px-2 py-0.5 rounded-lg"
                  title="Calcular automaticamente o ângulo ideal para menor número de curvas"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Ângulo Otimizado</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={355}
                  step={5}
                  value={config.stripAngle}
                  onChange={(e) => setConfig((prev) => ({ ...prev, stripAngle: Number(e.target.value), autoAngle: false }))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <span className="font-mono text-sm font-bold text-cyan-400 w-12 text-right">
                  {config.stripAngle}°
                </span>
              </div>
            </div>

            {/* Flight Speed & Gimbal Pitch */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Velocidade de Voo</span>
                  <span className="text-emerald-400 font-mono">{config.flightSpeedMs} m/s</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={15}
                  step={0.5}
                  value={config.flightSpeedMs}
                  onChange={(e) => setConfig((prev) => ({ ...prev, flightSpeedMs: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 text-right">
                  {(config.flightSpeedMs * 3.6).toFixed(0)} km/h
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Inclinação Gimbal</span>
                  <span className="text-cyan-400 font-mono">{config.gimbalPitchDeg}°</span>
                </div>
                <select
                  value={config.gimbalPitchDeg}
                  onChange={(e) => setConfig((prev) => ({ ...prev, gimbalPitchDeg: Number(e.target.value) }))}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs font-semibold text-slate-200"
                >
                  <option value={-90}>-90° (Nadir - 2D Ortofoto)</option>
                  <option value={-70}>-70° (Oblíquo Suave)</option>
                  <option value={-60}>-60° (Oblíquo 3D)</option>
                  <option value={-45}>-45° (Fachadas / Inspeção)</option>
                </select>
              </div>
            </div>

            {/* Turn & Partition Settings */}
            <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Divisão Automática DJI (200 Waypoints)</span>
                  <span className="text-[10px] text-slate-400">Gera múltiplos KMZ se ultrapassar o limite</span>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {stats ? `${stats.numBatches} parte(s)` : '1 parte'}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-200">Curvas Suaves</span>
                  <span className="text-[10px] text-slate-400">Voo fluido contínuo sem paradas bruscas</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.curvedTurns}
                  onChange={(e) => setConfig((prev) => ({ ...prev, curvedTurns: e.target.checked }))}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TERRAIN FOLLOW (SRTM) */}
        {activeTab === 'terrain' && (
          <div className="flex flex-col gap-4">
            <div className="bg-gradient-to-br from-emerald-950/40 to-slate-950 p-4 rounded-3xl border border-emerald-800/40 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mountain className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-emerald-300">
                    Acompanhamento de Terreno SRTM
                  </h3>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                  GRATUITO
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                O GeoFly ajusta a altitude de cada waypoint individualmente com base no modelo digital de elevação SRTM, garantindo que o drone mantenha sempre a mesma distância do solo (GSD uniforme e segurança total contra morros e aclives).
              </p>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={onRecalculateTerrain}
                  disabled={isRecalculatingTerrain || waypoints.length === 0}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isRecalculatingTerrain ? 'animate-spin' : ''}`} />
                  <span>{isRecalculatingTerrain ? 'Consultando SRTM...' : 'Recalcular Relevo Agora'}</span>
                </button>

                {takeoffPoint && (
                  <span className="text-xs font-mono text-emerald-400">
                    Home: {takeoffPoint.elevationMsl.toFixed(1)}m
                  </span>
                )}
              </div>
            </div>

            {/* Elevation Chart */}
            <ElevationProfileChart
              data={elevationProfile}
              minElevation={minElevation}
              maxElevation={maxElevation}
              elevationDiff={elevationDiff}
              targetAltitudeAgl={config.targetAltitudeAgl}
            />

            {/* Topography tips */}
            <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800 flex flex-col gap-1.5 text-xs text-slate-400">
              <span className="font-bold text-slate-200 uppercase text-[10px] tracking-wider">
                Como Funciona a Cota Relativa
              </span>
              <p>
                Os drones DJI e Litchi executam voos com altitude relativa ao ponto onde decolaram (Home Point). O GeoFly calcula a fórmula matemática:
              </p>
              <div className="bg-slate-900 p-2 rounded-xl font-mono text-[11px] text-cyan-300">
                Alt_Waypoint = Alt_Alvo_AGL + (Cota_Solo_SRTM - Cota_Decolagem)
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WAYPOINTS TABLE */}
        {activeTab === 'waypoints' && (
          <WaypointsTable
            waypoints={waypoints}
            config={config}
            selectedWaypointId={selectedWaypointId}
            onSelectWaypoint={onSelectWaypoint}
          />
        )}

        {/* TAB 4: FLIGHT SIMULATION */}
        {activeTab === 'simulation' && (
          <FlightSimulator
            waypoints={waypoints}
            config={config}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
            onDronePositionChange={onDronePositionChange}
          />
        )}

        {/* TAB 5: EXPORT OPTIONS */}
        {activeTab === 'export' && (
          <div className="flex flex-col gap-3">
            {/* Primary DJI KMZ Export Card */}
            <div className="bg-gradient-to-br from-cyan-950/50 via-slate-950 to-slate-950 p-4 rounded-3xl border border-cyan-800/60 flex flex-col gap-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plane className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Exportar para DJI Fly / DJI Pilot 2 (.KMZ)
                  </h3>
                </div>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-400 font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                  WPML Oficial
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Gera o arquivo KMZ com tags WPML completas, velocidade, disparos automáticos de fotos e acompanhamento de relevo SRTM. Se a missão tiver mais de 200 pontos, é automaticamente particionada em partes separadas (Parte 1, Parte 2...).
              </p>

              <button
                id="btn-export-dji-kmz"
                onClick={handleExportDjiKmz}
                disabled={exportLoading || waypoints.length === 0}
                className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-extrabold py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {exportLoading
                    ? 'Empacotando KMZ DJI...'
                    : `Baixar KMZ DJI (${waypoints.length} waypoints)`}
                </span>
              </button>
            </div>

            {/* Google Earth KMZ Card */}
            <div className="bg-slate-950/90 p-4 rounded-3xl border border-slate-800 flex flex-col gap-2.5 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Google Earth (.KMZ)
                  </h3>
                </div>
                <span className="text-[10px] bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                  Compactado KMZ
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Arquivo KMZ compactado contendo doc.kml com polígono, caminho 3D e waypoints para visualização no Google Earth Pro ou Web.
              </p>

              <button
                id="btn-export-google-earth-kmz"
                onClick={handleExportGoogleEarthKmz}
                disabled={waypoints.length === 0}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 disabled:opacity-50 text-slate-100 font-bold py-2.5 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Baixar KMZ (Google Earth)</span>
              </button>
            </div>

            {/* Other Formats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleExportKml}
                disabled={waypoints.length === 0}
                className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left flex flex-col gap-1 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400">
                    Google Earth 3D (.KML)
                  </span>
                  <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                </div>
                <span className="text-[11px] text-slate-400">
                  Visualização 3D de relevo e vértices no Google Earth Pro
                </span>
              </button>

              <button
                onClick={handleExportLitchi}
                disabled={waypoints.length === 0}
                className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left flex flex-col gap-1 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400">
                    Litchi Mission (.CSV)
                  </span>
                  <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                </div>
                <span className="text-[11px] text-slate-400">
                  Importação direta no Litchi Mission Hub
                </span>
              </button>

              <button
                onClick={handleExportUtm}
                disabled={waypoints.length === 0}
                className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left flex flex-col gap-1 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400">
                    Coordenadas UTM (.CSV)
                  </span>
                  <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                </div>
                <span className="text-[11px] text-slate-400">
                  Topografia (Este, Norte, Cota Z, SIRGAS/WGS84)
                </span>
              </button>

              <button
                onClick={handleExportGeoJson}
                disabled={waypoints.length === 0}
                className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left flex flex-col gap-1 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400">
                    QGIS / ArcGIS (.GeoJSON)
                  </span>
                  <Download className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                </div>
                <span className="text-[11px] text-slate-400">
                  Camadas vetoriais para SIG e softwares de mapeamento
                </span>
              </button>
            </div>

            {/* Step by step guide for loading into DJI */}
            <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex flex-col gap-2.5 mt-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>Como importar e voar no DJI Fly / RC / Pilot:</span>
              </span>
              <div className="flex flex-col gap-2 text-xs text-slate-300">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1">
                  <span className="font-bold text-cyan-400 text-[11px]">DJI Fly (Mini 4 Pro / Air 3 / Mavic 3 / RC / RC 2):</span>
                  <ol className="list-decimal list-inside text-slate-400 space-y-0.5 text-[11px] leading-relaxed">
                    <li>Copie o arquivo <b>.KMZ</b> baixado para o controle ou celular.</li>
                    <li>Pasta padrão no Android: <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded text-[10px]">Android/data/dji.go.v5/files/waypoint</code></li>
                    <li>No DJI Fly: abra a câmera, toque no ícone de <b>Waypoints</b> à esquerda, abra a <b>Biblioteca</b> e clique no ícone de <b>Importar KMZ</b>.</li>
                  </ol>
                </div>

                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1">
                  <span className="font-bold text-emerald-400 text-[11px]">DJI Pilot 2 (Mavic 3 Enterprise / M3M / Matrice 350):</span>
                  <ol className="list-decimal list-inside text-slate-400 space-y-0.5 text-[11px] leading-relaxed">
                    <li>No menu principal do DJI Pilot 2, entre em <b>Rota de Voo (Flight Route)</b>.</li>
                    <li>Toque em <b>Importar Rota (KMZ)</b> e selecione o arquivo gerado.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PREFLIGHT CHECKLIST & REGULATIONS */}
        {activeTab === 'checklist' && <PreflightChecklist />}
      </div>
    </aside>
  );
};
