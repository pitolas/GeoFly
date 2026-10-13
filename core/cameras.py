"""Camera/drone profiles used by GeoFly QGIS planning calculations.

The geometry calculations use the physical sensor size and actual focal length.
Image resolution changes the estimated GSD, but not the camera footprint for a
fixed sensor/lens combination.
"""

CAMERA_PROFILES = {
    "mini5pro_12": {
        "drone": "DJI Mini 5 Pro",
        "mode": "12 MP",
        "sensor_w_mm": 13.2,
        "sensor_h_mm": 9.9,
        "focal_mm": 9.15,
        "image_w_px": 4096,
        "image_h_px": 3072,
        "export_family": "djifly_native_experimental",
        "dji_profile": "mini5pro",
        "note": "1-inch CMOS, modo 12 MP, FOV 84° — formato KMZ nativo DJI Fly confirmado; execução GeoFly ainda em teste",
    },
    "mini5pro_50": {
        "drone": "DJI Mini 5 Pro",
        "mode": "50 MP",
        "sensor_w_mm": 13.2,
        "sensor_h_mm": 9.9,
        "focal_mm": 9.15,
        "image_w_px": 8192,
        "image_h_px": 6144,
        "export_family": "djifly_native_experimental",
        "dji_profile": "mini5pro",
        "note": "1-inch CMOS, modo 50 MP, FOV 84° — formato KMZ nativo DJI Fly confirmado; execução GeoFly ainda em teste",
    },
    "litox1_12": {
        "drone": "DJI Lito X1",
        "mode": "12 MP",
        "sensor_w_mm": 9.6,
        "sensor_h_mm": 7.2,
        "focal_mm": 6.72,
        "image_w_px": 4032,
        "image_h_px": 3024,
        "export_family": "djifly_native_experimental",
        "dji_profile": "litox1",
        "note": "1/1.3\" CMOS, modo 12 MP, equivalente 24 mm — formato KMZ nativo DJI Fly confirmado; execução GeoFly ainda em teste",
    },
    "litox1_48": {
        "drone": "DJI Lito X1",
        "mode": "48 MP",
        "sensor_w_mm": 9.6,
        "sensor_h_mm": 7.2,
        "focal_mm": 6.72,
        "image_w_px": 8064,
        "image_h_px": 6048,
        "export_family": "djifly_native_experimental",
        "dji_profile": "litox1",
        "note": "1/1.3\" CMOS, modo 48 MP, equivalente 24 mm — formato KMZ nativo DJI Fly confirmado; execução GeoFly ainda em teste",
    },
    "lito1_12": {
        "drone": "DJI Lito 1",
        "mode": "12 MP",
        "sensor_w_mm": 6.4,
        "sensor_h_mm": 4.8,
        "focal_mm": 4.84,
        "image_w_px": 4000,
        "image_h_px": 3000,
        "export_family": "djifly_native_experimental",
        "dji_profile": "lito1",
        "note": "1/2\" CMOS, modo 12 MP, equivalente 26,2 mm — formato KMZ nativo DJI Fly confirmado; execução GeoFly ainda em teste",
    },
    "lito1_48": {
        "drone": "DJI Lito 1",
        "mode": "48 MP",
        "sensor_w_mm": 6.4,
        "sensor_h_mm": 4.8,
        "focal_mm": 4.84,
        "image_w_px": 8000,
        "image_h_px": 6000,
        "export_family": "djifly_native_experimental",
        "dji_profile": "lito1",
        "note": "1/2\" CMOS, modo 48 MP, equivalente 26,2 mm — formato KMZ nativo DJI Fly confirmado; execução GeoFly ainda em teste",
    },
    "mini4pro_12": {
        "drone": "DJI Mini 4 Pro",
        "mode": "12 MP",
        "sensor_w_mm": 9.6,
        "sensor_h_mm": 7.2,
        "focal_mm": 6.72,
        "image_w_px": 4032,
        "image_h_px": 3024,
        "export_family": "mini4pro_djifly",
        "dji_profile": "mini4pro",
        "note": "1/1.3\" CMOS, modo 12 MP — exportação DJI Fly validada em campo",
    },
    "mini4pro_48": {
        "drone": "DJI Mini 4 Pro",
        "mode": "48 MP",
        "sensor_w_mm": 9.6,
        "sensor_h_mm": 7.2,
        "focal_mm": 6.72,
        "image_w_px": 8064,
        "image_h_px": 6048,
        "export_family": "mini4pro_djifly",
        "dji_profile": "mini4pro",
        "note": "1/1.3\" CMOS, modo 48 MP — exportação DJI Fly validada em campo",
    },
    "mini3pro_12": {
        "drone": "DJI Mini 3 Pro",
        "mode": "12 MP",
        "sensor_w_mm": 9.6,
        "sensor_h_mm": 7.2,
        "focal_mm": 6.72,
        "image_w_px": 4032,
        "image_h_px": 3024,
        "export_family": "djifly_native_experimental",
        "dji_profile": "mini3pro",
        "note": "1/1.3\" CMOS, modo 12 MP — formato KMZ nativo DJI Fly confirmado; execução GeoFly ainda em teste",
    },
    "mini3pro_48": {
        "drone": "DJI Mini 3 Pro",
        "mode": "48 MP",
        "sensor_w_mm": 9.6,
        "sensor_h_mm": 7.2,
        "focal_mm": 6.72,
        "image_w_px": 8064,
        "image_h_px": 6048,
        "export_family": "djifly_native_experimental",
        "dji_profile": "mini3pro",
        "note": "1/1.3\" CMOS, modo 48 MP — formato KMZ nativo DJI Fly confirmado; execução GeoFly ainda em teste",
    },
    "mavic3e_20": {
        "drone": "DJI Mavic 3 Enterprise",
        "mode": "20 MP — Wide",
        "sensor_w_mm": 17.3,
        "sensor_h_mm": 13.0,
        "focal_mm": 12.0,
        "image_w_px": 5280,
        "image_h_px": 3956,
        "export_family": "planning_only",
        "note": "4/3 CMOS, câmera wide, obturador mecânico",
    },
    "matrice4e_20": {
        "drone": "DJI Matrice 4E",
        "mode": "20 MP — Wide",
        "sensor_w_mm": 17.3,
        "sensor_h_mm": 13.0,
        "focal_mm": 12.0,
        "image_w_px": 5280,
        "image_h_px": 3956,
        "export_family": "planning_only",
        "note": "4/3 CMOS, câmera wide, obturador mecânico",
    },
}

