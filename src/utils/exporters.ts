import JSZip from 'jszip';
import { DroneCameraProfile, FlightConfig, Waypoint, TakeoffPoint } from '../types';

/** Helper to trigger browser download of text/blob */
export function downloadFile(filename: string, content: string | Blob, mimeType: string = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Generate Google Earth KML string */
export function generateGoogleEarthKml(
  missionName: string,
  polygon: [number, number][],
  waypoints: Waypoint[],
  takeoffPoint?: TakeoffPoint,
  altitudeMode: string = 'relativeToGround'
): string {
  const polyCoordinates = polygon.map(([lat, lng]) => `${lng},${lat},0`).join(' ');
  const flightPathCoordinates = waypoints.map((w) => `${w.lng},${w.lat},${w.altitudeAgl}`).join(' ');

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${missionName} - GeoFly Plan</name>
    <description>Plano de voo gerado no GeoFly - Mapeamento com Acompanhamento de Terreno SRTM</description>
    
    <Style id="polyStyle">
      <LineStyle>
        <color>ff00ffff</color>
        <width>2</width>
      </LineStyle>
      <PolyStyle>
        <color>3300ffff</color>
      </PolyStyle>
    </Style>
    
    <Style id="pathStyle">
      <LineStyle>
        <color>ffffaa00</color>
        <width>3</width>
      </LineStyle>
    </Style>

    <Style id="takeoffPin">
      <IconStyle>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
        <color>ff00ff00</color>
      </IconStyle>
    </Style>

    <Folder>
      <name>Área de Mapeamento</name>
      <Placemark>
        <name>Polígono da Missão</name>
        <styleUrl>#polyStyle</styleUrl>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${polyCoordinates} ${polygon.length > 0 ? `${polygon[0][1]},${polygon[0][0]},0` : ''}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    </Folder>

    <Folder>
      <name>Rota de Voo 3D</name>
      <Placemark>
        <name>Linha de Voo Waypoints</name>
        <styleUrl>#pathStyle</styleUrl>
        <LineString>
          <extrude>1</extrude>
          <tessellate>1</tessellate>
          <altitudeMode>${altitudeMode === 'MSL' ? 'absolute' : 'relativeToGround'}</altitudeMode>
          <coordinates>
            ${flightPathCoordinates}
          </coordinates>
        </LineString>
      </Placemark>
    </Folder>

    <Folder>
      <name>Waypoints (${waypoints.length} pontos)</name>
`;

  waypoints.forEach((wp) => {
    kml += `      <Placemark>
        <name>WPT #${wp.id} ${wp.isPhotoPoint ? '📷' : '🔄'}</name>
        <description><![CDATA[
          <b>Ação:</b> ${wp.action}<br/>
          <b>Altitude Relativa (AGL):</b> ${wp.altitudeAgl.toFixed(1)} m<br/>
          <b>Altitude MSL:</b> ${wp.altitudeMsl.toFixed(1)} m<br/>
          <b>Cota Solo SRTM:</b> ${wp.groundElevation.toFixed(1)} m<br/>
          <b>Velocidade:</b> ${wp.speedMs} m/s<br/>
          <b>Azimute:</b> ${wp.headingDeg}°<br/>
          <b>UTM:</b> ${wp.utm.formatted}
        ]]></description>
        <Point>
          <altitudeMode>${altitudeMode === 'MSL' ? 'absolute' : 'relativeToGround'}</altitudeMode>
          <coordinates>${wp.lng},${wp.lat},${wp.altitudeAgl}</coordinates>
        </Point>
      </Placemark>
`;
  });

  if (takeoffPoint) {
    kml += `      <Placemark>
        <name>Ponto de Decolagem (Home)</name>
        <styleUrl>#takeoffPin</styleUrl>
        <Point>
          <coordinates>${takeoffPoint.lng},${takeoffPoint.lat},0</coordinates>
        </Point>
      </Placemark>
`;
  }

  kml += `    </Folder>
  </Document>
</kml>`;

  return kml;
}

/** Export standard Google Earth KMZ file (compressed doc.kml) */
export async function exportGoogleEarthKmz(
  missionName: string,
  polygon: [number, number][],
  waypoints: Waypoint[],
  takeoffPoint?: TakeoffPoint,
  altitudeMode: string = 'relativeToGround'
): Promise<void> {
  const zip = new JSZip();
  const kml = generateGoogleEarthKml(missionName, polygon, waypoints, takeoffPoint, altitudeMode);
  zip.file('doc.kml', kml);
  const content = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
  downloadFile(`${cleanFilename(missionName)}_GoogleEarth.kmz`, content, 'application/vnd.google-earth.kmz');
}

/** Generate DJI WPML XML / KML files inside KMZ */
function getDjiDroneInfo(droneId: string): {
  droneEnumValue: number;
  droneSubEnumValue: number;
  payloadEnumValue: number;
  payloadSubEnumValue: number;
} {
  switch (droneId) {
    case 'dji-mini-4-pro':
    case 'dji-mini-3-12mp':
    case 'dji-mini-2':
    case 'dji-air-3-wide':
    case 'dji-mavic-3-classic':
      // DJI Fly / Mini 4 Pro functional GeoWay values
      return { droneEnumValue: 67, droneSubEnumValue: 0, payloadEnumValue: 53, payloadSubEnumValue: 0 };
    case 'dji-air-2s':
      return { droneEnumValue: 48, droneSubEnumValue: 0, payloadEnumValue: 43, payloadSubEnumValue: 0 };
    case 'dji-mavic-3-enterprise':
      return { droneEnumValue: 77, droneSubEnumValue: 0, payloadEnumValue: 66, payloadSubEnumValue: 0 };
    case 'dji-mavic-3-multispectral':
      return { droneEnumValue: 77, droneSubEnumValue: 2, payloadEnumValue: 68, payloadSubEnumValue: 0 };
    case 'dji-phantom-4-pro-rtk':
      return { droneEnumValue: 44, droneSubEnumValue: 0, payloadEnumValue: 39, payloadSubEnumValue: 0 };
    case 'dji-matrice-350-p1-35mm':
      return { droneEnumValue: 80, droneSubEnumValue: 0, payloadEnumValue: 42, payloadSubEnumValue: 0 };
    default:
      return { droneEnumValue: 67, droneSubEnumValue: 0, payloadEnumValue: 53, payloadSubEnumValue: 0 };
  }
}

function getWpmlFinishAction(action: string): string {
  switch (action) {
    case 'RTH':
      return 'goHome';
    case 'LAND':
      return 'autoLand';
    case 'HOVER':
      return 'noAction';
    case 'GOTO_FIRST':
      return 'gotoFirstWaypoint';
    default:
      return 'goHome';
  }
}

export function generateDjiWpmlFiles(
  missionName: string,
  waypoints: Waypoint[],
  camera: DroneCameraProfile,
  config: FlightConfig,
  takeoffPoint?: TakeoffPoint
): { templateKml: string; waylinesWpml: string } {
  // DJI WPML requires Unix timestamp in milliseconds as an integer
  const timestampMs = Date.now();
  const droneEnum = getDjiDroneInfo(config.droneId);
  const finishAction = getWpmlFinishAction(config.finishAction);
  const defaultAltitude = Math.max(2, config.targetAltitudeAgl);
  const defaultSpeed = Math.max(1, config.flightSpeedMs);

  // Helper to generate placemarks for waylines.wpml (execution file)
  const generateWaylinesPlacemarks = () => {
    let placemarksStr = '';
    waypoints.forEach((wp, idx) => {
      const safeHeading = isNaN(wp.headingDeg) ? 0 : Math.round(wp.headingDeg);
      const safeAltitude = Math.max(2, isNaN(wp.altitudeAgl) ? defaultAltitude : wp.altitudeAgl);
      const safeSpeed = Math.max(1, isNaN(wp.speedMs) ? defaultSpeed : wp.speedMs);

      let actionGroupXml = '';
      if (idx === 0) {
        // First waypoint: gimbalRotate + hover 2.5s + optional takePhoto
        actionGroupXml = `        <wpml:actionGroup>
          <wpml:actionGroupId>0</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>0</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>0</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>${config.gimbalPitchDeg}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
          <wpml:action>
            <wpml:actionId>1</wpml:actionId>
            <wpml:actionActuatorFunc>hover</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:hoverTime>2.5</wpml:hoverTime>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
          ${
            wp.isPhotoPoint
              ? `<wpml:action>
            <wpml:actionId>2</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>`
              : ''
          }
        </wpml:actionGroup>
`;
      } else if (wp.isPhotoPoint) {
        // Subsequent photo points: single takePhoto action without fileSuffix
        actionGroupXml = `        <wpml:actionGroup>
          <wpml:actionGroupId>${idx}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${idx}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${idx}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>0</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>
`;
      }

      placemarksStr += `      <Placemark>
        <wpml:index>${idx}</wpml:index>
        <Point>
          <coordinates>${wp.lng.toFixed(8)},${wp.lat.toFixed(8)},0</coordinates>
        </Point>
        <wpml:executeHeight>${safeAltitude.toFixed(2)}</wpml:executeHeight>
        <wpml:waypointSpeed>${safeSpeed.toFixed(1)}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>coordinateTurn</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0.2</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
${actionGroupXml}      </Placemark>
`;
    });
    return placemarksStr;
  };

  // 1. Template KML (Contains ZERO Placemarks in GeoWay compatible structure)
  const templateKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:author>GeoFly</wpml:author>
    <wpml:createTime>${timestampMs}</wpml:createTime>
    <wpml:updateTime>${timestampMs}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${finishAction}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>20</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>${defaultSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnum.droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>${droneEnum.droneSubEnumValue}</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateType>waypoint</wpml:templateType>
      <wpml:templateId>0</wpml:templateId>
      <wpml:globalHeight>${defaultAltitude.toFixed(2)}</wpml:globalHeight>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineCoordinateSysParam>
        <wpml:coordinateMode>WGS84</wpml:coordinateMode>
        <wpml:heightMode>relativeToStartPoint</wpml:heightMode>
      </wpml:waylineCoordinateSysParam>
      <wpml:autoFlightSpeed>${defaultSpeed.toFixed(1)}</wpml:autoFlightSpeed>
      <wpml:gimbalPitchMode>manual</wpml:gimbalPitchMode>
      <wpml:globalWaypointTurnMode>coordinateTurn</wpml:globalWaypointTurnMode>
      <wpml:globalUseStraightLine>1</wpml:globalUseStraightLine>
    </Folder>
  </Document>
</kml>`;

  // 2. Waylines WPML (Executable mission file with all Placemarks)
  const waylinesWpml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${finishAction}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>20</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>${defaultSpeed.toFixed(1)}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>${droneEnum.droneEnumValue}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>${droneEnum.droneSubEnumValue}</wpml:droneSubEnumValue>
      </wpml:droneInfo>
      <wpml:payloadInfo>
        <wpml:payloadEnumValue>${droneEnum.payloadEnumValue}</wpml:payloadEnumValue>
        <wpml:payloadSubEnumValue>${droneEnum.payloadSubEnumValue}</wpml:payloadSubEnumValue>
        <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
      </wpml:payloadInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>${defaultSpeed.toFixed(1)}</wpml:autoFlightSpeed>
${generateWaylinesPlacemarks()}    </Folder>
  </Document>
</kml>`;

  return { templateKml, waylinesWpml };
}

/** Validator for DJI Fly KMZ compatibility */
export function validateDjiFlyKmz(
  templateKml: string,
  waylinesWpml: string,
  waypoints: Waypoint[]
): boolean {
  // 1. template.kml não possui <Placemark>
  if (templateKml.includes('<Placemark>') || templateKml.includes('<Placemark')) {
    throw new Error('Validation failed: template.kml contains <Placemark>');
  }

  // 2. waylines.wpml possui os waypoints
  const waylinePlacemarksCount = (waylinesWpml.match(/<Placemark>/g) || []).length;
  if (waylinePlacemarksCount !== waypoints.length) {
    throw new Error(`Validation failed: waylines.wpml placemarks count (${waylinePlacemarksCount}) does not match waypoints length (${waypoints.length})`);
  }

  // 3. namespace = http://www.dji.com/wpmz/1.0.6
  if (
    !templateKml.includes('xmlns:wpml="http://www.dji.com/wpmz/1.0.6"') ||
    !waylinesWpml.includes('xmlns:wpml="http://www.dji.com/wpmz/1.0.6"')
  ) {
    throw new Error('Validation failed: Namespace must be http://www.dji.com/wpmz/1.0.6');
  }

  // 4. nenhum fileSuffix
  if (templateKml.includes('fileSuffix') || waylinesWpml.includes('fileSuffix')) {
    throw new Error('Validation failed: fileSuffix found in WPML');
  }

  // 5. nenhuma coordenada sem o terceiro componente
  const coordMatches = waylinesWpml.match(/<coordinates>([^<]+)<\/coordinates>/g) || [];
  for (const c of coordMatches) {
    const raw = c.replace('<coordinates>', '').replace('</coordinates>', '').trim();
    const parts = raw.split(',');
    if (parts.length !== 3) {
      throw new Error(`Validation failed: coordinate "${raw}" does not contain exactly 3 components (lng,lat,0)`);
    }
  }

  // 6. waypointTurnMode = coordinateTurn
  if (!waylinesWpml.includes('<wpml:waypointTurnMode>coordinateTurn</wpml:waypointTurnMode>')) {
    throw new Error('Validation failed: waypointTurnMode is not coordinateTurn');
  }

  // 7. waypointTurnDampingDist = 0.2
  if (!waylinesWpml.includes('<wpml:waypointTurnDampingDist>0.2</wpml:waypointTurnDampingDist>')) {
    throw new Error('Validation failed: waypointTurnDampingDist is not 0.2');
  }

  // 8. índices sequenciais iniciando em 0
  for (let i = 0; i < waypoints.length; i++) {
    if (!waylinesWpml.includes(`<wpml:index>${i}</wpml:index>`)) {
      throw new Error(`Validation failed: missing sequential waypoint index <wpml:index>${i}</wpml:index>`);
    }
  }

  // 9. actionGroup start/end index
  if (waypoints.length > 0) {
    if (!waylinesWpml.includes('<wpml:actionGroupStartIndex>') || !waylinesWpml.includes('<wpml:actionGroupEndIndex>')) {
      throw new Error('Validation failed: missing actionGroup start/end index');
    }
  }

  // 10. Initial gimbal action
  if (
    !waylinesWpml.includes('<wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>') ||
    !waylinesWpml.includes('<wpml:actionActuatorFunc>hover</wpml:actionActuatorFunc>')
  ) {
    throw new Error('Validation failed: missing initial gimbalRotate or hover action in first waypoint');
  }

  // 11. Nenhum NaN ou Infinity
  if (
    templateKml.includes('NaN') ||
    waylinesWpml.includes('NaN') ||
    templateKml.includes('Infinity') ||
    waylinesWpml.includes('Infinity')
  ) {
    throw new Error('Validation failed: found NaN or Infinity in XML output');
  }

  const photoActionMatches = (waylinesWpml.match(/<wpml:actionActuatorFunc>takePhoto<\/wpml:actionActuatorFunc>/g) || []).length;

  console.log(
    `GeoFly DJI Fly compatibility validation\n` +
    `Template Placemarks: 0\n` +
    `Waypoints: ${waypoints.length}\n` +
    `Photo actions: ${photoActionMatches}\n` +
    `Namespace: 1.0.6\n` +
    `Coordinates XYZ: OK\n` +
    `Turn mode: coordinateTurn\n` +
    `Turn damping: 0.2\n` +
    `fileSuffix: NOT FOUND\n` +
    `Initial gimbal action: OK\n` +
    `Result: PASS`
  );

  return true;
}

/** Export Single or Multi-part DJI KMZ with auto 200-waypoint split */
export async function exportDjiKmz(
  missionName: string,
  polygon: [number, number][],
  waypoints: Waypoint[],
  camera: DroneCameraProfile,
  config: FlightConfig,
  takeoffPoint?: TakeoffPoint
): Promise<void> {
  const maxWp = config.maxWaypointsPerFile || 200;
  const numParts = Math.ceil(waypoints.length / maxWp);

  if (numParts <= 1) {
    // Single KMZ file for DJI Fly: template.kml and waylines.wpml directly in ZIP root
    const zip = new JSZip();
    const { templateKml, waylinesWpml } = generateDjiWpmlFiles(missionName, waypoints, camera, config, takeoffPoint);
    
    // Validate before packaging
    validateDjiFlyKmz(templateKml, waylinesWpml, waypoints);

    zip.file('template.kml', templateKml);
    zip.file('waylines.wpml', waylinesWpml);

    const content = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
    downloadFile(`${cleanFilename(missionName)}_DJI.kmz`, content, 'application/vnd.google-earth.kmz');
  } else {
    // Multi-part export: Split into Part 1, Part 2... and pack in a master zip
    const masterZip = new JSZip();

    for (let part = 0; part < numParts; part++) {
      const startIdx = part * maxWp;
      const endIdx = Math.min(startIdx + maxWp, waypoints.length);
      const partWaypoints = waypoints.slice(startIdx, endIdx).map((w, idx) => ({ ...w, id: idx + 1 }));

      const partZip = new JSZip();
      const { templateKml, waylinesWpml } = generateDjiWpmlFiles(
        `${missionName}_Parte_${part + 1}`,
        partWaypoints,
        camera,
        config,
        takeoffPoint
      );

      // Validate part
      validateDjiFlyKmz(templateKml, waylinesWpml, partWaypoints);

      partZip.file('template.kml', templateKml);
      partZip.file('waylines.wpml', waylinesWpml);

      const partBlob = await partZip.generateAsync({ type: 'blob', mimeType: 'application/vnd.google-earth.kmz' });
      masterZip.file(`${cleanFilename(missionName)}_Parte_${part + 1}_de_${numParts}.kmz`, partBlob);
    }

    const masterBlob = await masterZip.generateAsync({ type: 'blob' });
    downloadFile(`${cleanFilename(missionName)}_DJI_Dividido_${numParts}_Partes.zip`, masterBlob, 'application/zip');
  }
}

/** Generate Litchi CSV format */
export function generateLitchiCsv(waypoints: Waypoint[], config: FlightConfig): string {
  let csv =
    'latitude,longitude,altitude(m),heading(deg),curvesize(m),rotationdir,gimbalmode,gimbalpitchangle,actiontype1,actionparam1,actiontype2,actionparam2,actiontype3,actionparam3,actiontype4,actionparam4,actiontype5,actionparam5,actiontype6,actionparam6,actiontype7,actionparam7,actiontype8,actionparam8,actiontype9,actionparam9,actiontype10,actionparam10,actiontype11,actionparam11,actiontype12,actionparam12,actiontype13,actionparam13,actiontype14,actionparam14,actiontype15,actionparam15,altitudemode,speed(m/s),poi_latitude,poi_longitude,poi_altitude(m),poi_altitudemode,photo_timeinterval,photo_distinterval\n';

  waypoints.forEach((wp) => {
    const lat = wp.lat.toFixed(7);
    const lng = wp.lng.toFixed(7);
    const alt = wp.altitudeAgl.toFixed(1);
    const heading = wp.headingDeg;
    const curveSize = config.curvedTurns ? 2 : 0;
    const gimbalPitch = config.gimbalPitchDeg;
    const action1 = wp.isPhotoPoint ? 1 : -1; // 1 = Take Photo in Litchi
    const speed = wp.speedMs.toFixed(1);

    csv += `${lat},${lng},${alt},${heading},${curveSize},0,0,${gimbalPitch},${action1},0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0,0,${speed},0,0,0,0,0,0\n`;
  });

  return csv;
}

/** Generate UTM Topography CSV Report */
export function generateUtmTopographyCsv(missionName: string, waypoints: Waypoint[]): string {
  let csv = 'PONTO,ESTE_X,NORTE_Y,COTA_Z_MSL,COTA_Z_REL_AGL,ELEVACAO_SOLO_SRTM,LATITUDE,LONGITUDE,AZIMUTE_DEG,VELOCIDADE_MS,ACAO,FUSO_UTM\n';

  waypoints.forEach((wp) => {
    csv += `${wp.id},${wp.utm.easting.toFixed(3)},${wp.utm.northing.toFixed(3)},${wp.altitudeMsl.toFixed(2)},${wp.altitudeAgl.toFixed(2)},${wp.groundElevation.toFixed(2)},${wp.lat.toFixed(7)},${wp.lng.toFixed(7)},${wp.headingDeg},${wp.speedMs},${wp.action},"${wp.utm.zone}${wp.utm.hemisphere}"\n`;
  });

  return csv;
}

/** Generate GeoJSON representation for QGIS / ArcGIS */
export function generateGeoJson(missionName: string, polygon: [number, number][], waypoints: Waypoint[]): string {
  const geojson = {
    type: 'FeatureCollection',
    name: missionName,
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'Área de Mapeamento',
          tipo: 'Polígono de Voo'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [polygon.length > 0 ? [...polygon.map(([lat, lng]) => [lng, lat]), [polygon[0][1], polygon[0][0]]] : []]
        }
      },
      {
        type: 'Feature',
        properties: {
          name: 'Linha de Voo',
          tipo: 'Trajetória dos Waypoints'
        },
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map((w) => [w.lng, w.lat, w.altitudeMsl])
        }
      },
      ...waypoints.map((w) => ({
        type: 'Feature',
        properties: {
          id: w.id,
          acao: w.action,
          altitude_agl_m: w.altitudeAgl,
          altitude_msl_m: w.altitudeMsl,
          elevacao_solo_m: w.groundElevation,
          azimute_graus: w.headingDeg,
          velocidade_ms: w.speedMs,
          utm_este: w.utm.easting,
          utm_norte: w.utm.northing,
          utm_fuso: `${w.utm.zone}${w.utm.hemisphere}`,
          e_foto: w.isPhotoPoint
        },
        geometry: {
          type: 'Point',
          coordinates: [w.lng, w.lat, w.altitudeMsl]
        }
      }))
    ]
  };

  return JSON.stringify(geojson, null, 2);
}

function cleanFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}
