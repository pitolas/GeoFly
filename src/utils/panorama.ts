import { PanoramaStation, PanoramaType, PanoramaMissionGroup, Waypoint } from '../types';
import { latLngToUtm } from './geometry';

export interface PanoramaLevelDef {
  gimbalPitch: number;
  headings: number[];
}

/** 4 níveis horizontais (+55°, +15°, -25°, -65°) de 8 fotos cada + 1 nadir (-90°) = 33 fotos */
export const DEFAULT_PANORAMA_LEVELS: PanoramaLevelDef[] = [
  { gimbalPitch: 55, headings: [0, 45, 90, 135, 180, 225, 270, 315] },
  { gimbalPitch: 15, headings: [0, 45, 90, 135, 180, 225, 270, 315] },
  { gimbalPitch: -25, headings: [0, 45, 90, 135, 180, 225, 270, 315] },
  { gimbalPitch: -65, headings: [0, 45, 90, 135, 180, 225, 270, 315] },
  { gimbalPitch: -90, headings: [0] }
];

/** Modo teste - Panorama parcial (1 nível horizontal de 8 fotos) = 8 fotos / 16 waypoints */
export const TEST_PANORAMA_LEVELS: PanoramaLevelDef[] = [
  { gimbalPitch: 15, headings: [0, 45, 90, 135, 180, 225, 270, 315] }
];

/** Retorna a quantidade de waypoints gerados por uma estação panorâmica */
export function getGeneratedWaypointCount(station: PanoramaStation): number {
  if (station.tipo === 'panorama_parcial_teste') {
    return 16;
  }
  return 66;
}

/** Retorna a quantidade de fotografias geradas por uma estação panorâmica */
export function getGeneratedPhotoCount(station: PanoramaStation): number {
  if (station.tipo === 'panorama_parcial_teste') {
    return 8;
  }
  return 33;
}

/** Obtém a lista de níveis de captura para uma estação */
export function getStationLevels(station: PanoramaStation): PanoramaLevelDef[] {
  if (station.tipo === 'panorama_parcial_teste') {
    return TEST_PANORAMA_LEVELS;
  }

  const p1 = station.gimbalLevel1 ?? 55;
  const p2 = station.gimbalLevel2 ?? 15;
  const p3 = station.gimbalLevel3 ?? -25;
  const p4 = station.gimbalLevel4 ?? -65;
  const pNadir = station.gimbalNadir ?? -90;
  const step = station.horizontalStepDeg ?? 45;
  const numHorizontal = Math.max(4, Math.min(16, station.photosPerLevel ?? 8));

  const horizontalHeadings: number[] = [];
  for (let i = 0; i < numHorizontal; i++) {
    horizontalHeadings.push(i * step);
  }

  return [
    { gimbalPitch: p1, headings: horizontalHeadings },
    { gimbalPitch: p2, headings: horizontalHeadings },
    { gimbalPitch: p3, headings: horizontalHeadings },
    { gimbalPitch: p4, headings: horizontalHeadings },
    { gimbalPitch: pNadir, headings: [0] }
  ];
}

/**
 * Expande 1 estação panorâmica em waypoints DJI
 * Padrão: 33 fotos = 66 waypoints
 * Cada foto = Par de Waypoints:
 * - Waypoint A (Estabilização): hover 2.5s, gimbalRotate, sem foto
 * - Waypoint B (Fotografia): hover 0.5s, takePhoto
 */
