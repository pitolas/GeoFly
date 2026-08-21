import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { ElevationPoint } from '../types';
import { Mountain, ArrowUpRight, TrendingUp, AlertTriangle } from 'lucide-react';

interface ElevationProfileChartProps {
  data: ElevationPoint[];
  minElevation: number;
  maxElevation: number;
  elevationDiff: number;
  targetAltitudeAgl: number;
  onHoverPoint?: (waypointId: number | null) => void;
}

export const ElevationProfileChart: React.FC<ElevationProfileChartProps> = ({
  data,
  minElevation,
  maxElevation,
  elevationDiff,
  targetAltitudeAgl,
  onHoverPoint
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800">
        <Mountain className="w-10 h-10 text-slate-600 mb-2" />
        <p className="text-sm font-medium">Nenhum dado de relevo disponível</p>
        <p className="text-xs text-slate-500 mt-1">Desenhe uma área no mapa para calcular o perfil altimétrico SRTM.</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((pt) => ({
    dist: Math.round(pt.distanceM),
    ground: pt.groundElevationMsl,
    drone: pt.droneAltitudeMsl,
    clearance: pt.clearanceAgl,
    id: pt.waypointId,
    isPhoto: pt.isPhoto
  }));

  const yMin = Math.max(0, Math.floor(minElevation - 10));
  const yMax = Math.ceil(maxElevation + targetAltitudeAgl + 15);

  return (
    <div className="flex flex-col gap-3 bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 border border-slate-800">
      {/* Top metrics bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Cota Mínima</span>
          <span className="text-sm font-bold text-slate-200 mt-0.5">{minElevation.toFixed(1)} m</span>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Cota Máxima</span>
          <span className="text-sm font-bold text-slate-200 mt-0.5">{maxElevation.toFixed(1)} m</span>
        </div>
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-col">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Desnível (ΔZ)</span>
          <span className="text-sm font-bold text-cyan-400 mt-0.5">±{elevationDiff.toFixed(1)} m</span>
        </div>
      </div>

      {/* Recharts Elevation Profile Chart */}
      <div className="h-48 w-full mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            onMouseMove={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                const payload = state.activePayload[0].payload;
                if (onHoverPoint) onHoverPoint(payload.id);
              }
            }}
            onMouseLeave={() => {
              if (onHoverPoint) onHoverPoint(null);
            }}
          >
            <defs>
              <linearGradient id="groundFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="dist"
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(v) => `${v}m`}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(v) => `${v}m`}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload;
                  return (
                    <div className="bg-slate-950/95 border border-slate-700 p-2.5 rounded-xl shadow-2xl text-xs font-mono">
                      <div className="text-slate-300 font-bold mb-1">
                        WPT #{p.id} ({p.dist} m de voo)
                      </div>
                      <div className="text-emerald-400 flex items-center justify-between gap-4">
                        <span>Solo SRTM:</span>
                        <span className="font-semibold">{p.ground.toFixed(1)} m</span>
                      </div>
                      <div className="text-amber-400 flex items-center justify-between gap-4">
                        <span>Drone MSL:</span>
                        <span className="font-semibold">{p.drone.toFixed(1)} m</span>
                      </div>
                      <div className="text-cyan-400 flex items-center justify-between gap-4">
                        <span>Altura Solo (AGL):</span>
                        <span className="font-semibold">{p.clearance.toFixed(1)} m</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="ground"
              name="Relevo do Solo"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#groundFill)"
            />
            <Line
              type="monotone"
              dataKey="drone"
              name="Altitude Drone (MSL)"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend & Advice */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Relevo (SRTM)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-amber-500" />
            <span>Linha de Voo ({targetAltitudeAgl}m AGL constante)</span>
          </div>
        </div>
        {elevationDiff > 30 && (
          <div className="flex items-center gap-1 text-amber-400 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Acompanhamento recomendado</span>
          </div>
        )}
      </div>
    </div>
  );
};
