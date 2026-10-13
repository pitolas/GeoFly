import math
from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsUnitTypes,
    QgsWkbTypes,
)


def metric_crs_for_geometry(geom: QgsGeometry, source_crs: QgsCoordinateReferenceSystem):
    if source_crs.mapUnits() == QgsUnitTypes.DistanceMeters:
        return source_crs

    wgs84 = QgsCoordinateReferenceSystem("EPSG:4326")
    to_wgs = QgsCoordinateTransform(source_crs, wgs84, QgsProject.instance())
    c = QgsPointXY(geom.centroid().asPoint())
    c_wgs = to_wgs.transform(c)
    zone = int((c_wgs.x() + 180.0) / 6.0) + 1
    zone = min(60, max(1, zone))
    epsg = (32600 if c_wgs.y() >= 0 else 32700) + zone
    return QgsCoordinateReferenceSystem(f"EPSG:{epsg}")


def transform_geometry(geom: QgsGeometry, src: QgsCoordinateReferenceSystem, dst: QgsCoordinateReferenceSystem):
    out = QgsGeometry(geom)
    if src != dst:
        out.transform(QgsCoordinateTransform(src, dst, QgsProject.instance()))
    return out


def transform_point(pt: QgsPointXY, src: QgsCoordinateReferenceSystem, dst: QgsCoordinateReferenceSystem):
    if src == dst:
        return QgsPointXY(pt)
    return QgsCoordinateTransform(src, dst, QgsProject.instance()).transform(pt)


def _line_parts(geom: QgsGeometry):
    if geom is None or geom.isEmpty():
        return []
    gtype = QgsWkbTypes.geometryType(geom.wkbType())
    if gtype != QgsWkbTypes.LineGeometry:
        return []
    if QgsWkbTypes.isMultiType(geom.wkbType()):
        return [p for p in geom.asMultiPolyline() if len(p) >= 2]
    p = geom.asPolyline()
    return [p] if len(p) >= 2 else []


def _dot(px, py, vx, vy):
    return px * vx + py * vy


def _append_if_distinct(waypoints, point, **attrs):
    if waypoints:
        prev = waypoints[-1]["point"]
        if math.hypot(point.x() - prev.x(), point.y() - prev.y()) < 0.05:
            # Upgrade an existing navigation point to photo if needed.
            if attrs.get("photo"):
                waypoints[-1]["photo"] = True
            return
    item = {"point": QgsPointXY(point)}
    item.update(attrs)
    waypoints.append(item)


def generate_grid(polygon_metric: QgsGeometry, line_spacing_m: float, photo_spacing_m: float,
                  azimuth_deg: float, grid_id: int = 1):
    """Generates clipped parallel segments and a boustrophedon waypoint sequence.

    azimuth_deg is clockwise from North.
    """
    if polygon_metric is None or polygon_metric.isEmpty():
        raise ValueError("Polígono vazio.")
    if line_spacing_m <= 0 or photo_spacing_m <= 0:
        raise ValueError("Espaçamentos devem ser maiores que zero.")

    center = QgsPointXY(polygon_metric.centroid().asPoint())
    bb = polygon_metric.boundingBox()
    corners = [
        QgsPointXY(bb.xMinimum(), bb.yMinimum()),
        QgsPointXY(bb.xMinimum(), bb.yMaximum()),
        QgsPointXY(bb.xMaximum(), bb.yMinimum()),
        QgsPointXY(bb.xMaximum(), bb.yMaximum()),
    ]

    a = math.radians(azimuth_deg % 360.0)
    # Direction vector: azimuth clockwise from North.
    dx, dy = math.sin(a), math.cos(a)
    # Right-hand normal.
    nx, ny = math.cos(a), -math.sin(a)

    projections = [_dot(c.x() - center.x(), c.y() - center.y(), nx, ny) for c in corners]
    min_n, max_n = min(projections), max(projections)
    diag = math.hypot(bb.width(), bb.height())
    half_len = max(100.0, diag * 1.5 + line_spacing_m * 2.0)

    start_t = math.floor(min_n / line_spacing_m) * line_spacing_m
    end_t = math.ceil(max_n / line_spacing_m) * line_spacing_m

    segments = []
    waypoints = []
    row = 0
    t = start_t
    eps = line_spacing_m * 0.001
    while t <= end_t + eps:
        cx = center.x() + nx * t
        cy = center.y() + ny * t
        p1 = QgsPointXY(cx - dx * half_len, cy - dy * half_len)
        p2 = QgsPointXY(cx + dx * half_len, cy + dy * half_len)
        raw = QgsGeometry.fromPolylineXY([p1, p2])
        clipped = polygon_metric.intersection(raw)
        parts = _line_parts(clipped)
        if parts:
            # Sort disjoint pieces along line direction.
            def part_proj(part):
                mx = sum(p.x() for p in part) / len(part)
                my = sum(p.y() for p in part) / len(part)
                return _dot(mx - center.x(), my - center.y(), dx, dy)

            parts = sorted(parts, key=part_proj, reverse=(row % 2 == 1))
            reverse_line = (row % 2 == 1)
            for part in parts:
                if reverse_line:
                    part = list(reversed(part))
                seg = QgsGeometry.fromPolylineXY(part)
                length = seg.length()
                if length < 0.5:
                    continue
                segments.append({"geometry": seg, "grid": grid_id, "row": row})

                start_pt = QgsPointXY(seg.interpolate(0).asPoint())
                _append_if_distinct(waypoints, start_pt, photo=False, grid=grid_id, row=row, kind="NAV")

                if length <= photo_spacing_m:
                    distances = [length / 2.0]
                else:
                    first = min(photo_spacing_m / 2.0, length / 2.0)
                    distances = []
                    d = first
                    end_guard = max(first, length - photo_spacing_m / 2.0)
                    while d <= end_guard + 1e-6:
                        distances.append(d)
                        d += photo_spacing_m
                    if not distances:
                        distances = [length / 2.0]

                for dist in distances:
                    pt = QgsPointXY(seg.interpolate(min(length, dist)).asPoint())
                    _append_if_distinct(waypoints, pt, photo=True, grid=grid_id, row=row, kind="PHOTO")

                end_pt = QgsPointXY(seg.interpolate(length).asPoint())
                _append_if_distinct(waypoints, end_pt, photo=False, grid=grid_id, row=row, kind="NAV")
            row += 1
        t += line_spacing_m

    if not segments:
        raise ValueError("Nenhuma linha de voo intersectou o polígono.")
    return segments, waypoints


def path_distance_m(waypoints):
    total = 0.0
    for i in range(1, len(waypoints)):
        p0, p1 = waypoints[i - 1]["point"], waypoints[i]["point"]
        total += math.hypot(p1.x() - p0.x(), p1.y() - p0.y())
    return total