DRONE_MODES = {
    "DJI Mini 5 Pro": ["mini5pro_12", "mini5pro_50"],
    "DJI Mini 4 Pro": ["mini4pro_12", "mini4pro_48"],
    "DJI Mini 3 Pro": ["mini3pro_12", "mini3pro_48"],
    "DJI Lito X1": ["litox1_12", "litox1_48"],
    "DJI Lito 1": ["lito1_12", "lito1_48"],
}


def profile_label(profile):
    return f'{profile["mode"]}'


def spacing_for_camera(altitude_agl_m, front_overlap_pct, side_overlap_pct, profile):
    focal_mm = float(profile["focal_mm"])
    sensor_w_mm = float(profile["sensor_w_mm"])
    sensor_h_mm = float(profile["sensor_h_mm"])
    image_w_px = int(profile["image_w_px"])
    image_h_px = int(profile["image_h_px"])

    if focal_mm <= 0 or sensor_w_mm <= 0 or sensor_h_mm <= 0:
        raise ValueError("Parâmetros físicos da câmera são inválidos.")
    if image_w_px <= 0 or image_h_px <= 0:
        raise ValueError("Resolução da câmera é inválida.")

    footprint_cross = altitude_agl_m * sensor_w_mm / focal_mm
    footprint_along = altitude_agl_m * sensor_h_mm / focal_mm
    line_spacing = footprint_cross * (1.0 - side_overlap_pct / 100.0)
    photo_spacing = footprint_along * (1.0 - front_overlap_pct / 100.0)

    gsd_x_cm = footprint_cross / image_w_px * 100.0
    gsd_y_cm = footprint_along / image_h_px * 100.0
    gsd_cm = (gsd_x_cm + gsd_y_cm) / 2.0

    return {
        "line_spacing_m": max(1.0, line_spacing),
        "photo_spacing_m": max(1.0, photo_spacing),
        "footprint_cross_m": footprint_cross,
        "footprint_along_m": footprint_along,
        "gsd_cm_px": gsd_cm,
        "gsd_x_cm_px": gsd_x_cm,
        "gsd_y_cm_px": gsd_y_cm,
    }
