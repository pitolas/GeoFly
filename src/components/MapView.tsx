import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Waypoint, FlightLine, TakeoffPoint, UtmCoordinate } from '../types';
import { latLngToUtm } from '../utils/geometry';
import { fetchCoordinateElevation } from '../utils/srtm';
import {
  Layers,
  MapPin,
  Crosshair,
  Trash2,
  Maximize2,
  Compass,
  Navigation,
  Pencil,
  Spline,
  ZoomIn,
  ZoomOut,
  Info,
  Search,
  Loader2,
  X,
  Building2,
  MapPinCheck
} from 'lucide-react';

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

export type MapTileProvider = 'google-hybrid' | 'esri-sat' | 'osm' | 'carto-dark' | 'opentopo';

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  boundingbox?: [string, string, string, string];
}

interface MapViewProps {
  polygon: [number, number][];
  setPolygon: (poly: [number, number][]) => void;
  flightLines: FlightLine[];
  waypoints: Waypoint[];
  takeoffPoint?: TakeoffPoint;
  setTakeoffPoint: (pt: TakeoffPoint | undefined) => void;
  selectedWaypointId?: number | null;
  onSelectWaypoint?: (wp: Waypoint) => void;
  isSimulating: boolean;
  simDronePosition?: { lat: number; lng: number; heading: number; altAgl: number; altMsl: number } | null;
  gridType: 'single' | 'double' | 'corridor' | 'perimeter';
  drawingMode: 'none' | 'polygon' | 'corridor' | 'takeoff';
  setDrawingMode: (mode: 'none' | 'polygon' | 'corridor' | 'takeoff') => void;
}

