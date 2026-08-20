import React, { useState } from 'react';
import JSZip from 'jszip';
import { Upload, FileCode, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPolygon: (polygon: [number, number][], missionName?: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportPolygon }) => {
  const [dragActive, setDragActive] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    setFileName(file.name);

    try {
      if (file.name.endsWith('.kmz')) {
        const zip = new JSZip();
        const loadedZip = await zip.loadAsync(file);
        // Find doc.kml or any .kml file inside
        const kmlFile = Object.keys(loadedZip.files).find((name) => name.endsWith('.kml') || name.endsWith('.wpml'));
        if (kmlFile) {
          const kmlText = await loadedZip.files[kmlFile].async('string');
          parseKml(kmlText, file.name.replace(/\.[^/.]+$/, ''));
        } else {
          setErrorMsg('Nenhum arquivo KML válido encontrado dentro do KMZ.');
        }
      } else if (file.name.endsWith('.kml')) {
        const text = await file.text();
        parseKml(text, file.name.replace(/\.[^/.]+$/, ''));
      } else if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
        const text = await file.text();
        parseGeoJson(text, file.name.replace(/\.[^/.]+$/, ''));
      } else {
        const text = await file.text();
        parseTextCoordinates(text);
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao ler arquivo: ${err.message}`);
    }
  };

  const parseKml = (kmlText: string, missionName?: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
      const coordinatesEls = xmlDoc.getElementsByTagName('coordinates');

      if (coordinatesEls.length === 0) {
        setErrorMsg('Nenhuma coordenada encontrada no arquivo KML.');
        return;
      }

      const rawCoords = coordinatesEls[0].textContent || '';
      const points: [number, number][] = [];

      const parts = rawCoords.trim().split(/\s+/);
      for (const part of parts) {
        const [lngStr, latStr] = part.split(',');
        if (latStr && lngStr) {
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);
          if (!isNaN(lat) && !isNaN(lng)) {
            points.push([lat, lng]);
          }
        }
      }

      if (points.length >= 2) {
        onImportPolygon(points, missionName);
        onClose();
      } else {
        setErrorMsg('Coordenadas insuficientes encontradas no KML.');
      }
    } catch {
      setErrorMsg('Falha ao processar arquivo KML.');
    }
  };

  const parseGeoJson = (geoJsonText: string, missionName?: string) => {
    try {
      const data = JSON.parse(geoJsonText);
      const points: [number, number][] = [];

      const extractFromCoords = (coords: any[]) => {
        if (typeof coords[0] === 'number') {
          points.push([coords[1], coords[0]]);
        } else if (Array.isArray(coords)) {
          coords.forEach(extractFromCoords);
        }
      };

      if (data.type === 'FeatureCollection' && data.features) {
        data.features.forEach((f: any) => {
          if (f.geometry && f.geometry.coordinates) {
            extractFromCoords(f.geometry.coordinates);
          }
        });
      } else if (data.geometry && data.geometry.coordinates) {
        extractFromCoords(data.geometry.coordinates);
      }

      if (points.length >= 2) {
        onImportPolygon(points, missionName);
        onClose();
      } else {
        setErrorMsg('Coordenadas insuficientes encontradas no GeoJSON.');
      }
    } catch {
      setErrorMsg('Arquivo GeoJSON inválido.');
    }
  };

  const parseTextCoordinates = (text: string) => {
    const lines = text.trim().split('\n');
    const points: [number, number][] = [];

    for (const line of lines) {
      const cleaned = line.trim().replace(/[;|\t]/g, ',');
      const parts = cleaned.split(',');
      if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          points.push([lat, lng]);
        }
      }
    }

    if (points.length >= 2) {
      onImportPolygon(points, 'Área Importada');
      onClose();
    } else {
      setErrorMsg('Nenhuma coordenada válida (lat,lng) detectada no texto.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <FileCode className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-100">Importar Área ou Traçado</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4">
          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
              dragActive
                ? 'border-cyan-400 bg-cyan-950/20 scale-[0.99]'
                : 'border-slate-700 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-950/60'
            }`}
            onClick={() => document.getElementById('file-upload-input')?.click()}
          >
            <Upload className="w-10 h-10 text-cyan-400 mb-3" />
            <p className="text-sm font-semibold text-slate-200">
              Arraste e solte seu arquivo aqui ou clique para selecionar
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Formatos aceitos: <b>.KML</b>, <b>.KMZ</b> (Google Earth), <b>.GeoJSON</b>, <b>.TXT</b> (coordenadas)
            </p>
            <input
              id="file-upload-input"
              type="file"
              accept=".kml,.kmz,.geojson,.json,.txt,.csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {fileName && (
            <div className="flex items-center gap-2 text-xs text-cyan-400 bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-800/60">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate">{fileName} carregado com sucesso.</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/60">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Paste coordinates option */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
            <label className="text-xs font-semibold text-slate-300">
              Ou Cole Coordenadas (Latitude, Longitude por linha):
            </label>
            <textarea
              rows={3}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="-21.1740, -47.8130&#10;-21.1745, -47.8075&#10;-21.1788, -47.8070"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={() => parseTextCoordinates(pasteText)}
              disabled={!pasteText.trim()}
              className="mt-1 w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 font-semibold py-2 rounded-xl text-xs transition-colors"
            >
              Processar Texto de Coordenadas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
