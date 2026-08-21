import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Waypoint, FlightConfig, SimDronePosition } from '../types';
import { getDistanceM, getBearing } from '../utils/geometry';
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
  Crosshair,
  Radio,
  CheckCircle2
} from 'lucide-react';

interface FlightSimulatorProps {
  waypoints: Waypoint[];
  config: FlightConfig;
  isSimulating: boolean;
  setIsSimulating: (sim: boolean) => void;
  onDronePositionChange: (pos: SimDronePosition | null) => void;
}

export const FlightSimulator: React.FC<FlightSimulatorProps> = ({
  waypoints,
  config,
  isSimulating,
  setIsSimulating,
  onDronePositionChange
}) => {
  const [currentWpIndex, setCurrentWpIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(3); // 3x default for smooth overview
  const [photosTaken, setPhotosTaken] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [followDrone, setFollowDrone] = useState(true);

  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const elapsedSecRef = useRef<number>(0);
  const isSimulatingRef = useRef<boolean>(isSimulating);
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  const onDronePositionChangeRef = useRef(onDronePositionChange);
  const lastPhotoTriggerWpIndex = useRef<number>(-1);

  // Keep refs synchronized
  isSimulatingRef.current = isSimulating;
  playbackSpeedRef.current = playbackSpeed;
  onDronePositionChangeRef.current = onDronePositionChange;

  // Build timeline for all waypoints with exact accumulated distances and times
  const timeline = useMemo(() => {
    if (waypoints.length < 2) return { points: [], totalDurationSec: 1, totalDistanceM: 0 };

    const speed = Math.max(1, config.flightSpeedMs || 10);
    const points: {
      wp: Waypoint;
      timeStartSec: number;
      timeEndSec: number;
      durationSec: number;
      segmentDistM: number;
      cumDistM: number;
      bearing: number;
    }[] = [];

    let currentCumSec = 0;
    let currentCumDist = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const curr = waypoints[i];
      const next = waypoints[i + 1];
      const dist = getDistanceM(curr.lat, curr.lng, next.lat, next.lng);
      const segTime = dist / speed;
      const bearing = getBearing(curr.lat, curr.lng, next.lat, next.lng);

      points.push({
        wp: curr,
        timeStartSec: currentCumSec,
        timeEndSec: currentCumSec + segTime,
        durationSec: segTime,
        segmentDistM: dist,
        cumDistM: currentCumDist,
        bearing
      });

      currentCumSec += segTime;
      currentCumDist += dist;
    }

    return {
      points,
      totalDurationSec: Math.max(1, currentCumSec),
      totalDistanceM: currentCumDist
    };
  }, [waypoints, config.flightSpeedMs]);

  // Interpolate state at any given second
  const computeStateAtTime = (tSec: number): SimDronePosition => {
    if (waypoints.length < 2 || timeline.points.length === 0) {
      const wp = waypoints[0] || { lat: 0, lng: 0, altitudeAgl: 0, altitudeMsl: 0, headingDeg: 0 };
      return {
        lat: wp.lat,
        lng: wp.lng,
        heading: wp.headingDeg,
        altAgl: wp.altitudeAgl,
        altMsl: wp.altitudeMsl,
        speedMs: config.flightSpeedMs,
        currentWpIndex: 0,
        photosTaken: 0,
        flownPath: [[wp.lat, wp.lng]]
      };
    }

    const clampedSec = Math.max(0, Math.min(tSec, timeline.totalDurationSec));

    // Find the active segment
    let segIdx = 0;
    for (let i = 0; i < timeline.points.length; i++) {
      if (clampedSec <= timeline.points[i].timeEndSec || i === timeline.points.length - 1) {
        segIdx = i;
        break;
      }
    }

    const seg = timeline.points[segIdx];
    const wpA = waypoints[segIdx];
    const wpB = waypoints[segIdx + 1] || wpA;

    const segProgress =
      seg.durationSec > 0.001
        ? Math.max(0, Math.min(1, (clampedSec - seg.timeStartSec) / seg.durationSec))
        : 1;

    // Linear interpolation
    const lat = wpA.lat + (wpB.lat - wpA.lat) * segProgress;
    const lng = wpA.lng + (wpB.lng - wpA.lng) * segProgress;
    const altAgl = wpA.altitudeAgl + (wpB.altitudeAgl - wpA.altitudeAgl) * segProgress;
    const altMsl = wpA.altitudeMsl + (wpB.altitudeMsl - wpA.altitudeMsl) * segProgress;
    const heading = seg.bearing;

    // Build flown path breadcrumbs
    const path: [number, number][] = [];
    for (let i = 0; i <= segIdx; i++) {
      path.push([waypoints[i].lat, waypoints[i].lng]);
    }
    path.push([lat, lng]);

    // Count photos taken up to current segment
    const photos = waypoints.slice(0, segIdx + 1).filter((w) => w.isPhotoPoint).length;

    // Check if we just hit a photo point
    const isTakingPhoto = wpA.isPhotoPoint && segProgress < 0.2;

    return {
      lat,
      lng,
      heading,
      altAgl,
      altMsl,
      speedMs: config.flightSpeedMs,
      currentWpIndex: segIdx,
      photosTaken: photos,
      flownPath: path,
      isTakingPhoto
    };
  };

  // Main simulation animation loop
  useEffect(() => {
    if (!isSimulating || waypoints.length < 2) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTimestampRef.current = null;
      return;
    }

    // Immediately push initial drone position on starting simulation
    const initialState = computeStateAtTime(elapsedSecRef.current);
    onDronePositionChangeRef.current(initialState);

    const loop = (timestamp: number) => {
      if (!isSimulatingRef.current) return;

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const deltaMs = timestamp - lastTimestampRef.current;
      lastTimestampRef.current = timestamp;

      // Advance clock in seconds with playback speed
      const deltaSec = (deltaMs / 1000) * playbackSpeedRef.current;
      elapsedSecRef.current += deltaSec;

      if (elapsedSecRef.current >= timeline.totalDurationSec) {
        elapsedSecRef.current = timeline.totalDurationSec;
        const finalState = computeStateAtTime(timeline.totalDurationSec);
        onDronePositionChangeRef.current(finalState);
        setElapsedSec(timeline.totalDurationSec);
        setIsSimulating(false);
        return;
      }

      const state = computeStateAtTime(elapsedSecRef.current);
      onDronePositionChangeRef.current(state);

      // Update UI state
      setElapsedSec(elapsedSecRef.current);
      setCurrentWpIndex(state.currentWpIndex);
      setPhotosTaken(state.photosTaken);

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTimestampRef.current = null;
    };
  }, [isSimulating, waypoints, timeline, config.flightSpeedMs, setIsSimulating]);

  const handleTogglePlay = () => {
    if (waypoints.length < 2) return;
    if (elapsedSecRef.current >= timeline.totalDurationSec) {
      elapsedSecRef.current = 0;
      setElapsedSec(0);
    }
    setIsSimulating(!isSimulating);
  };

  const handleReset = () => {
    setIsSimulating(false);
    elapsedSecRef.current = 0;
    setElapsedSec(0);
    setCurrentWpIndex(0);
    setPhotosTaken(0);
    lastTimestampRef.current = null;
    if (waypoints.length > 0) {
      const initial = computeStateAtTime(0);
      onDronePositionChange(initial);
    } else {
      onDronePositionChange(null);
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSec = parseFloat(e.target.value);
    elapsedSecRef.current = newSec;
    setElapsedSec(newSec);
    const state = computeStateAtTime(newSec);
    setCurrentWpIndex(state.currentWpIndex);
    setPhotosTaken(state.photosTaken);
    onDronePositionChange(state);
  };

  const currentWp = waypoints[currentWpIndex] || waypoints[0];
  const totalTimeSec = timeline.totalDurationSec;
  const progressPct = Math.min(100, Math.round((elapsedSec / totalTimeSec) * 100));
  const batteryPct = Math.max(5, Math.round(100 - (elapsedSec / (25 * 60)) * 100));

  if (waypoints.length < 2) {
    return (
      <div className="bg-slate-950/70 p-6 rounded-3xl border border-slate-800 text-center flex flex-col items-center gap-3">
        <Navigation className="w-8 h-8 text-slate-600 animate-pulse" />
        <span className="text-sm font-bold text-slate-300">Nenhum plano de voo disponível</span>
        <p className="text-xs text-slate-500 max-w-xs">
          Desenhe um polígono no mapa ou carregue uma missão de exemplo para habilitar a simulação em tempo real.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-3xl p-4 border border-slate-800 shadow-2xl">
      {/* Simulator Header & Speed Selectors */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full flex items-center justify-center transition-all ${
              isSimulating ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50' : 'bg-slate-700'
            }`}
          >
            {isSimulating && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
          </div>
          <div className="flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100 flex items-center gap-1.5">
              <span>Simulador de Telemetria de Voo</span>
            </h3>
            <span className="text-[10px] text-cyan-400 font-medium">
              {isSimulating ? 'Voo em execução no mapa' : 'Pronto para simular'}
            </span>
          </div>
        </div>

        {/* Speed multipliers */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {[1, 2, 3, 5, 10].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaybackSpeed(spd)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                playbackSpeed === spd
                  ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>

      {/* Primary Cockpit Instruments Display */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800/80 flex flex-col">
          <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Altitude AGL</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-extrabold text-cyan-400">
              {currentWp ? currentWp.altitudeAgl.toFixed(1) : '0.0'}
            </span>
            <span className="text-[10px] text-slate-400">m</span>
          </div>
          <span className="text-[9px] text-slate-500 font-sans">
            MSL: {currentWp ? currentWp.altitudeMsl.toFixed(1) : '0'}m
          </span>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800/80 flex flex-col">
          <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Velocidade</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-extrabold text-emerald-400">
              {config.flightSpeedMs.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400">m/s</span>
          </div>
          <span className="text-[9px] text-slate-500 font-sans">
            {(config.flightSpeedMs * 3.6).toFixed(0)} km/h
          </span>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800/80 flex flex-col">
          <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Fotos Capturadas</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base font-extrabold text-amber-400">{photosTaken}</span>
            <span className="text-[10px] text-slate-400">
              /{waypoints.filter((w) => w.isPhotoPoint).length}
            </span>
          </div>
          <span className="text-[9px] text-amber-500/80 font-sans flex items-center gap-1">
            <Camera className="w-2.5 h-2.5" /> Disparos OK
          </span>
        </div>

        <div className="bg-slate-950/80 p-2.5 rounded-2xl border border-slate-800/80 flex flex-col">
          <span className="text-[10px] text-slate-400 font-sans uppercase font-bold">Bateria Estimada</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`text-base font-extrabold ${
                batteryPct > 35 ? 'text-emerald-400' : batteryPct > 20 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {batteryPct}%
            </span>
            <Battery className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <span className="text-[9px] text-slate-500 font-sans">1 Bateria em uso</span>
        </div>
      </div>

      {/* Interactive Timeline Scrubber */}
      <div className="flex flex-col gap-1.5 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/60">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
          <span className="text-cyan-400 font-bold">
            {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toFixed(0).padStart(2, '0')}
          </span>
          <span className="text-slate-400">
            WPT #{currentWp?.id || 1} / {waypoints.length} ({progressPct}%)
          </span>
          <span className="text-slate-400">
            {Math.floor(totalTimeSec / 60)}:{(totalTimeSec % 60).toFixed(0).padStart(2, '0')}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={totalTimeSec}
          step={0.1}
          value={elapsedSec}
          onChange={handleScrubberChange}
          className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-900 rounded-lg"
        />
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            id="btn-play-sim"
            onClick={handleTogglePlay}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
              isSimulating
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/25 ring-2 ring-amber-400/40'
                : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-cyan-500/25 ring-2 ring-cyan-400/40'
            }`}
          >
            {isSimulating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isSimulating ? 'Pausar Simulação' : 'Iniciar Simulação'}</span>
          </button>

          <button
            id="btn-reset-sim"
            onClick={handleReset}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-slate-800 cursor-pointer"
            title="Reiniciar simulador para o ponto inicial"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>{currentWp?.headingDeg || 0}°</span>
          </div>
        </div>
      </div>
    </div>
  );
};
