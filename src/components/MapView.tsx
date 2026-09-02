import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Waypoint, FlightLine, TakeoffPoint, UtmCoordinate, SimDronePosition, DrawingMode, PanoramaStation } from '../types';
import { latLngToUtm, getPolygonCentroid, getPolygonAreaM2, getDistanceM } from '../utils/geometry';
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
  PencilLine,
  Spline,
  ZoomIn,
  ZoomOut,
  Info,
  Search,
  Loader2,
  X,
  Building2,
  MapPinCheck,
  Move,
  Plus,
  RotateCw,
  Check,
  ArrowLeftRight,
  Camera
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
  simDronePosition?: SimDronePosition | null;
  gridType: 'single' | 'double' | 'corridor' | 'perimeter';
  drawingMode: DrawingMode;
  setDrawingMode: (mode: DrawingMode) => void;
  panoramaStations?: PanoramaStation[];
  setPanoramaStations?: React.Dispatch<React.SetStateAction<PanoramaStation[]>>;
  selectedPanoramaId?: string | null;
  onSelectPanorama?: (station: PanoramaStation) => void;
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
  setDrawingMode,
  panoramaStations = [],
  setPanoramaStations,
  selectedPanoramaId,
  onSelectPanorama
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Layer groups
  const polygonLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const flightPathLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const waypointsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const panoramaLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const takeoffMarkerRef = useRef<L.Marker | null>(null);
  const simDroneMarkerRef = useRef<L.Marker | null>(null);
  const simFlownPolylineRef = useRef<L.Polyline | null>(null);
  const simFlashMarkerRef = useRef<L.CircleMarker | null>(null);
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
    panoramaLayerGroupRef.current = L.layerGroup().addTo(map);

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
      } else if (drawingMode === 'panorama') {
        const nextNum = (panoramaStations?.length || 0) + 1;
        const pad = String(nextNum).padStart(2, '0');
        const newStation: PanoramaStation = {
          id: `PANO_${String(nextNum).padStart(3, '0')}`,
          nome: `Panorama ${pad}`,
          latitude: newPt[0],
          longitude: newPt[1],
          altitude: 80,
          tipo: 'panorama_360_completo',
          headingInicial: 0,
          hoverEstabilizacao: 2.5,
          hoverFoto: 0.5,
          numeroFotos: 33,
          numeroWaypoints: 66,
          assignedMissionName: 'Missão 1'
        };
        if (setPanoramaStations) {
          setPanoramaStations((prev) => [...prev, newStation]);
        }
        if (onSelectPanorama) {
          onSelectPanorama(newStation);
        }
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [drawingMode, polygon, setPolygon, setTakeoffPoint, setDrawingMode, panoramaStations, setPanoramaStations, onSelectPanorama]);

  // Render Polygon, Draggable Numbered Vertices, Midpoints (+), and Centroid Move handle
  useEffect(() => {
    if (!polygonLayerGroupRef.current || !mapRef.current) return;
    const group = polygonLayerGroupRef.current;
    group.clearLayers();

    if (polygon.length === 0) return;

    const isEditMode = drawingMode === 'edit_polygon' || drawingMode === 'polygon';
    const isClosedPolygon = gridType !== 'corridor' && polygon.length >= 3;

    if (gridType === 'corridor') {
      // Render as corridor polyline
      const polyline = L.polyline(polygon, {
        color: isEditMode ? '#38bdf8' : '#06b6d4',
        weight: 4,
        dashArray: isEditMode ? '6, 6' : '8, 8',
        opacity: 0.95
      });
      group.addLayer(polyline);
    } else if (polygon.length >= 3) {
      // Render as closed polygon
      const poly = L.polygon(polygon, {
        color: isEditMode ? '#38bdf8' : '#06b6d4',
        weight: isEditMode ? 3 : 2.5,
        fillColor: '#0891b2',
        fillOpacity: isEditMode ? 0.25 : 0.18,
        dashArray: isEditMode ? '4, 4' : '6, 6'
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

    // 1. Draggable Numbered Vertex Handles
    polygon.forEach((pt, idx) => {
      const vertexIcon = L.divIcon({
        className: 'custom-vertex-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            background: ${isEditMode ? '#0284c7' : '#0891b2'};
            border: 2.5px solid #ffffff;
            border-radius: 50%;
            color: #ffffff;
            font-family: monospace, sans-serif;
            font-size: 11px;
            font-weight: 800;
            box-shadow: 0 0 10px rgba(6, 182, 212, 0.8), 0 2px 5px rgba(0,0,0,0.5);
            cursor: grab;
            user-select: none;
            transition: transform 0.15s ease;
          ">
            ${idx + 1}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker(pt, {
        icon: vertexIcon,
        draggable: true,
        zIndexOffset: 500
      });

      marker.on('drag', (e: any) => {
        const newLatLng = e.target.getLatLng();
        const updated = [...polygon];
        updated[idx] = [newLatLng.lat, newLatLng.lng];
        setPolygon(updated);
      });

      const utm = latLngToUtm(pt[0], pt[1]);
      marker.bindTooltip(
        `<b>Vértice #${idx + 1}</b><br/>Lat: ${pt[0].toFixed(5)}°<br/>Lng: ${pt[1].toFixed(5)}°<br/>UTM: ${utm.formatted}<br/><span style="color:#38bdf8; font-size:10px;">Arraste para mover | Botão direito para excluir</span>`,
        { direction: 'top', offset: [0, -12] }
      );

      // Popup with explicit delete vertex button
      const popupContent = document.createElement('div');
      popupContent.style.cssText = 'min-width: 140px; font-family: sans-serif; font-size: 12px;';
      popupContent.innerHTML = `
        <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">Vértice #${idx + 1}</div>
        <div style="color: #64748b; font-size: 11px; margin-bottom: 6px;">${pt[0].toFixed(5)}°, ${pt[1].toFixed(5)}°</div>
      `;

      if (polygon.length > (gridType === 'corridor' ? 2 : 3)) {
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Excluir Vértice';
        delBtn.style.cssText = 'width: 100%; background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11px;';
        delBtn.onclick = () => {
          const updated = polygon.filter((_, i) => i !== idx);
          setPolygon(updated);
        };
        popupContent.appendChild(delBtn);
      }

      marker.bindPopup(popupContent, { offset: [0, -10] });

      // Right click or double click to quickly remove vertex
      marker.on('contextmenu', () => {
        if (polygon.length > (gridType === 'corridor' ? 2 : 3)) {
          const updated = polygon.filter((_, i) => i !== idx);
          setPolygon(updated);
        }
      });

      group.addLayer(marker);
    });

    // 2. Midpoint handles (+) between consecutive vertices to insert new vertices
    const numEdges = isClosedPolygon ? polygon.length : polygon.length - 1;
    for (let i = 0; i < numEdges; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      const midLat = (p1[0] + p2[0]) / 2;
      const midLng = (p1[1] + p2[1]) / 2;

      const midIcon = L.divIcon({
        className: 'custom-midpoint-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            background: rgba(14, 165, 233, 0.85);
            border: 2px solid #ffffff;
            border-radius: 50%;
            color: #ffffff;
            font-size: 14px;
            font-weight: 900;
            line-height: 1;
            box-shadow: 0 0 6px rgba(0,0,0,0.5);
            cursor: pointer;
            user-select: none;
            transition: all 0.15s ease;
          ">
            +
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const midMarker = L.marker([midLat, midLng], {
        icon: midIcon,
        draggable: true,
        zIndexOffset: 300
      });

      midMarker.bindTooltip('<b>Inserir Vértice</b><br/>Clique ou arraste para adicionar ponto nesta aresta', {
        direction: 'top',
        offset: [0, -10]
      });

      // When dragging or clicking midpoint, insert vertex into polygon array
      midMarker.on('dragstart', () => {
        const updated = [...polygon.slice(0, i + 1), [midLat, midLng] as [number, number], ...polygon.slice(i + 1)];
        setPolygon(updated);
      });

      midMarker.on('click', () => {
        const updated = [...polygon.slice(0, i + 1), [midLat, midLng] as [number, number], ...polygon.slice(i + 1)];
        setPolygon(updated);
      });

      group.addLayer(midMarker);
    }

    // 3. Centroid Move Handle (Translates entire polygon across map)
    if (isClosedPolygon) {
      const centroid = getPolygonCentroid(polygon);
      const centroidIcon = L.divIcon({
        className: 'custom-centroid-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            background: rgba(15, 23, 42, 0.9);
            border: 2px solid #38bdf8;
            border-radius: 8px;
            color: #38bdf8;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);
            cursor: move;
            transition: all 0.15s ease;
          ">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="5 9 2 12 5 15"></polyline>
              <polyline points="9 5 12 2 15 5"></polyline>
              <polyline points="15 19 12 22 9 19"></polyline>
              <polyline points="19 9 22 12 19 15"></polyline>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <line x1="12" y1="2" x2="12" y2="22"></line>
            </svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const centroidMarker = L.marker(centroid, {
        icon: centroidIcon,
        draggable: true,
        zIndexOffset: 400
      });

      centroidMarker.bindTooltip('<b>Mover Toda a Área</b><br/>Arraste para reposicionar o polígono completo no mapa', {
        direction: 'top',
        offset: [0, -14]
      });

      let dragStartLatLng = L.latLng(centroid[0], centroid[1]);
      centroidMarker.on('dragstart', (e: any) => {
        dragStartLatLng = e.target.getLatLng();
      });

      centroidMarker.on('drag', (e: any) => {
        const currentLatLng = e.target.getLatLng();
        const dLat = currentLatLng.lat - dragStartLatLng.lat;
        const dLng = currentLatLng.lng - dragStartLatLng.lng;
        dragStartLatLng = currentLatLng;

        const updated = polygon.map(([lat, lng]) => [lat + dLat, lng + dLng] as [number, number]);
        setPolygon(updated);
      });

      group.addLayer(centroidMarker);
    }
  }, [polygon, gridType, drawingMode, setPolygon]);

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

  // Render 360° Panorama Stations Layer
  useEffect(() => {
    if (!panoramaLayerGroupRef.current || !mapRef.current) return;
    const panoGroup = panoramaLayerGroupRef.current;
    panoGroup.clearLayers();

    if (panoramaStations.length === 0) return;

    // Draw connected path line between consecutive panorama stations
    if (panoramaStations.length > 1) {
      const panoLatLngs = panoramaStations.map((s) => [s.latitude, s.longitude] as [number, number]);
      const panoFlightTrack = L.polyline(panoLatLngs, {
        color: '#10b981',
        weight: 3,
        dashArray: '6, 6',
        opacity: 0.85
      });
      panoGroup.addLayer(panoFlightTrack);
    }

    // Render individual Panorama Station Markers
    panoramaStations.forEach((station, idx) => {
      const isSelected = selectedPanoramaId === station.id;
      const markerNumber = idx + 1;

      const panoIcon = L.divIcon({
        className: 'custom-panorama-marker',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isSelected ? '38px' : '32px'};
            height: ${isSelected ? '38px' : '32px'};
            background: ${isSelected ? '#059669' : '#047857'};
            border: ${isSelected ? '3px solid #34d399' : '2px solid #ffffff'};
            border-radius: 50%;
            color: #ffffff;
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-weight: 800;
            font-size: 12px;
            box-shadow: 0 0 ${isSelected ? '14px rgba(52, 211, 153, 0.9)' : '8px rgba(0,0,0,0.5)'};
            cursor: grab;
            user-select: none;
            transition: all 0.15s ease;
          ">
            <span>P${markerNumber}</span>
            <div style="
              position: absolute;
              bottom: -6px;
              right: -6px;
              background: #0f172a;
              border: 1.5px solid #34d399;
              border-radius: 6px;
              padding: 0 3px;
              font-size: 8px;
              color: #34d399;
              font-weight: 900;
            ">360°</div>
          </div>
        `,
        iconSize: [isSelected ? 38 : 32, isSelected ? 38 : 32],
        iconAnchor: [isSelected ? 19 : 16, isSelected ? 19 : 16]
      });

      const marker = L.marker([station.latitude, station.longitude], {
        icon: panoIcon,
        draggable: true,
        zIndexOffset: isSelected ? 500 : 250
      });

      marker.bindTooltip(
        `<b>${station.nome}</b> (360° × 180°)<br/>` +
          `Alt: ${station.altitude} m AGL<br/>` +
          `Heading: ${station.headingInicial}° | ${station.numeroFotos} fotos (${station.numeroWaypoints} WP)<br/>` +
          `<span style="color:#34d399;">${station.assignedMissionName || 'Missão 1'}</span>`,
        { direction: 'top', offset: [0, -18], className: 'custom-leaflet-tooltip' }
      );

      marker.on('click', () => {
        if (onSelectPanorama) onSelectPanorama(station);
      });

      marker.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng();
        if (setPanoramaStations) {
          setPanoramaStations((prev) =>
            prev.map((s) => (s.id === station.id ? { ...s, latitude: latlng.lat, longitude: latlng.lng } : s))
          );
        }
      });

      panoGroup.addLayer(marker);
    });
  }, [panoramaStations, selectedPanoramaId, onSelectPanorama, setPanoramaStations]);

  // Render Live Simulation Drone Icon, Flown Trail and Photo Flash
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (!isSimulating || !simDronePosition) {
      if (simDroneMarkerRef.current) {
        map.removeLayer(simDroneMarkerRef.current);
        simDroneMarkerRef.current = null;
      }
      if (simFlownPolylineRef.current) {
        map.removeLayer(simFlownPolylineRef.current);
        simFlownPolylineRef.current = null;
      }
      if (simFlashMarkerRef.current) {
        map.removeLayer(simFlashMarkerRef.current);
        simFlashMarkerRef.current = null;
      }
      return;
    }

    // High-visibility Quadcopter SVG with rotating rotors and heading arrow
    const droneHtml = `
      <div style="
        position: relative;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <!-- Directional Drone Body & Rotors -->
        <div style="
          width: 44px;
          height: 44px;
          transform: rotate(${simDronePosition.heading}deg);
          transition: transform 0.08s linear;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg viewBox="0 0 64 64" width="44" height="44" style="filter: drop-shadow(0 0 6px rgba(6,182,212,0.9));">
            <!-- Drone Arms -->
            <line x1="16" y1="16" x2="48" y2="48" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
            <line x1="48" y1="16" x2="16" y2="48" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
            
            <!-- Motor Hubs & Rotors -->
            <circle cx="16" cy="16" r="6" fill="#0ea5e9" stroke="#ffffff" stroke-width="2"/>
            <circle cx="48" cy="16" r="6" fill="#0ea5e9" stroke="#ffffff" stroke-width="2"/>
            <circle cx="16" cy="48" r="6" fill="#0ea5e9" stroke="#ffffff" stroke-width="2"/>
            <circle cx="48" cy="48" r="6" fill="#0ea5e9" stroke="#ffffff" stroke-width="2"/>
            
            <!-- Central Fuselage -->
            <circle cx="32" cy="32" r="11" fill="#0284c7" stroke="#ffffff" stroke-width="2.5"/>
            
            <!-- Direction Heading Pointer (Front Arrow) -->
            <polygon points="32,15 37,28 32,24 27,28" fill="#facc15" stroke="#ffffff" stroke-width="1"/>
            
            <!-- Center LED Pulse -->
            <circle cx="32" cy="32" r="4" fill="#38bdf8"/>
          </svg>
        </div>

        <!-- Altitude Badge Tag -->
        <div style="
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid #06b6d4;
          border-radius: 6px;
          padding: 1px 4px;
          color: #38bdf8;
          font-family: monospace;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          pointer-events: none;
        ">
          ${simDronePosition.altAgl.toFixed(0)}m AGL
        </div>
      </div>
    `;

    const droneIcon = L.divIcon({
      className: 'sim-drone-marker',
      html: droneHtml,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    if (!simDroneMarkerRef.current) {
      simDroneMarkerRef.current = L.marker([simDronePosition.lat, simDronePosition.lng], {
        icon: droneIcon,
        zIndexOffset: 2000
      }).addTo(map);
    } else {
      simDroneMarkerRef.current.setLatLng([simDronePosition.lat, simDronePosition.lng]);
      simDroneMarkerRef.current.setIcon(droneIcon);
    }

    // Draw active Flown Path trail
    if (simDronePosition.flownPath && simDronePosition.flownPath.length > 1) {
      if (!simFlownPolylineRef.current) {
        simFlownPolylineRef.current = L.polyline(simDronePosition.flownPath, {
          color: '#06b6d4',
          weight: 4,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      } else {
        simFlownPolylineRef.current.setLatLngs(simDronePosition.flownPath);
      }
    }

    // Photo shutter flash effect on map
    if (simDronePosition.isTakingPhoto) {
      if (!simFlashMarkerRef.current) {
        simFlashMarkerRef.current = L.circleMarker([simDronePosition.lat, simDronePosition.lng], {
          radius: 18,
          color: '#fbbf24',
          weight: 3,
          fillColor: '#fef08a',
          fillOpacity: 0.7
        }).addTo(map);
      } else {
        simFlashMarkerRef.current.setLatLng([simDronePosition.lat, simDronePosition.lng]);
        simFlashMarkerRef.current.setStyle({ fillOpacity: 0.7, opacity: 1 });
      }
    } else if (simFlashMarkerRef.current) {
      map.removeLayer(simFlashMarkerRef.current);
      simFlashMarkerRef.current = null;
    }

    // Smoothly pan map if drone is nearing edge of screen
    const mapBounds = map.getBounds();
    const droneLatLng = L.latLng(simDronePosition.lat, simDronePosition.lng);
    if (!mapBounds.pad(-0.1).contains(droneLatLng)) {
      map.panTo(droneLatLng, { animate: true, duration: 0.2 });
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
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-bold'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
              title="Clique no mapa para adicionar novos vértices do polígono"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Polígono</span>
            </button>

            <button
              id="btn-edit-polygon"
              onClick={() => setDrawingMode(drawingMode === 'edit_polygon' ? 'none' : 'edit_polygon')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                drawingMode === 'edit_polygon'
                  ? 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/30 font-bold'
                  : polygon.length > 0
                  ? 'text-sky-400 hover:bg-slate-800'
                  : 'text-slate-500 hover:bg-slate-800'
              }`}
              title="Editar vértices do polígono: arrastar pontos, adicionar novos nós ou mover área inteira"
            >
              <PencilLine className="w-3.5 h-3.5" />
              <span>Editar Polígono</span>
            </button>

            <button
              id="btn-draw-corridor"
              onClick={() => setDrawingMode(drawingMode === 'corridor' ? 'none' : 'corridor')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                drawingMode === 'corridor'
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 font-bold'
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
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-bold'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
              title="Clique no mapa para definir o ponto de decolagem (Home Point)"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Decolagem (Home)</span>
            </button>

            <button
              id="btn-add-panorama"
              onClick={() => setDrawingMode(drawingMode === 'panorama' ? 'none' : 'panorama')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                drawingMode === 'panorama'
                  ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 font-bold ring-2 ring-emerald-300'
                  : 'text-slate-200 hover:bg-slate-800'
              }`}
              title="Clique no mapa para posicionar uma Estação Panorâmica 360°"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>360° Pan</span>
              {panoramaStations.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700">
                  {panoramaStations.length}
                </span>
              )}
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

          {/* Floating Polygon Editing HUD Bar */}
          {(drawingMode === 'edit_polygon' || (drawingMode === 'polygon' && polygon.length > 0)) && (
            <div className="bg-slate-900/95 backdrop-blur-md border border-sky-500/40 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 max-w-xs animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                  <PencilLine className="w-3.5 h-3.5" />
                  <span>Edição ({polygon.length} vértices)</span>
                </span>
                <button
                  onClick={() => setDrawingMode('none')}
                  className="text-xs font-bold text-slate-300 hover:text-white px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center gap-1 transition-colors border border-slate-700"
                  title="Concluir edição"
                >
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Concluir</span>
                </button>
              </div>

              {polygon.length >= 3 && gridType !== 'corridor' && (
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono bg-slate-950/70 p-2 rounded-xl border border-slate-800">
                  <div className="text-slate-400">
                    Área: <span className="text-emerald-400 font-bold">{(getPolygonAreaM2(polygon) / 10000).toFixed(2)} ha</span>
                  </div>
                  <div className="text-slate-400">
                    Perímetro: <span className="text-cyan-400 font-bold">{polygon.reduce((acc, pt, i) => acc + getDistanceM(pt[0], pt[1], polygon[(i + 1) % polygon.length][0], polygon[(i + 1) % polygon.length][1]), 0).toFixed(0)} m</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-0.5">
                <button
                  onClick={() => setDrawingMode('polygon')}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
                    drawingMode === 'polygon' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title="Clique no mapa para inserir novos vértices"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Inserir Pontos</span>
                </button>

                <button
                  onClick={() => setPolygon([...polygon].reverse())}
                  className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="Inverter sentido dos vértices"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Inverter</span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                💡 <b>Dicas:</b> Arraste os nós numerados para mover. Clique no <b>+</b> entre os pontos para criar vértices. Arraste o ícone central para mover a área toda.
              </p>
            </div>
          )}

          {/* Informative helper badge when drawing other modes */}
          {drawingMode !== 'none' && drawingMode !== 'edit_polygon' && drawingMode !== 'polygon' && (
            <div className="bg-cyan-950/90 backdrop-blur-md border border-cyan-700/50 rounded-lg px-3 py-2 text-xs text-cyan-200 flex items-center gap-2 shadow-lg animate-pulse max-w-sm">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                {drawingMode === 'corridor' && 'Clique no mapa ao longo da rodovia/canal/linha.'}
                {drawingMode === 'takeoff' && 'Clique onde o drone irá decolar para registrar a cota de referência.'}
                {drawingMode === 'panorama' && 'Clique no mapa para posicionar uma Estação Panorâmica 360° (33 fotos / 66 waypoints).'}
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
