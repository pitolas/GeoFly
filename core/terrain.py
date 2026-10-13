from qgis.core import QgsCoordinateTransform, QgsPointXY, QgsProject, QgsRaster


def sample_raster(raster_layer, point, point_crs):
    if raster_layer is None or not raster_layer.isValid():
        raise ValueError("Raster de relevo inválido.")
    pt = QgsPointXY(point)
    if point_crs != raster_layer.crs():
        pt = QgsCoordinateTransform(point_crs, raster_layer.crs(), QgsProject.instance()).transform(pt)
    result = raster_layer.dataProvider().identify(pt, QgsRaster.IdentifyFormatValue)
    if not result.isValid():
        raise ValueError("Não foi possível obter a cota do raster neste ponto.")
    values = result.results()
    if not values:
        raise ValueError("Raster sem valor no ponto consultado.")
    value = values.get(1)
    if value is None:
        value = next(iter(values.values()), None)
    if value is None:
        raise ValueError("Raster sem valor válido no ponto consultado.")
    try:
        value = float(value)
    except Exception as exc:
        raise ValueError("Valor de elevação inválido no raster.") from exc
    return value


def apply_terrain(waypoints, raster_layer, metric_crs, home_point_metric, target_agl_m, tolerance_m=1.0):
    home_ground = sample_raster(raster_layer, home_point_metric, metric_crs)
    for wp in waypoints:
        ground = sample_raster(raster_layer, wp["point"], metric_crs)
        execute_h = float(target_agl_m) + (ground - home_ground)
        agl_check = (home_ground + execute_h) - ground
        if execute_h < 2.0:
            raise ValueError(f"Altura relativa DJI abaixo de 2 m no waypoint: {execute_h:.2f} m")
        if abs(agl_check - target_agl_m) > tolerance_m:
            raise ValueError(
                f"Falha de validação AGL: alvo={target_agl_m:.2f} m, calculado={agl_check:.2f} m"
            )
        wp["ground_msl"] = ground
        wp["execute_h"] = execute_h
        wp["agl_check"] = agl_check
    return home_ground


def apply_constant_height(waypoints, target_agl_m):
    for wp in waypoints:
        wp["ground_msl"] = None
        wp["execute_h"] = float(target_agl_m)
        wp["agl_check"] = float(target_agl_m)