export const MapView: React.FC<MapViewProps> = ({
  polygon,
  setPolygon,
  flightLines,
  waypoints,
  takeoffPoint,
  setTakeoffPoint,
  selectedWaypointId,
  onSelectWaypoint,
  isSimulating,
  simDronePosition,
  gridType,
  drawingMode,
  setDrawingMode
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const flightPathLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const waypointsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const takeoffMarkerRef = useRef<L.Marker | null>(null);
  const simDroneMarkerRef = useRef<L.Marker | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [activeTile, setActiveTile] = useState<MapTileProvider>('google-hybrid');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [cursorCoordinates, setCursorCoordinates] = useState<{
    lat: number;
    lng: number;
    utm: UtmCoordinate;
    elevation: number | null;
  } | null>(null);

  // Location Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Parse direct coordinate string (e.g. "-21.1767, -47.8103")
  const parseCoordinates = (input: string): { lat: number; lng: number } | null => {
    const clean = input.trim();
    const regex = /^([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)$/;
    const match = clean.match(regex);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
    return null;
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search for cities and locations via OpenStreetMap Nominatim
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (parseCoordinates(trimmed)) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            trimmed
          )}&limit=6&addressdetails=1`,
          {
            signal: controller.signal,
            headers: {
              'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
            }
          }
        );
        if (res.ok) {
          const data: SearchResult[] = await res.json();
          setSearchResults(data);
          setShowSearchResults(true);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Geocoding search failed:', err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  // Select location and fly to it
  const handleSelectLocation = (
    lat: number,
    lng: number,
    displayName: string,
    boundingbox?: [string, string, string, string]
  ) => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Clear previous search marker
    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
      searchMarkerRef.current = null;
    }

    // Place pin marker on searched location
    const pinIcon = L.divIcon({
      className: 'search-location-pin',
      html: `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: #06b6d4;
          border: 2px solid #ffffff;
          border-radius: 50%;
          color: #ffffff;
          box-shadow: 0 0 14px rgba(6, 182, 212, 0.9);
        ">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    const shortName = displayName.split(',')[0];
    marker
      .bindPopup(
        `
        <div style="min-width: 170px; font-family: sans-serif;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 2px;">📍 ${shortName}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${displayName}</div>
          <div style="font-size: 10px; color: #0891b2; font-family: monospace;">${lat.toFixed(5)}°, ${lng.toFixed(5)}°</div>
        </div>
      `,
        { offset: [0, -28] }
      )
      .openPopup();

    searchMarkerRef.current = marker;

    if (boundingbox && boundingbox.length === 4) {
      const south = parseFloat(boundingbox[0]);
      const north = parseFloat(boundingbox[1]);
      const west = parseFloat(boundingbox[2]);
      const east = parseFloat(boundingbox[3]);
      map.fitBounds(
        [
          [south, west],
          [north, east]
        ],
        { padding: [50, 50], maxZoom: 16 }
      );
    } else {
      map.flyTo([lat, lng], 15, { duration: 1.5 });
    }

    setShowSearchResults(false);
  };

  // Submit search query (press Enter)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const coords = parseCoordinates(trimmed);
    if (coords) {
      handleSelectLocation(
        coords.lat,
        coords.lng,
        `Coordenadas: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
      );
      return;
    }

    if (searchResults.length > 0) {
      const top = searchResults[0];
      handleSelectLocation(parseFloat(top.lat), parseFloat(top.lon), top.display_name, top.boundingbox);
    }
  };

  // Initialize Map (starts clean centered on Brazil or polygon if present)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = polygon.length > 0 ? polygon[0] : [-15.7942, -47.8822];
    const initialZoom = polygon.length > 0 ? 16 : 5;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false
    });

    mapRef.current = map;

    // Create Tile Layer
    const tileLayer = getTileLayer(activeTile);
    tileLayer.addTo(map);
    tileLayerRef.current = tileLayer;

    // Layer Groups
    polygonLayerGroupRef.current = L.layerGroup().addTo(map);
    flightPathLayerGroupRef.current = L.layerGroup().addTo(map);
    waypointsLayerGroupRef.current = L.layerGroup().addTo(map);

    // Mouse Move listener for coordinate display
    let elevationTimeout: any = null;
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const utm = latLngToUtm(lat, lng);

      setCursorCoordinates({
        lat,
        lng,
        utm,
        elevation: null
      });

      clearTimeout(elevationTimeout);
      elevationTimeout = setTimeout(async () => {
        const elev = await fetchCoordinateElevation(lat, lng);
        setCursorCoordinates((prev) => (prev ? { ...prev, elevation: elev } : null));
      }, 400);
    });

    return () => {
      clearTimeout(elevationTimeout);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Auto zoom to fit polygon when a new polygon is imported or loaded
  const prevPolygonLengthRef = useRef(polygon.length);
  useEffect(() => {
    if (prevPolygonLengthRef.current === 0 && polygon.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(polygon);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
    prevPolygonLengthRef.current = polygon.length;
  }, [polygon]);

  // Switch Tile Layer
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const newLayer = getTileLayer(activeTile);
    newLayer.addTo(mapRef.current);
    tileLayerRef.current = newLayer;
  }, [activeTile]);

  // Handle map click during Drawing Mode
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const newPt: [number, number] = [e.latlng.lat, e.latlng.lng];

      if (drawingMode === 'polygon' || drawingMode === 'corridor') {
        setPolygon([...polygon, newPt]);
      } else if (drawingMode === 'takeoff') {
        const elev = await fetchCoordinateElevation(newPt[0], newPt[1]);
        setTakeoffPoint({
          lat: newPt[0],
          lng: newPt[1],
          elevationMsl: elev
        });
        setDrawingMode('none');
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [drawingMode, polygon, setPolygon, setTakeoffPoint, setDrawingMode]);

  // Render Polygon and Vertices
  useEffect(() => {
    if (!polygonLayerGroupRef.current || !mapRef.current) return;
    const group = polygonLayerGroupRef.current;
    group.clearLayers();

    if (polygon.length === 0) return;

    if (gridType === 'corridor') {
      // Render as thick corridor polyline with dashed vertices
      const polyline = L.polyline(polygon, {
        color: '#06b6d4',
        weight: 4,
        dashArray: '8, 8',
        opacity: 0.9
      });
      group.addLayer(polyline);
    } else if (polygon.length >= 3) {
      // Render as closed polygon
      const poly = L.polygon(polygon, {
        color: '#06b6d4',
        weight: 2.5,
        fillColor: '#0891b2',
        fillOpacity: 0.18,
        dashArray: '6, 6'
      });
      group.addLayer(poly);
    } else if (polygon.length === 2) {
      const line = L.polyline(polygon, {
        color: '#06b6d4',
        weight: 2.5,
        dashArray: '6, 6'
      });
      group.addLayer(line);
    }

    // Render draggable vertex handles
    polygon.forEach((pt, idx) => {
      const vertexIcon = L.divIcon({
        className: 'custom-vertex-marker',
        html: `<div style="width: 14px; height: 14px; background: #06b6d4; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.6); cursor: grab;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      });

      const marker = L.marker(pt, {
        icon: vertexIcon,
        draggable: true
      });

      marker.on('drag', (e: any) => {
        const newLatLng = e.target.getLatLng();
        const updated = [...polygon];
        updated[idx] = [newLatLng.lat, newLatLng.lng];
        setPolygon(updated);
      });

      // Right click or double click to remove vertex
      marker.on('contextmenu', () => {
        if (polygon.length > 1) {
          const updated = polygon.filter((_, i) => i !== idx);
          setPolygon(updated);
        }
      });

      group.addLayer(marker);
    });
  }, [polygon, gridType, setPolygon]);

  // Render Flight Lines and Waypoints
  useEffect(() => {
    if (!flightPathLayerGroupRef.current || !waypointsLayerGroupRef.current || !mapRef.current) return;
    const pathGroup = flightPathLayerGroupRef.current;
    const wpGroup = waypointsLayerGroupRef.current;

    pathGroup.clearLayers();
    wpGroup.clearLayers();

    if (waypoints.length < 2) return;

    // Draw continuous flight line connecting all waypoints in flight order
    const waypointsLatLngs = waypoints.map((w) => [w.lat, w.lng] as [number, number]);
    const mainFlightPath = L.polyline(waypointsLatLngs, {
      color: '#eab308', // Amber/Yellow flight track
      weight: 3,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round'
    });
    pathGroup.addLayer(mainFlightPath);

    // Draw waypoints markers (Only show major turn points and sample photo dots to avoid clustering)
    const totalWp = waypoints.length;
    const step = totalWp > 300 ? Math.ceil(totalWp / 150) : 1;

    waypoints.forEach((wp, idx) => {
      const isSelected = selectedWaypointId === wp.id;
      const isEndpoint = idx === 0 || idx === waypoints.length - 1;

      if (idx % step !== 0 && !isSelected && !isEndpoint && !wp.isPhotoPoint) return;

      const isPhoto = wp.isPhotoPoint;
      const color = isSelected ? '#ef4444' : isPhoto ? '#3b82f6' : '#f59e0b';
      const size = isSelected ? 16 : isPhoto ? 10 : 12;

      const markerHtml = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 2px solid #ffffff;
          border-radius: ${isPhoto ? '50%' : '3px'};
          box-shadow: 0 0 6px rgba(0,0,0,0.7);
          transition: transform 0.15s ease;
          ${isSelected ? 'transform: scale(1.3);' : ''}
        "></div>
      `;

      const icon = L.divIcon({
        className: 'custom-wp-icon',
        html: markerHtml,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const marker = L.marker([wp.lat, wp.lng], { icon });

      marker.bindTooltip(
        `<b>WPT #${wp.id}</b> (${wp.action.toUpperCase()})<br/>` +
          `Alt AGL: ${wp.altitudeAgl.toFixed(1)}m | MSL: ${wp.altitudeMsl.toFixed(1)}m<br/>` +
          `Solo SRTM: ${wp.groundElevation.toFixed(1)}m<br/>` +
          `Azimute: ${wp.headingDeg}° | Vel: ${wp.speedMs} m/s`,
        { direction: 'top', offset: [0, -6], className: 'custom-leaflet-tooltip' }
      );

      marker.on('click', () => {
        if (onSelectWaypoint) onSelectWaypoint(wp);
      });

      wpGroup.addLayer(marker);
    });
  }, [waypoints, selectedWaypointId, onSelectWaypoint]);

  // Render Takeoff Point (Home Marker)
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (takeoffMarkerRef.current) {
      map.removeLayer(takeoffMarkerRef.current);
      takeoffMarkerRef.current = null;
    }

    if (takeoffPoint) {
      const homeIcon = L.divIcon({
        className: 'takeoff-home-icon',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            background: #10b981;
            border: 2px solid #ffffff;
            border-radius: 50%;
            color: #ffffff;
            font-weight: 800;
            font-size: 14px;
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
          ">H</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([takeoffPoint.lat, takeoffPoint.lng], {
        icon: homeIcon,
        draggable: true
      });

      marker.bindTooltip(
        `<b>Ponto de Decolagem (Home)</b><br/>Elevação Solo: ${takeoffPoint.elevationMsl.toFixed(1)} m`,
        { direction: 'top', offset: [0, -16] }
      );

      marker.on('dragend', async (e: any) => {
        const latlng = e.target.getLatLng();
        const elev = await fetchCoordinateElevation(latlng.lat, latlng.lng);
        setTakeoffPoint({
          lat: latlng.lat,
          lng: latlng.lng,
          elevationMsl: elev
        });
      });

      marker.addTo(map);
      takeoffMarkerRef.current = marker;
    }
  }, [takeoffPoint, setTakeoffPoint]);

  // Render Live Simulation Drone Icon
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!isSimulating || !simDronePosition) {
      if (simDroneMarkerRef.current) {
        map.removeLayer(simDroneMarkerRef.current);
        simDroneMarkerRef.current = null;
      }
      return;
    }

    const droneHtml = `
      <div style="
        width: 34px;
        height: 34px;
        transform: rotate(${simDronePosition.heading}deg);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg viewBox="0 0 24 24" width="34" height="34" fill="#ef4444" stroke="#ffffff" stroke-width="1.5">
          <path d="M12 2L4 21l8-4 8 4L12 2z"/>
        </svg>
      </div>
    `;

    const droneIcon = L.divIcon({
      className: 'sim-drone-icon',
      html: droneHtml,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    if (!simDroneMarkerRef.current) {
      simDroneMarkerRef.current = L.marker([simDronePosition.lat, simDronePosition.lng], { icon: droneIcon }).addTo(
        map
      );
    } else {
      simDroneMarkerRef.current.setLatLng([simDronePosition.lat, simDronePosition.lng]);
      simDroneMarkerRef.current.setIcon(droneIcon);
    }
  }, [isSimulating, simDronePosition]);

  // Zoom to Fit Mission Bounds
  const handleZoomFit = useCallback(() => {
    if (!mapRef.current) return;
    let bounds: L.LatLngBounds | null = null;

    if (waypoints.length > 0) {
      bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng]));
    } else if (polygon.length > 0) {
      bounds = L.latLngBounds(polygon);
    }

    if (bounds) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    }
  }, [waypoints, polygon]);

  // GPS Locate User
  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapRef.current?.flyTo([lat, lng], 17);

        // Also suggest setting home point if none set
        if (!takeoffPoint) {
          const elev = await fetchCoordinateElevation(lat, lng);
          setTakeoffPoint({ lat, lng, elevationMsl: elev });
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* The Leaflet Container */}
      <div id="geoway-map" ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Top Controls Container: Drawing Controls (Left), Search Bar (Center), Layers & Tools (Right) */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-start justify-between gap-3 pointer-events-none">
        
        {/* Top Left: Drawing Controls Bar */}
        <div className="flex flex-col gap-2 pointer-events-auto shrink-0">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-2xl flex items-center gap-1.5">
            <button
              id="btn-draw-polygon"
              onClick={() => setDrawingMode(drawingMode === 'polygon' ? 'none' : 'polygon')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                drawingMode === 'polygon'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
              title="Clique no mapa para adicionar vértices do polígono"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Polígono</span>
            </button>

            <button
              id="btn-draw-corridor"
              onClick={() => setDrawingMode(drawingMode === 'corridor' ? 'none' : 'corridor')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                drawingMode === 'corridor'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
              title="Clique no mapa para criar traçado de corredor linear"
            >
              <Spline className="w-3.5 h-3.5" />
              <span>Corredor</span>
            </button>

            <button
              id="btn-set-takeoff"
              onClick={() => setDrawingMode(drawingMode === 'takeoff' ? 'none' : 'takeoff')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                drawingMode === 'takeoff'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
              title="Clique no mapa para definir o ponto de decolagem (Home Point)"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Decolagem (Home)</span>
            </button>

            {polygon.length > 0 && (
              <button
                id="btn-clear-drawing"
                onClick={() => {
                  setPolygon([]);
                  setDrawingMode('none');
                }}
                className="p-2 rounded-lg text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors ml-1"
                title="Limpar área desenhada"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Informative helper badge when drawing */}
          {drawingMode !== 'none' && (
            <div className="bg-cyan-950/90 backdrop-blur-md border border-cyan-700/50 rounded-lg px-3 py-2 text-xs text-cyan-200 flex items-center gap-2 shadow-lg animate-pulse max-w-sm">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                {drawingMode === 'polygon' && 'Clique no mapa para adicionar os pontos da área.'}
                {drawingMode === 'corridor' && 'Clique no mapa ao longo da rodovia/canal/linha.'}
                {drawingMode === 'takeoff' && 'Clique onde o drone irá decolar para registrar a cota de referência.'}
              </span>
            </div>
          )}
        </div>

        {/* Top Center: City / Location Search Bar */}
        <div ref={searchContainerRef} className="relative pointer-events-auto flex-1 max-w-md mx-auto order-last sm:order-none w-full sm:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center">
            <div className="absolute left-3 text-slate-400 pointer-events-none">
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <Search className="w-4 h-4 text-slate-400" />
              )}
            </div>

            <input
              id="map-city-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowSearchResults(true);
              }}
              placeholder="Buscar cidade, endereço ou coordenadas..."
              className="w-full bg-slate-900/90 hover:bg-slate-900 focus:bg-slate-900 backdrop-blur-md border border-slate-700/80 focus:border-cyan-500/80 focus:ring-2 focus:ring-cyan-500/20 text-slate-100 placeholder-slate-400 text-xs rounded-xl pl-9 pr-8 py-2.5 shadow-2xl transition-all outline-none"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                className="absolute right-2.5 text-slate-400 hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-800 transition-colors"
                title="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Autocomplete Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-2xl z-30 flex flex-col gap-1 max-h-72 overflow-y-auto">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Resultados de Localização</span>
                <span className="text-[9px] text-cyan-400 lowercase">{searchResults.length} encontrados</span>
              </div>
              {searchResults.map((result) => {
                const parts = result.display_name.split(',');
                const title = parts[0];
                const subtitle = parts.slice(1).join(',').trim();

                return (
                  <button
                    key={result.place_id}
                    onClick={() =>
                      handleSelectLocation(
                        parseFloat(result.lat),
                        parseFloat(result.lon),
                        result.display_name,
                        result.boundingbox
                      )
                    }
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-slate-800 transition-colors flex items-start gap-2.5 group"
                  >
                    <div className="p-1.5 rounded-md bg-slate-800/80 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors shrink-0 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                        {title}
                      </span>
                      <span className="text-[11px] text-slate-400 truncate">{subtitle}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Right: Layer Switcher & Map Tools */}
        <div className="flex items-center gap-2 pointer-events-auto shrink-0">
          {/* Layer Selector */}
          <div className="relative">
            <button
              id="btn-map-layers"
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className="bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 text-slate-200 p-2.5 rounded-xl shadow-xl hover:bg-slate-800 transition-all flex items-center gap-2 text-xs font-semibold"
              title="Camadas do Mapa (Satélite, Híbrido, Topográfico)"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Camadas</span>
            </button>

            {showLayerMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-2xl z-30 flex flex-col gap-1">
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Imagens de Satélite
                </div>
                <button
                  onClick={() => {
                    setActiveTile('google-hybrid');
                    setShowLayerMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                    activeTile === 'google-hybrid' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Google Híbrido</span>
                  {activeTile === 'google-hybrid' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </button>
                <button
                  onClick={() => {
                    setActiveTile('esri-sat');
                    setShowLayerMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                    activeTile === 'esri-sat' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Esri World Satellite</span>
                  {activeTile === 'esri-sat' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </button>
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-800 mt-1">
                  Mapas & Topografia
                </div>
                <button
                  onClick={() => {
                    setActiveTile('opentopo');
                    setShowLayerMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                    activeTile === 'opentopo' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>OpenTopoMap (Relevo)</span>
                  {activeTile === 'opentopo' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </button>
                <button
                  onClick={() => {
                    setActiveTile('osm');
                    setShowLayerMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                    activeTile === 'osm' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>OpenStreetMap Padrão</span>
                  {activeTile === 'osm' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </button>
                <button
                  onClick={() => {
                    setActiveTile('carto-dark');
                    setShowLayerMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                    activeTile === 'carto-dark' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Carto Dark (Noturno)</span>
                  {activeTile === 'carto-dark' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </button>
              </div>
            )}
          </div>

          {/* Zoom Fit Button */}
          <button
            id="btn-zoom-fit"
            onClick={handleZoomFit}
            className="bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 text-slate-200 p-2.5 rounded-xl shadow-xl hover:bg-slate-800 transition-all"
            title="Ajustar visualização para enquadrar a missão"
          >
            <Maximize2 className="w-4 h-4 text-cyan-400" />
          </button>

          {/* GPS Locate Button */}
          <button
            id="btn-gps-locate"
            onClick={handleLocateMe}
            className="bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 text-slate-200 p-2.5 rounded-xl shadow-xl hover:bg-slate-800 transition-all"
            title="Localizar minha posição atual via GPS"
          >
            <Crosshair className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Empty State Clean Map Guidance */}
      {polygon.length === 0 && drawingMode === 'none' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl px-4 py-2.5 shadow-2xl text-xs text-slate-300 flex items-center gap-2 max-w-md text-center animate-fade-in">
            <MapPinCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Digite o nome de uma cidade na busca acima ou clique em <b>Polígono</b> para iniciar o planejamento.
            </span>
          </div>
        </div>
      )}

      {/* Bottom Right: Zoom Controls */}
      <div className="absolute bottom-10 right-4 z-20 flex flex-col gap-1.5">
        <button
          id="btn-zoom-in"
          onClick={() => mapRef.current?.zoomIn()}
          className="bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 text-slate-200 p-2 rounded-lg shadow-xl hover:bg-slate-800 transition-all"
          title="Aproximar zoom"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          id="btn-zoom-out"
          onClick={() => mapRef.current?.zoomOut()}
          className="bg-slate-900/90 backdrop-blur-md border border-slate-800 hover:border-slate-700 text-slate-200 p-2 rounded-lg shadow-xl hover:bg-slate-800 transition-all"
          title="Afastar zoom"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Left: Realtime Coordinates & SRTM Elevation HUD */}
      {cursorCoordinates && (
        <div className="absolute bottom-4 left-4 z-20 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-300 shadow-2xl flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Compass className="w-3.5 h-3.5" />
            <span>
              {cursorCoordinates.lat.toFixed(6)}°, {cursorCoordinates.lng.toFixed(6)}°
            </span>
          </div>
          <div className="text-slate-400">
            UTM: <span className="text-slate-200">{cursorCoordinates.utm.formatted}</span>
          </div>
          {cursorCoordinates.elevation !== null && (
            <div className="text-emerald-400 font-semibold">
              SRTM: {cursorCoordinates.elevation.toFixed(1)} m
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getTileLayer(provider: MapTileProvider): L.TileLayer {
  switch (provider) {
    case 'google-hybrid':
      return L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 21,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      });
    case 'esri-sat':
      return L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
      });
    case 'opentopo':
      return L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17
      });
    case 'carto-dark':
      return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      });
    case 'osm':
    default:
      return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      });
  }
}
