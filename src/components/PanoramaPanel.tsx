import React, { useState } from 'react';
import { PanoramaStation, PanoramaType, DroneCameraProfile, FlightConfig, DrawingMode } from '../types';
import {
  getGeneratedPhotoCount,
  getGeneratedWaypointCount,
  dividePanoramaMissions,
  validatePanoramaStation
} from '../utils/panorama';
import { exportPanoramaDjiKmz } from '../utils/exporters';
import {
  Camera,
  Layers,
  Sliders,
  Compass,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  MapPin,
  Sparkles,
  HelpCircle,
  Eye,
  Settings2,
  FileText
} from 'lucide-react';

interface PanoramaPanelProps {
  missionName: string;
  stations: PanoramaStation[];
  setStations: React.Dispatch<React.SetStateAction<PanoramaStation[]>>;
  selectedStationId: string | null;
  setSelectedStationId: (id: string | null) => void;
  selectedDrone: DroneCameraProfile;
  config: FlightConfig;
  drawingMode: DrawingMode;
  setDrawingMode: (mode: DrawingMode) => void;
  onFocusStation?: (station: PanoramaStation) => void;
}

export const PanoramaPanel: React.FC<PanoramaPanelProps> = ({
  missionName,
  stations,
  setStations,
  selectedStationId,
  setSelectedStationId,
  selectedDrone,
  config,
  drawingMode,
  setDrawingMode,
  onFocusStation
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showStitchingTips, setShowStitchingTips] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const selectedStation = stations.find((s) => s.id === selectedStationId) || (stations.length > 0 ? stations[0] : null);

  // Calcula grupos de missões divididas em tempo real (limite MAX 200 WP)
  const maxWp = config.maxWaypointsPerFile || 200;
  const missionGroups = dividePanoramaMissions(stations, missionName, maxWp, config.flightSpeedMs);
  const totalPhotos = stations.reduce((acc, s) => acc + getGeneratedPhotoCount(s), 0);
  const totalWaypoints = stations.reduce((acc, s) => acc + getGeneratedWaypointCount(s), 0);
  const totalKmz = Math.max(1, missionGroups.length);

  // Atualiza um campo da estação selecionada
  const updateSelectedStation = (patch: Partial<PanoramaStation>) => {
    if (!selectedStation) return;
    setStations((prev) =>
      prev.map((st) => {
        if (st.id === selectedStation.id) {
          const updated = { ...st, ...patch };
          updated.numeroFotos = getGeneratedPhotoCount(updated);
          updated.numeroWaypoints = getGeneratedWaypointCount(updated);
          return updated;
        }
        return st;
      })
    );
  };

  // Adiciona nova estação manual
  const handleAddStationAtCenter = () => {
    const newIdx = stations.length + 1;
    const pad = String(newIdx).padStart(2, '0');
    const newStation: PanoramaStation = {
      id: `PANO_${String(newIdx).padStart(3, '0')}`,
      nome: `Panorama ${pad}`,
      latitude: -21.1767,
      longitude: -47.8103,
      altitude: config.targetAltitudeAgl || 80,
      tipo: 'panorama_360_completo',
      headingInicial: 0,
      hoverEstabilizacao: 2.5,
      hoverFoto: 0.5,
      numeroFotos: 33,
      numeroWaypoints: 66,
      assignedMissionName: 'Missão 1'
    };
    setStations((prev) => [...prev, newStation]);
    setSelectedStationId(newStation.id);
  };

  // Remove estação
  const handleDeleteStation = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const remaining = stations.filter((s) => s.id !== id);
    setStations(remaining);
    if (selectedStationId === id) {
      setSelectedStationId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  // Exporta KMZ / WPML para DJI Fly
  const handleExportDji = async () => {
    if (stations.length === 0) {
      setExportFeedback({
        type: 'error',
        title: 'Nenhuma Estação Cadastrada',
        message: 'Adicione pelo menos 1 Estação Panorâmica 360° no mapa antes de exportar.'
      });
      return;
    }

    // Validação preliminar
    for (const st of stations) {
      const val = validatePanoramaStation(st);
      if (!val.valid) {
        setExportFeedback({
          type: 'error',
          title: 'Dados Inconsistentes',
          message: val.error || `Estação ${st.nome} possui configurações inválidas.`
        });
        return;
      }
    }

    setExportLoading(true);
    setExportFeedback(null);

    try {
      const res = await exportPanoramaDjiKmz(
        missionName,
        stations,
        selectedDrone,
        config
      );

      setExportFeedback({
        type: 'success',
        title: 'Exportação Concluída com Sucesso',
        message: res.message
      });
    } catch (err: any) {
      console.error('Falha na exportação de panoramas DJI:', err);
      setExportFeedback({
        type: 'error',
        title: 'Falha na Exportação',
        message: err.message || 'Ocorreu um erro ao gerar os arquivos KMZ WPML.'
      });
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar text-slate-100">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Estação Panorâmica 360°</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  DJI Fly WPML
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Fotometria esférica 360° × 180° com 33 fotos (66 waypoints) por ponto.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Add on Map */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDrawingMode(drawingMode === 'panorama' ? 'none' : 'panorama')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
              drawingMode === 'panorama'
                ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400 shadow-emerald-500/30 animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>{drawingMode === 'panorama' ? 'Clique no Mapa para Inserir' : '+ Inserir Estação no Mapa'}</span>
          </button>

          {stations.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Deseja realmente remover todas as estações panorâmicas?')) {
                  setStations([]);
                  setSelectedStationId(null);
                }
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
              title="Limpar todas as estações"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Stations Horizontal/Vertical Carousel/List */}
      {stations.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
            <span>Estações Criadas ({stations.length})</span>
            <span className="text-[11px] font-mono text-emerald-400">
              {totalPhotos} fotos • {totalWaypoints} WP
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {stations.map((station, idx) => {
              const isSelected = selectedStation?.id === station.id;
              const missionPad = station.assignedMissionIndex !== undefined
                ? `M${station.assignedMissionIndex + 1}`
                : `M1`;

              return (
                <button
                  key={station.id}
                  onClick={() => {
                    setSelectedStationId(station.id);
                    if (onFocusStation) onFocusStation(station);
                  }}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-left border transition-all flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-emerald-950/60 border-emerald-500 text-slate-100 ring-1 ring-emerald-500/50 shadow-lg'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isSelected ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    P{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate max-w-[120px]">{station.nome}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {station.altitude}m • {missionPad}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteStation(station.id, e)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors ml-1"
                    title="Excluir estação"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Station Properties Editor */}
      {selectedStation ? (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Propriedades: {selectedStation.nome}
              </h4>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
              {selectedStation.numeroFotos} fotos / {selectedStation.numeroWaypoints} waypoints
            </span>
          </div>

          {/* Nome & Modo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Nome da Estação
              </label>
              <input
                type="text"
                value={selectedStation.nome}
                onChange={(e) => updateSelectedStation({ nome: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-semibold focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Modo de Panorâmica
              </label>
              <select
                value={selectedStation.tipo}
                onChange={(e) => updateSelectedStation({ tipo: e.target.value as PanoramaType })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 font-medium focus:border-emerald-500 focus:outline-none"
              >
                <option value="panorama_360_completo">Esférico Completo (33 Fotos)</option>
                <option value="panorama_parcial_teste">Modo Teste - 1 Nível (8 Fotos)</option>
              </select>
            </div>
          </div>

          {/* Altitude & Heading Inicial */}
          <div className="space-y-3 pt-1">
            {/* Altitude AGL */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-300">Altitude de Captura (AGL)</span>
                <span className="font-mono font-bold text-emerald-400">{selectedStation.altitude} m</span>
              </div>
              <input
                type="range"
                min="10"
                max="200"
                step="5"
                value={selectedStation.altitude}
                onChange={(e) => updateSelectedStation({ altitude: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>10m</span>
                <span>80m (Padrão)</span>
                <span>200m</span>
              </div>
            </div>

            {/* Heading Inicial (0-359°) */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Heading Inicial (Azimute de Partida)</span>
                </span>
                <span className="font-mono font-bold text-cyan-400">{selectedStation.headingInicial}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="359"
                step="1"
                value={selectedStation.headingInicial}
                onChange={(e) => updateSelectedStation({ headingInicial: parseInt(e.target.value, 10) })}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                <span>0° (Norte)</span>
                <span>90° (Leste)</span>
                <span>180° (Sul)</span>
                <span>270° (Oeste)</span>
              </div>
            </div>

            {/* Hover de Estabilização & Hover de Foto */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Estabilização</span>
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{selectedStation.hoverEstabilizacao}s</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="10.0"
                  step="0.5"
                  value={selectedStation.hoverEstabilizacao}
                  onChange={(e) => updateSelectedStation({ hoverEstabilizacao: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>Hover pós-foto</span>
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">{selectedStation.hoverFoto}s</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="5.0"
                  step="0.5"
                  value={selectedStation.hoverFoto}
                  onChange={(e) => updateSelectedStation({ hoverFoto: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Advanced Angles Collapsible */}
          <div className="pt-2 border-t border-slate-800">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1 font-semibold"
            >
              <span className="flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ângulos de Gimbal e Níveis de Disparo</span>
              </span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">Nível 1 (Superior):</span>
                    <span className="font-mono text-emerald-400 font-bold ml-1.5">+55° (8 fotos)</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Nível 2 (Horizonte):</span>
                    <span className="font-mono text-emerald-400 font-bold ml-1.5">+15° (8 fotos)</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Nível 3 (Oblíquo 1):</span>
                    <span className="font-mono text-emerald-400 font-bold ml-1.5">-25° (8 fotos)</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Nível 4 (Oblíquo 2):</span>
                    <span className="font-mono text-emerald-400 font-bold ml-1.5">-65° (8 fotos)</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Nadir (Solo Vertical):</span>
                    <span className="font-mono text-emerald-400 font-bold ml-1.5">-90° (1 foto)</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed bg-slate-950/60 p-2 rounded-lg">
                  💡 Os giros em azimute avançam de <b>45° em 45°</b> em cada nível horizontal a partir do heading inicial escolhido.
                </div>
              </div>
            )}
          </div>

          {/* Resumo da Estação Selecionada */}
          <div className="bg-slate-900/90 border border-emerald-500/20 rounded-xl p-3 text-xs space-y-1">
            <div className="font-bold text-emerald-400 flex items-center justify-between">
              <span>Sequência de Disparo</span>
              <span className="font-mono">{selectedStation.numeroWaypoints} Waypoints</span>
            </div>
            <p className="text-[11px] text-slate-300">
              • {selectedStation.tipo === 'panorama_360_completo' ? '4 níveis horizontais (8 fotos cada) + 1 nadir' : '1 nível horizontal (8 fotos)'}
            </p>
            <p className="text-[11px] text-slate-400 font-mono">
              Lat: {selectedStation.latitude.toFixed(6)} | Lng: {selectedStation.longitude.toFixed(6)}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-2">
          <Camera className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-xs font-bold text-slate-300">Nenhuma estação selecionada</h4>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Clique no botão acima ou clique diretamente no mapa para posicionar sua primeira Estação Panorâmica 360°.
          </p>
        </div>
      )}

      {/* Global Mission Summary & Partitions (Itens 20, 42) */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Resumo Geral das Missões</span>
          </span>
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
            {totalKmz} {totalKmz === 1 ? 'Arquivo KMZ' : 'Arquivos KMZ'}
          </span>
        </div>

        {/* 4 KPI Metrics */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[10px] text-slate-400 font-medium">Estações 360°</div>
            <div className="text-base font-bold text-slate-100 font-mono">{stations.length}</div>
          </div>
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[10px] text-slate-400 font-medium">Fotos Previstas</div>
            <div className="text-base font-bold text-emerald-400 font-mono">{totalPhotos}</div>
          </div>
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[10px] text-slate-400 font-medium">Waypoints DJI</div>
            <div className="text-base font-bold text-cyan-400 font-mono">{totalWaypoints}</div>
          </div>
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
            <div className="text-[10px] text-slate-400 font-medium">Arquivos KMZ</div>
            <div className="text-base font-bold text-amber-400 font-mono">{totalKmz}</div>
          </div>
        </div>

        {/* Partitions List */}
        {missionGroups.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-slate-400">Divisão Automática (Limite 200 WP):</div>
            <div className="space-y-1.5">
              {missionGroups.map((group, idx) => (
                <div
                  key={group.missionIndex}
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-200">
                      Missão {String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                      {group.stations.map((s) => s.nome).join(', ')}
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-xs font-bold text-emerald-400">{group.totalWaypoints} WP</span>
                    <div className="text-[10px] text-slate-500">{group.totalPhotos} fotos</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Nenhuma estação panorâmica é dividida entre arquivos.</span>
            </div>
          </div>
        )}
      </div>

      {/* Stitching and Camera Guidelines Collapsible */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 shadow-lg">
        <button
          onClick={() => setShowStitchingTips(!showStitchingTips)}
          className="w-full flex items-center justify-between text-xs text-slate-300 hover:text-slate-100 font-semibold"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>Recomendações de Câmera e Costura 360°</span>
          </span>
          {showStitchingTips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showStitchingTips && (
          <div className="mt-3 text-xs text-slate-300 space-y-2 leading-relaxed border-t border-slate-800/80 pt-3">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1.5">
              <div className="font-bold text-cyan-400">📷 Configuração no DJI Fly:</div>
              <ul className="list-disc list-inside text-slate-300 space-y-1">
                <li>Defina o modo da câmera como <b>Manual (M)</b> antes do voo.</li>
                <li>Trave o <b>ISO (100)</b> e a velocidade do obturador para evitar variações de exposição entre as fotos.</li>
                <li>Fixe o <b>Balanço de Branco (WB)</b> em modo ensolarado / fixo (ex: 5500K).</li>
                <li>Utilize a proporção <b>4:3</b> para máxima cobertura vertical.</li>
                <li>Trave o foco no <b>Infinito / Manual</b>.</li>
              </ul>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] space-y-1.5">
              <div className="font-bold text-emerald-400">🧩 Softwares Recomendados para Costura:</div>
              <p className="text-slate-300">
                As 33 fotografias capturadas em cada estação formam uma esfera completa (360° × 180°). Você pode processá-las diretamente no <b>PTGui</b>, <b>Hugin</b> (Open Source), ou <b>Adobe Lightroom</b> para gerar a imagem equirretangular final.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Export Button for Panorama Missions */}
      <div className="pt-2">
        <button
          onClick={handleExportDji}
          disabled={exportLoading || stations.length === 0}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition-all"
        >
          {exportLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Gerando KMZ DJI Fly...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>
                Exportar Panoramas DJI KMZ {totalKmz > 1 ? `(${totalKmz} Missões)` : ''}
              </span>
            </>
          )}
        </button>

        {/* Feedback Message */}
        {exportFeedback && (
          <div
            className={`mt-3 p-3.5 rounded-xl border text-xs leading-relaxed animate-fadeIn ${
              exportFeedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {exportFeedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{exportFeedback.title}</span>
            </div>
            <div className="whitespace-pre-line text-[11px] opacity-90">{exportFeedback.message}</div>
          </div>
        )}
      </div>
    </div>
  );
};