export function expandPanoramaStation(
  station: PanoramaStation,
  startIndex: number = 0,
  defaultSpeed: number = 3.0,
  terrainElevationMsl: number = 0
): Waypoint[] {
  const levels = getStationLevels(station);
  const waypoints: Waypoint[] = [];
  let currentId = startIndex + 1;
  const utm = latLngToUtm(station.latitude, station.longitude);
  const altAgl = Math.max(2, station.altitude);
  const altMsl = terrainElevationMsl + altAgl;

  for (const level of levels) {
    for (const relativeHeading of level.headings) {
      const heading = (station.headingInicial + relativeHeading) % 360;

      // Waypoint A — estabilização
      waypoints.push({
        id: currentId++,
        lat: station.latitude,
        lng: station.longitude,
        altitudeAgl: altAgl,
        altitudeMsl: altMsl,
        groundElevation: terrainElevationMsl,
        speedMs: defaultSpeed,
        action: 'turn',
        headingDeg: Math.round(heading),
        gimbalPitchDeg: level.gimbalPitch,
        distanceToNextM: 0,
        cumulativeDistanceM: 0,
        timeToNextSec: station.hoverEstabilizacao ?? 2.5,
        cumulativeTimeSec: 0,
        utm,
        batchIndex: 0,
        isPhotoPoint: false
      });

      // Waypoint B — fotografia
      waypoints.push({
        id: currentId++,
        lat: station.latitude,
        lng: station.longitude,
        altitudeAgl: altAgl,
        altitudeMsl: altMsl,
        groundElevation: terrainElevationMsl,
        speedMs: defaultSpeed,
        action: 'photo',
        headingDeg: Math.round(heading),
        gimbalPitchDeg: level.gimbalPitch,
        distanceToNextM: 0,
        cumulativeDistanceM: 0,
        timeToNextSec: station.hoverFoto ?? 0.5,
        cumulativeTimeSec: 0,
        utm,
        batchIndex: 0,
        isPhotoPoint: true
      });
    }
  }

  return waypoints;
}

/** Validação estrita de uma estação panorâmica antes da exportação */
export function validatePanoramaStation(station: PanoramaStation): { valid: boolean; error?: string } {
  if (isNaN(station.latitude) || station.latitude < -90 || station.latitude > 90) {
    return { valid: false, error: `Latitude inválida para ${station.nome}: ${station.latitude}` };
  }
  if (isNaN(station.longitude) || station.longitude < -180 || station.longitude > 180) {
    return { valid: false, error: `Longitude inválida para ${station.nome}: ${station.longitude}` };
  }
  if (isNaN(station.altitude) || station.altitude < 1 || !isFinite(station.altitude)) {
    return { valid: false, error: `Altitude inválida para ${station.nome}: ${station.altitude} m` };
  }
  if (isNaN(station.headingInicial) || station.headingInicial < 0 || station.headingInicial >= 360) {
    return { valid: false, error: `Heading inicial inválido para ${station.nome}: ${station.headingInicial}°` };
  }
  if (isNaN(station.hoverEstabilizacao) || station.hoverEstabilizacao < 0.5 || station.hoverEstabilizacao > 60) {
    return { valid: false, error: `Tempo de estabilização inválido para ${station.nome}: ${station.hoverEstabilizacao}s` };
  }
  if (isNaN(station.hoverFoto) || station.hoverFoto < 0 || station.hoverFoto > 30) {
    return { valid: false, error: `Tempo de hover pós-foto inválido para ${station.nome}: ${station.hoverFoto}s` };
  }

  const expectedPhotos = getGeneratedPhotoCount(station);
  const expectedWp = getGeneratedWaypointCount(station);
  if (station.tipo === 'panorama_360_completo' && (expectedPhotos !== 33 || expectedWp !== 66)) {
    return {
      valid: false,
      error: `Erro ao gerar Estação Panorâmica 360°. A sequência esperada contém 33 fotografias e 66 waypoints, mas foi detectada uma estrutura diferente (${expectedPhotos} fotos / ${expectedWp} waypoints).`
    };
  }

  return { valid: true };
}

/**
 * Algoritmo de divisão automática de missões panorâmicas com limite MAX 200 WP
 * REGRA FUNDAMENTAL: Uma estação panorâmica NUNCA é dividida entre dois arquivos KMZ.
 * Todos os 66 waypoints de uma estação permanecem juntos.
 */
