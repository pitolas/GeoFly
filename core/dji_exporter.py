import os
import time
import zipfile

MAX_WAYPOINTS_PER_KMZ = 200
WPML_NS_LEGACY = "http://www.dji.com/wpmz/1.0.6"
WPML_NS_NATIVE = "http://www.uav.com/wpmz/1.0.2"

# Mini 4 Pro mantém EXATAMENTE o perfil/estrutura já validado em campo.
# Mini 5 Pro, Mini 3 Pro, Lito X1 e Lito 1 usam o formato nativo observado em KMZ
# gerados pelo próprio DJI Fly: namespace uav.com 1.0.2, pasta wpmz/,
# droneEnumValue 68, sem payloadInfo no missionConfig.
DJI_FLY_PROFILES = {
    "mini4pro": {
        "drone_enum": 67,
        "drone_sub_enum": 0,
        "payload_enum": 53,
        "payload_sub_enum": 0,
        "format": "legacy_geofly",
        "validated": True,
    },
    "mini5pro": {
        "drone_enum": 68,
        "drone_sub_enum": 0,
        "format": "native_djifly_102",
        "validated": False,
    },
    "litox1": {
        "drone_enum": 68,
        "drone_sub_enum": 0,
        "format": "native_djifly_102",
        "validated": False,
    },
    "lito1": {
        "drone_enum": 68,
        "drone_sub_enum": 0,
        "format": "native_djifly_102",
        "validated": False,
    },
    # Confirmado por KMZ nativo gerado pelo próprio DJI Fly para Mini 3 Pro.
    "mini3pro": {
        "drone_enum": 68,
        "drone_sub_enum": 0,
        "format": "native_djifly_102",
        "validated": False,
    },
}


def get_dji_fly_profile(profile_key):
    if profile_key not in DJI_FLY_PROFILES:
        raise ValueError(f"Perfil DJI Fly desconhecido: {profile_key}")
    return DJI_FLY_PROFILES[profile_key]


# -----------------------------------------------------------------------------
# Formato GeoFly legado — Mini 4 Pro validado em campo
# -----------------------------------------------------------------------------

def _legacy_mission_config(speed, dji_profile, include_payload=False):
    profile = get_dji_fly_profile(dji_profile)
    payload = ""
    if include_payload:
        payload = f"""
      <wpml:payloadInfo>
        <wpml:payloadEnumValue>{profile['payload_enum']}</wpml:payloadEnumValue>
        <wpml:payloadSubEnumValue>{profile['payload_sub_enum']}</wpml:payloadSubEnumValue>
        <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
      </wpml:payloadInfo>"""
    return f"""<wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:takeOffSecurityHeight>20</wpml:takeOffSecurityHeight>
      <wpml:globalTransitionalSpeed>{speed:.1f}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>{profile['drone_enum']}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>{profile['drone_sub_enum']}</wpml:droneSubEnumValue>
      </wpml:droneInfo>{payload}
    </wpml:missionConfig>"""


def _build_legacy_template(global_height, speed, dji_profile):
    ts = int(time.time() * 1000)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="{WPML_NS_LEGACY}">
  <Document>
    <wpml:author>GeoFly QGIS</wpml:author>
    <wpml:createTime>{ts}</wpml:createTime>
    <wpml:updateTime>{ts}</wpml:updateTime>
    {_legacy_mission_config(speed, dji_profile, include_payload=False)}
    <Folder>
      <wpml:templateType>waypoint</wpml:templateType>
      <wpml:templateId>0</wpml:templateId>
      <wpml:globalHeight>{global_height:.2f}</wpml:globalHeight>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineCoordinateSysParam>
        <wpml:coordinateMode>WGS84</wpml:coordinateMode>
        <wpml:heightMode>relativeToStartPoint</wpml:heightMode>
      </wpml:waylineCoordinateSysParam>
      <wpml:autoFlightSpeed>{speed:.1f}</wpml:autoFlightSpeed>
      <wpml:gimbalPitchMode>manual</wpml:gimbalPitchMode>
      <wpml:globalWaypointTurnMode>coordinateTurn</wpml:globalWaypointTurnMode>
      <wpml:globalUseStraightLine>1</wpml:globalUseStraightLine>
    </Folder>
  </Document>
