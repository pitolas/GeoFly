import React, { useEffect, useState, useRef } from 'react';
import { Waypoint, FlightConfig } from '../types';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Camera,
  Battery,
  Compass,
  Zap,
  FastForward,
  Navigation,
  Wind
} from 'lucide-react';

interface FlightSimulatorProps {
  waypoints: Waypoint[];
  config: FlightConfig;
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
  onDronePositionChange: (pos: { lat: number; lng: number; heading: number; altAgl: number; altMsl: number } | null) => void;
}

export const FlightSimulator: React.FC<FlightSimulatorProps> = ({
  waypoints,
  config,
  isSimulating,
  setIsSimulating,
  onDronePositionChange
}) => {
  const [currentWpIndex, setCurrentWpIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(2); // 2x default
  const [photosTaken, setPhotosTaken] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const totalTimeSec = waypoints[waypoints.length - 1]?.cumulativeTimeSec || 1;

  // Handle Play/Pause and animation loop
  useEffect(() => {
    if (!isSimulating || waypoints.length < 2) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const deltaSec = ((timestamp - lastTimeRef.current) / 1000) * playbackSpeed;
      lastTimeRef.current = timestamp;

      setElapsedSec((prev) => {
        const nextSec = prev + deltaSec;
        if (nextSec >= totalTimeSec) {
          setIsSimulating(false);
          return totalTimeSec;
        }

        // Find corresponding waypoint interpolation
        let targetIndex = 0;
        for (let i = 0; i < waypoints.length; i++) {
          if (waypoints[i].cumulativeTimeSec >= nextSec) {
            targetIndex = i;
            break;
          }
        }

        setCurrentWpIndex(targetIndex);

        // Interpolate position between waypoints[targetIndex - 1] and waypoints[targetIndex]
        const p1 = targetIndex > 0 ? waypoints[targetIndex - 1] : waypoints[0];
        const p2 = waypoints[targetIndex] || waypoints[waypoints.length - 1];

        const segDuration = Math.max(0.1, p2.cumulativeTimeSec - p1.cumulativeTimeSec);
        const segProgress = Math.min(1, Math.max(0, (nextSec - p1.cumulativeTimeSec) / segDuration));

        const lat = p1.lat + (p2.lat - p1.lat) * segProgress;
        const lng = p1.lng + (p2.lng - p1.lng) * segProgress;
        const altAgl = p1.altitudeAgl + (p2.altitudeAgl - p1.altitudeAgl) * segProgress;
        const altMsl = p1.altitudeMsl + (p2.altitudeMsl - p1.altitudeMsl) * segProgress;
        const heading = p1.headingDeg;

        onDronePositionChange({ lat, lng, heading, altAgl, altMsl });

        // Photos taken count
        const photos = waypoints.slice(0, targetIndex + 1).filter((w) => w.isPhotoPoint).length;
        setPhotosTaken(photos);

        return nextSec;
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isSimulating, waypoints, playbackSpeed, totalTimeSec, onDronePositionChange, setIsSimulating]);

  const handleReset = () => {
    setIsSimulating(false);
    setElapsedSec(0);
    setCurrentWpIndex(0);
    setPhotosTaken(0);
    onDronePositionChange(null);
  };

  const handleTogglePlay = () => {
    if (waypoints.length < 2) return;
    if (elapsedSec >= totalTimeSec) {
      setElapsedSec(0);
    }
    setIsSimulating(!isSimulating);
  };

  const currentWp = waypoints[currentWpIndex] || waypoints[0];
  const batteryPct = Math.max(5, Math.round(100 - (elapsedSec / (25 * 60)) * 100));
  const progressPct = Math.min(100, Math.round((elapsedSec / totalTimeSec) * 100));

  if (waypoints.length < 2) return null;

  return (
    <div className="flex flex-col gap-3 bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isSimulating ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Simulador de Telemetria de Voo
          </h3>
        </div>

        {/* Speed multiplier selector */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          {[1, 2, 5, 10].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                playbackSpeed === spd ? 'bg-cyan-500 text-slate-950 font-extrabold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Primary Telemetry Instrument Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400 font-sans uppercase">Altitude AGL</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-cyan-400">
              {currentWp ? currentWp.altitudeAgl.toFixed(1) : '0.0'}
            </span>
            <span className="text-[10px] text-slate-400">m</span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400 font-sans uppercase">Velocidade</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-emerald-400">
              {config.flightSpeedMs.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400">m/s ({(config.flightSpeedMs * 3.6).toFixed(0)} km/h)</span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400 font-sans uppercase">Fotos Registradas</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-base font-bold text-amber-400">{photosTaken}</span>
            <span className="text-[10px] text-slate-400">capturas</span>
          </div>
        </div>

        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400 font-sans uppercase">Bateria Estimada</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-base font-bold ${
                batteryPct > 30 ? 'text-emerald-400' : batteryPct > 15 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {batteryPct}%
            </span>
            <Battery className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Progress scrubber bar */}
      <div className="flex flex-col gap-1 mt-1">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>
            Tempo: {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toFixed(0).padStart(2, '0')}
          </span>
          <span>
            WPT #{currentWp?.id || 1} de {waypoints.length} ({progressPct}%)
          </span>
          <span>
            Total: {Math.floor(totalTimeSec / 60)}:{(totalTimeSec % 60).toFixed(0).padStart(2, '0')}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 cursor-pointer">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-75"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            id="btn-play-sim"
            onClick={handleTogglePlay}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              isSimulating
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 hover:bg-amber-400'
                : 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 hover:bg-cyan-400'
            }`}
          >
            {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isSimulating ? 'Pausar Voo' : 'Iniciar Simulação'}</span>
          </button>

          <button
            id="btn-reset-sim"
            onClick={handleReset}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-slate-800"
            title="Reiniciar simulador"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          Azimute Drone: <span className="text-cyan-400 font-bold">{currentWp?.headingDeg || 0}°</span>
        </div>
      </div>
    </div>
  );
};