export function dividePanoramaMissions(
  stations: PanoramaStation[],
  projectName: string = 'Missao_360',
  maxWaypoints: number = 200,
  defaultSpeed: number = 3.0,
  terrainElevationMap?: Record<string, number>
): PanoramaMissionGroup[] {
  if (stations.length === 0) return [];

  const missionGroups: PanoramaMissionGroup[] = [];
  let currentGroupStations: PanoramaStation[] = [];
  let currentGroupWpCount = 0;

  for (const station of stations) {
    const stationWpCount = getGeneratedWaypointCount(station);

    // Se ultrapassar o limite de 200 waypoints, fecha o grupo atual e abre nova missão
    if (currentGroupWpCount + stationWpCount > maxWaypoints && currentGroupStations.length > 0) {
      const missionIndex = missionGroups.length;
      const numMissionPad = String(missionIndex + 1).padStart(2, '0');
      const missionName = `${projectName}_DJI_Missao_${numMissionPad}`;

      // Expande waypoints deste grupo
      let groupWaypoints: Waypoint[] = [];
      for (const st of currentGroupStations) {
        st.assignedMissionIndex = missionIndex;
        st.assignedMissionName = `Missão ${missionIndex + 1}`;
        const terrain = terrainElevationMap?.[st.id] ?? 0;
        const expanded = expandPanoramaStation(st, groupWaypoints.length, defaultSpeed, terrain);
        groupWaypoints = groupWaypoints.concat(expanded);
      }

      missionGroups.push({
        missionIndex,
        missionName,
        stations: [...currentGroupStations],
        waypoints: groupWaypoints,
        totalWaypoints: groupWaypoints.length,
        totalPhotos: groupWaypoints.filter((w) => w.isPhotoPoint).length
      });

      currentGroupStations = [];
      currentGroupWpCount = 0;
    }

    currentGroupStations.push(station);
    currentGroupWpCount += stationWpCount;
  }

  // Adiciona o último grupo
  if (currentGroupStations.length > 0) {
    const missionIndex = missionGroups.length;
    const numMissionPad = String(missionIndex + 1).padStart(2, '0');
    const missionName = `${projectName}_DJI_Missao_${numMissionPad}`;

    let groupWaypoints: Waypoint[] = [];
    for (const st of currentGroupStations) {
      st.assignedMissionIndex = missionIndex;
      st.assignedMissionName = `Missão ${missionIndex + 1}`;
      const terrain = terrainElevationMap?.[st.id] ?? 0;
      const expanded = expandPanoramaStation(st, groupWaypoints.length, defaultSpeed, terrain);
      groupWaypoints = groupWaypoints.concat(expanded);
    }

    missionGroups.push({
      missionIndex,
      missionName,
      stations: [...currentGroupStations],
      waypoints: groupWaypoints,
      totalWaypoints: groupWaypoints.length,
      totalPhotos: groupWaypoints.filter((w) => w.isPhotoPoint).length
    });
  }

  return missionGroups;
}

/** Gera o arquivo resumo_missoes.txt formatado conforme especificação */
export function generateMissionSummaryText(
  projectName: string,
  missionGroups: PanoramaMissionGroup[],
  totalStations: number
): string {
  const totalPhotos = missionGroups.reduce((acc, g) => acc + g.totalPhotos, 0);
  const totalWaypoints = missionGroups.reduce((acc, g) => acc + g.totalWaypoints, 0);
  const totalKmz = missionGroups.length;

  let text = `Projeto: ${projectName}\n\n`;
  text += `Estações panorâmicas: ${totalStations}\n`;
  text += `Fotografias previstas: ${totalPhotos}\n`;
  text += `Waypoints totais: ${totalWaypoints}\n`;
  text += `Arquivos KMZ: ${totalKmz}\n\n`;

  missionGroups.forEach((group, idx) => {
    const padIndex = String(idx + 1).padStart(2, '0');
    text += `Missão ${padIndex}:\n`;
    group.stations.forEach((st) => {
      text += `${st.nome}\n`;
    });
    text += `${group.totalWaypoints} waypoints\n\n`;
  });

  return text.trimEnd() + '\n';
}