</kml>'''


def _legacy_action_group(idx, photo, first, gimbal_pitch):
    actions = []
    action_id = 0
    if first:
        actions.append(f'''          <wpml:action>
            <wpml:actionId>{action_id}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>{int(gimbal_pitch)}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>''')
        action_id += 1
        actions.append(f'''          <wpml:action>
            <wpml:actionId>{action_id}</wpml:actionId>
            <wpml:actionActuatorFunc>hover</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:hoverTime>2.5</wpml:hoverTime>
            </wpml:actionActuatorFuncParam>
          </wpml:action>''')
        action_id += 1
    if photo:
        actions.append(f'''          <wpml:action>
            <wpml:actionId>{action_id}</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>''')
    if not actions:
        return ""
    joined = "\n".join(actions)
    return f'''        <wpml:actionGroup>
          <wpml:actionGroupId>{idx}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>{idx}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>{idx}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
{joined}
        </wpml:actionGroup>'''


def _build_legacy_waylines(waypoints_wgs84, speed, gimbal_pitch, dji_profile):
    placemarks = []
    for idx, wp in enumerate(waypoints_wgs84):
        action_group = _legacy_action_group(idx, bool(wp.get("photo")), idx == 0, gimbal_pitch)
        if action_group:
            action_group = "\n" + action_group
        placemarks.append(f'''      <Placemark>
        <wpml:index>{idx}</wpml:index>
        <Point>
          <coordinates>{wp["lon"]:.8f},{wp["lat"]:.8f},0</coordinates>
        </Point>
        <wpml:executeHeight>{wp["execute_h"]:.2f}</wpml:executeHeight>
        <wpml:waypointSpeed>{speed:.1f}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>coordinateTurn</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0.2</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>{action_group}
      </Placemark>''')
    body = "\n".join(placemarks)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="{WPML_NS_LEGACY}">
  <Document>
    {_legacy_mission_config(speed, dji_profile, include_payload=True)}
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:autoFlightSpeed>{speed:.1f}</wpml:autoFlightSpeed>
{body}
    </Folder>
  </Document>
</kml>'''


# -----------------------------------------------------------------------------
# Formato nativo DJI Fly 1.0.2 — Mini 5 Pro / Mini 3 Pro / Lito X1 / Lito 1
# -----------------------------------------------------------------------------

def _native_mission_config(speed, dji_profile):
    profile = get_dji_fly_profile(dji_profile)
    return f"""<wpml:missionConfig>
      <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
      <wpml:finishAction>goHome</wpml:finishAction>
      <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
      <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
      <wpml:globalTransitionalSpeed>{speed:.1f}</wpml:globalTransitionalSpeed>
      <wpml:droneInfo>
        <wpml:droneEnumValue>{profile['drone_enum']}</wpml:droneEnumValue>
        <wpml:droneSubEnumValue>{profile['drone_sub_enum']}</wpml:droneSubEnumValue>
      </wpml:droneInfo>
    </wpml:missionConfig>"""


def _build_native_template(speed, dji_profile):
    ts = int(time.time() * 1000)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="{WPML_NS_NATIVE}">
  <Document>
    <wpml:author>fly</wpml:author>
    <wpml:createTime>{ts}</wpml:createTime>
    <wpml:updateTime>{ts}</wpml:updateTime>
    {_native_mission_config(speed, dji_profile)}
  </Document>
