import React, { useState } from 'react';
import { Waypoint, FlightConfig } from '../types';
import { Camera, RefreshCw, Layers, Search } from 'lucide-react';

interface WaypointsTableProps {
  waypoints: Waypoint[];
  config: FlightConfig;
  selectedWaypointId?: number | null;
  onSelectWaypoint?: (wp: Waypoint) => void;
}

export const WaypointsTable: React.FC<WaypointsTableProps> = ({
  waypoints,
  config,
  selectedWaypointId,
  onSelectWaypoint
}) => {
  const [filterBatch, setFilterBatch] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const numBatches = Math.max(1, Math.ceil(waypoints.length / (config.maxWaypointsPerFile || 200)));

  const filtered = waypoints.filter((wp) => {
    if (filterBatch !== 'all' && wp.batchIndex !== filterBatch) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        wp.id.toString().includes(term) ||
        wp.utm.formatted.toLowerCase().includes(term) ||
        wp.action.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Batch Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilterBatch('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              filterBatch === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todos ({waypoints.length})
          </button>
          {Array.from({ length: numBatches }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setFilterBatch(idx)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterBatch === idx ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Parte {idx + 1}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar WPT #..."
            className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 w-32 sm:w-40"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden max-h-[380px] overflow-y-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead className="bg-slate-900/90 text-slate-400 font-sans uppercase text-[10px] sticky top-0 backdrop-blur-md z-10 border-b border-slate-800">
            <tr>
              <th className="p-2.5">#</th>
              <th className="p-2.5">Ação</th>
              <th className="p-2.5">Alt (AGL)</th>
              <th className="p-2.5">Cota SRTM</th>
              <th className="p-2.5">Coordenadas UTM</th>
              <th className="p-2.5">Azimute</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filtered.slice(0, 250).map((wp) => {
              const isSelected = selectedWaypointId === wp.id;
              return (
                <tr
                  key={wp.id}
                  onClick={() => onSelectWaypoint && onSelectWaypoint(wp)}
                  className={`hover:bg-cyan-950/20 cursor-pointer transition-colors ${
                    isSelected ? 'bg-cyan-950/50 text-cyan-300 font-semibold' : ''
                  }`}
                >
                  <td className="p-2.5 font-bold text-slate-400">{wp.id}</td>
                  <td className="p-2.5">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        wp.isPhotoPoint
                          ? 'bg-blue-500/20 text-blue-400'
                          : wp.action === 'takeoff'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {wp.isPhotoPoint ? <Camera className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                      {wp.isPhotoPoint ? 'Foto' : wp.action === 'takeoff' ? 'Home' : 'Curva'}
                    </span>
                  </td>
                  <td className="p-2.5 font-bold text-cyan-400">{wp.altitudeAgl.toFixed(1)}m</td>
                  <td className="p-2.5 text-emerald-400">{wp.groundElevation.toFixed(1)}m</td>
                  <td className="p-2.5 text-slate-300 truncate max-w-[160px]">{wp.utm.formatted}</td>
                  <td className="p-2.5">{wp.headingDeg}°</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 250 && (
        <p className="text-[11px] text-slate-500 text-center font-sans">
          Mostrando os primeiros 250 de {filtered.length} waypoints. Todos serão exportados normalmente.
        </p>
      )}
    </div>
  );
};
