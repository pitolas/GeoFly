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

/** Generate DJI WPML XML / KML files inside KMZ */
export function generateDjiWpmlFiles(
  missionName: string,
  waypoints: Waypoint[],
  camera: DroneCameraProfile,
  config: FlightConfig,
  takeoffPoint?: TakeoffPoint
): { templateKml: string; waylinesWpml: string } {
  const timestamp = new Date().toISOString();

  // 1. Template KML
  const templateKml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <wpml:author>GeoFly</wpml:author>
    <wpml:createTime>${timestamp}</wpml:createTime>
    <wpml:updateTime>${timestamp}</wpml:updateTime>
    <wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>${config.finishAction.toLowerCase()}</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>20</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>${config.flightSpeedMs}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>67</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>0</wpml:droneSubEnumValue>
      </wpml:droneInfo>
      <wpml:payloadInfo>
        <wpml:payloadEnumValue>52</wpml:payloadEnumValue>
        <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
      </wpml:payloadInfo>
    </wpml:missionConfig>
    <Folder>
      <wpml:templateType>waypoint</wpml:templateType>
      <wpml:templateId>0</wpml:templateId>
      <wpml:autoFlightSpeed>${config.flightSpeedMs}</wpml:autoFlightSpeed>
    </Folder>
  </Document>
</kml>`;

  // 2. Waylines WPML
  let waylinesWpml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.6">
  <Document>
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>${config.flightSpeedMs}</wpml:autoFlightSpeed>
      <wpml:executeFlightMode>setSpeed</wpml:executeFlightMode>
`;

  waypoints.forEach((wp, idx) => {
    waylinesWpml += `      <Placemark>
        <Point>
          <coordinates>${wp.lng},${wp.lat}</coordinates>
        </Point>
        <wpml:index>${idx}</wpml:index>
        <wpml:executeHeight>${wp.altitudeAgl.toFixed(2)}</wpml:executeHeight>
        <wpml:waypointSpeed>${wp.speedMs}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>${wp.headingDeg}</wpml:waypointHeadingAngle>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>${config.curvedTurns ? 'toPointAndStopWithDiscontinuityCurvature' : 'toPointAndStop'}</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:actionGroup>
          <wpml:actionGroupId>${idx}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>${idx}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${idx}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>0</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateAngle>${config.gimbalPitchDeg}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
          ${
            wp.isPhotoPoint
              ? `<wpml:action>
            <wpml:actionId>1</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
          </wpml:action>`
              : ''
          }
        </wpml:actionGroup>
      </Placemark>
`;
  });

  waylinesWpml += `    </Folder>
  </Document>
</kml>`;

  return { templateKml, waylinesWpml };
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
    // Single KMZ file
    const zip = new JSZip();
    const { templateKml, waylinesWpml } = generateDjiWpmlFiles(missionName, waypoints, camera, config, takeoffPoint);
    const wpmzFolder = zip.folder('wpmz');
    if (wpmzFolder) {
      wpmzFolder.file('template.kml', templateKml);
      wpmzFolder.file('waylines.wpml', waylinesWpml);
    }
    // Also include standard doc.kml at root for Google Earth compatibility
    zip.file('doc.kml', generateGoogleEarthKml(missionName, polygon, waypoints, takeoffPoint, config.altitudeMode));

    const content = await zip.generateAsync({ type: 'blob' });
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

      const wpmzFolder = partZip.folder('wpmz');
      if (wpmzFolder) {
        wpmzFolder.file('template.kml', templateKml);
        wpmzFolder.file('waylines.wpml', waylinesWpml);
      }
      partZip.file(
        'doc.kml',
        generateGoogleEarthKml(
          `${missionName} (Parte ${part + 1} de ${numParts})`,
          polygon,
          partWaypoints,
          takeoffPoint,
          config.altitudeMode
        )
      );

      const partBlob = await partZip.generateAsync({ type: 'blob' });
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