</kml>'''


def _native_gimbal_rotate_group(group_id, wp_index, gimbal_pitch):
    return f'''        <wpml:actionGroup>
          <wpml:actionGroupId>{group_id}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>{wp_index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>{wp_index}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>{group_id}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalHeadingYawBase>aircraft</wpml:gimbalHeadingYawBase>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>{int(gimbal_pitch)}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>'''


def _native_gimbal_evenly_group(group_id, last_index, gimbal_pitch):
    return f'''        <wpml:actionGroup>
          <wpml:actionGroupId>{group_id}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>{last_index}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>{group_id}</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalEvenlyRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalPitchRotateAngle>{int(gimbal_pitch)}</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>'''


def _native_photo_group(group_id, wp_index):
    return f'''        <wpml:actionGroup>
          <wpml:actionGroupId>{group_id}</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>{wp_index}</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>{wp_index}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>parallel</wpml:actionGroupMode>
          <wpml:actionTrigger>
            <wpml:actionTriggerType>reachPoint</wpml:actionTriggerType>
          </wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>{group_id}</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>'''


def _build_native_waylines(waypoints_wgs84, speed, gimbal_pitch, dji_profile):
    # O esqueleto abaixo replica o padrão observado nos KMZ nativos enviados pelo usuário.
    # As únicas extensões são as ações takePhoto necessárias ao mapeamento GeoFly.
    last_index = len(waypoints_wgs84) - 1
    group_id = 1
    placemarks = []

    for idx, wp in enumerate(waypoints_wgs84):
        groups = []
        if idx == 0:
            groups.append(_native_gimbal_rotate_group(group_id, 0, gimbal_pitch))
            group_id += 1
            groups.append(_native_gimbal_evenly_group(group_id, last_index, gimbal_pitch))
            group_id += 1
        if bool(wp.get("photo")):
            groups.append(_native_photo_group(group_id, idx))
            group_id += 1
        action_groups = "\n" + "\n".join(groups) if groups else ""

        placemarks.append(f'''      <Placemark>
        <Point>
          <coordinates>
            {wp["lon"]:.13f},{wp["lat"]:.13f}
          </coordinates>
        </Point>
        <wpml:index>{idx}</wpml:index>
        <wpml:executeHeight>{wp["execute_h"]:.2f}</wpml:executeHeight>
        <wpml:waypointSpeed>{speed:.1f}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam>
          <wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode>
          <wpml:waypointHeadingAngle>0</wpml:waypointHeadingAngle>
          <wpml:waypointPoiPoint>0.000000,0.000000,0.000000</wpml:waypointPoiPoint>
          <wpml:waypointHeadingAngleEnable>1</wpml:waypointHeadingAngleEnable>
          <wpml:waypointHeadingPathMode>followBadArc</wpml:waypointHeadingPathMode>
          <wpml:waypointHeadingPoiIndex>0</wpml:waypointHeadingPoiIndex>
        </wpml:waypointHeadingParam>
        <wpml:waypointTurnParam>
          <wpml:waypointTurnMode>toPointAndStopWithContinuityCurvature</wpml:waypointTurnMode>
          <wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist>
        </wpml:waypointTurnParam>
        <wpml:useStraightLine>0</wpml:useStraightLine>{action_groups}
        <wpml:waypointGimbalHeadingParam>
          <wpml:waypointGimbalPitchAngle>{int(gimbal_pitch)}</wpml:waypointGimbalPitchAngle>
          <wpml:waypointGimbalYawAngle>0</wpml:waypointGimbalYawAngle>
        </wpml:waypointGimbalHeadingParam>
      </Placemark>''')

    body = "\n".join(placemarks)
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="{WPML_NS_NATIVE}">
  <Document>
    {_native_mission_config(speed, dji_profile)}
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>0</wpml:distance>
      <wpml:duration>0</wpml:duration>
      <wpml:autoFlightSpeed>{speed:.1f}</wpml:autoFlightSpeed>
{body}
    </Folder>
  </Document>
</kml>'''


# -----------------------------------------------------------------------------
# API pública do exportador
# -----------------------------------------------------------------------------

def validate_waypoints(waypoints):
    if not waypoints:
        raise ValueError("Não há waypoints para exportar.")
    for i, wp in enumerate(waypoints):
        for key in ("lat", "lon", "execute_h"):
            val = wp.get(key)
            if val is None:
                raise ValueError(f"Waypoint {i}: campo {key} ausente.")
            if val != val or val in (float("inf"), float("-inf")):
                raise ValueError(f"Waypoint {i}: campo {key} inválido.")
        if not (-90 <= wp["lat"] <= 90 and -180 <= wp["lon"] <= 180):
            raise ValueError(f"Waypoint {i}: coordenadas inválidas.")
        if wp["execute_h"] < 2:
            raise ValueError(f"Waypoint {i}: executeHeight abaixo de 2 m.")


def _export_one(path, chunk, global_height, speed, gimbal_pitch, dji_profile):
    profile = get_dji_fly_profile(dji_profile)
    if profile["format"] == "native_djifly_102":
        template = _build_native_template(speed, dji_profile)
        waylines = _build_native_waylines(chunk, speed, gimbal_pitch, dji_profile)
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr("wpmz/template.kml", template.encode("utf-8"))
            z.writestr("wpmz/waylines.wpml", waylines.encode("utf-8"))
    else:
        template = _build_legacy_template(global_height, speed, dji_profile)
        waylines = _build_legacy_waylines(chunk, speed, gimbal_pitch, dji_profile)
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as z:
            z.writestr("template.kml", template.encode("utf-8"))
            z.writestr("waylines.wpml", waylines.encode("utf-8"))


def export_kmz(output_path, waypoints_wgs84, global_height, speed, gimbal_pitch=-90, dji_profile="mini4pro"):
    validate_waypoints(waypoints_wgs84)
    get_dji_fly_profile(dji_profile)
    chunks = [waypoints_wgs84[i:i + MAX_WAYPOINTS_PER_KMZ]
              for i in range(0, len(waypoints_wgs84), MAX_WAYPOINTS_PER_KMZ)]
    outputs = []
    base, ext = os.path.splitext(output_path)
    if ext.lower() != ".kmz":
        base = output_path
    for part_idx, chunk in enumerate(chunks, start=1):
        path = f"{base}_parte_{part_idx:02d}.kmz" if len(chunks) > 1 else f"{base}.kmz"
        _export_one(path, chunk, global_height, speed, gimbal_pitch, dji_profile)
        outputs.append(path)
    return outputs
