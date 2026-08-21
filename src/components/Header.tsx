import React from 'react';
import { MissionStats } from '../types';
import {
  Compass,
  Clock,
  MapPin,
  Camera,
  Battery,
  Layers,
  Upload,
  Download,
  Share2,
  FolderOpen
} from 'lucide-react';

interface HeaderProps {
  missionName: string;
  setMissionName: (name: string) => void;
  stats: MissionStats | null;
  onOpenImportModal: () => void;
  onExportGoogleEarthKmz: () => void;
  onExportDjiKmz: () => void;
  waypointsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  missionName,
  setMissionName,
  stats,
  onOpenImportModal,
  onExportGoogleEarthKmz,
  onExportDjiKmz,
  waypointsCount
}) => {
  return (
    <header className="h-16 bg-slate-950 border-b border-slate-800 px-4 flex items-center justify-between z-30 shrink-0">
      {/* Brand & Mission Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Compass className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-white font-mono">
                Geo<span className="text-cyan-400">Fly</span>
              </span>
              <span className="text-[10px] uppercase font-bold bg-cyan-500/20 text-cyan-400 px-1.5 py-0.2 rounded border border-cyan-500/30">
                PRO
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
              Planejamento de Voo & Waypoints SRTM
            </span>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden md:block mx-1" />

        {/* Mission Name Input */}
        <input
          type="text"
          value={missionName}
          onChange={(e) => setMissionName(e.target.value)}
          className="bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent hover:border-slate-800 focus:border-slate-700 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-200 focus:outline-none transition-all max-w-[180px] sm:max-w-[240px] truncate"
          title="Clique para editar o nome da missão"
        />
      </div>

      {/* KPI Stats Bar */}
      {stats && (
        <div className="hidden xl:flex items-center gap-4 bg-slate-900/80 border border-slate-800/80 px-4 py-1.5 rounded-2xl shadow-inner text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-white font-mono">{stats.totalAreaHa}</span>
            <span className="text-[11px] text-slate-400">ha</span>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold text-white font-mono">
              {Math.floor(stats.totalFlightTimeSec / 60)}m {stats.totalFlightTimeSec % 60}s
            </span>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="flex items-center gap-1.5 text-slate-300">
            <Camera className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-white font-mono">{stats.totalPhotos}</span>
            <span className="text-[11px] text-slate-400">fotos</span>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="flex items-center gap-1.5 text-slate-300">
            <Battery className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-bold text-white font-mono">{stats.requiredBatteries}</span>
            <span className="text-[11px] text-slate-400">{stats.requiredBatteries > 1 ? 'baterias' : 'bateria'}</span>
          </div>

          <div className="h-3 w-px bg-slate-800" />

          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="text-[11px] text-slate-400">GSD:</span>
            <span className="font-bold text-cyan-400 font-mono">{stats.gsdCmPx} cm/px</span>
          </div>
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenImportModal}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 transition-colors"
          title="Importar polígono (.KML, .KMZ, .GeoJSON ou coordenadas)"
        >
          <Upload className="w-3.5 h-3.5 text-cyan-400" />
          <span>Importar</span>
        </button>

        <button
          id="btn-header-export-kmz"
          onClick={onExportGoogleEarthKmz}
          disabled={waypointsCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 hover:border-cyan-500/50 text-slate-200 rounded-xl text-xs font-bold transition-all"
          title="Baixar arquivo KMZ para Google Earth"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Baixar KMZ</span>
        </button>

        <button
          id="btn-header-export-dji-kmz"
          onClick={onExportDjiKmz}
          disabled={waypointsCount === 0}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 rounded-xl text-xs font-extrabold shadow-md shadow-cyan-500/25 transition-all"
          title="Baixar arquivo KMZ no formato oficial DJI WPML (para DJI Fly, DJI RC e DJI Pilot 2)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Baixar KMZ DJI</span>
        </button>
      </div>
    </header>
  );
};
