import math
import os

from qgis.PyQt.QtCore import Qt, QVariant
from qgis.PyQt.QtWidgets import (
    QCheckBox,
    QComboBox,
    QDockWidget,
    QDoubleSpinBox,
    QFileDialog,
    QFormLayout,
    QGridLayout,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QVBoxLayout,
    QWidget,
)
from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsCoordinateTransform,
    QgsFeature,
    QgsField,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsRasterLayer,
    QgsVectorLayer,
    QgsWkbTypes,
)
from qgis.gui import QgsMapToolEmitPoint

from .core.flight import (
    generate_grid,
    metric_crs_for_geometry,
    path_distance_m,
    transform_geometry,
    transform_point,
)
from .core.cameras import CAMERA_PROFILES, DRONE_MODES, profile_label, spacing_for_camera
from .core.terrain import apply_constant_height, apply_terrain
from .core.dji_exporter import export_kmz


class GeoFlyDock(QDockWidget):
    def __init__(self, iface, parent=None):
        super().__init__("GeoFly QGIS", parent)
        self.iface = iface
        self.canvas = iface.mapCanvas()
        self.source_geom = None
        self.source_crs = None
        self.metric_crs = None
        self.polygon_metric = None
        self.home_project = None
        self.home_metric = None
        self.waypoints = []
        self.segments = []
        self._map_tool = None
        self._previous_map_tool = None
        self.generated_layers = []
        self._build_ui()
        self.refresh_rasters()

    def _build_ui(self):
        root = QWidget()
        lay = QVBoxLayout(root)

        intro = QLabel("v1.1.0 — polígono selecionado → malha → relevo → KMZ DJI")
        intro.setWordWrap(True)
        lay.addWidget(intro)

        area_box = QGroupBox("1. Área e Home")
        area_lay = QGridLayout(area_box)
        self.lbl_area = QLabel("Nenhum polígono carregado")
        self.btn_area = QPushButton("Usar polígono selecionado")
        self.btn_home = QPushButton("Definir Home no mapa")
        self.btn_home_centroid = QPushButton("Home = centroide")
        self.lbl_home = QLabel("Home: não definido")
        area_lay.addWidget(self.btn_area, 0, 0, 1, 2)
        area_lay.addWidget(self.lbl_area, 1, 0, 1, 2)
        area_lay.addWidget(self.btn_home, 2, 0)
        area_lay.addWidget(self.btn_home_centroid, 2, 1)
        area_lay.addWidget(self.lbl_home, 3, 0, 1, 2)
        lay.addWidget(area_box)

        param_box = QGroupBox("2. Drone, câmera e parâmetros de voo")
        form = QFormLayout(param_box)
        self.drone = QComboBox()
        for drone_name in DRONE_MODES.keys():
            self.drone.addItem(drone_name, drone_name)
        self.camera_mode = QComboBox()
        self.lbl_camera_info = QLabel("")
        self.lbl_camera_info.setWordWrap(True)
        self.altitude = QDoubleSpinBox(); self.altitude.setRange(10, 500); self.altitude.setValue(110); self.altitude.setSuffix(" m AGL")
        self.front = QSpinBox(); self.front.setRange(0, 95); self.front.setValue(75); self.front.setSuffix(" %")
        self.side = QSpinBox(); self.side.setRange(0, 95); self.side.setValue(75); self.side.setSuffix(" %")
        self.angle = QDoubleSpinBox(); self.angle.setRange(0, 359.9); self.angle.setValue(0); self.angle.setSuffix("°")
        self.speed = QDoubleSpinBox(); self.speed.setRange(1, 15); self.speed.setValue(6); self.speed.setSuffix(" m/s")
        self.gimbal = QSpinBox(); self.gimbal.setRange(-90, 60); self.gimbal.setValue(-90); self.gimbal.setSuffix("°")
        self.cross = QCheckBox("Voo cruzado (+90°)")
        form.addRow("Drone:", self.drone)
        form.addRow("Câmera / resolução:", self.camera_mode)
        form.addRow("", self.lbl_camera_info)
        form.addRow("Altitude:", self.altitude)
        form.addRow("Sobreposição frontal:", self.front)
        form.addRow("Sobreposição lateral:", self.side)
        form.addRow("Direção (N=0°):", self.angle)
        form.addRow("Velocidade:", self.speed)
        form.addRow("Gimbal:", self.gimbal)
        form.addRow(self.cross)
        lay.addWidget(param_box)

        terrain_box = QGroupBox("3. Acompanhamento de terreno")
        terrain_form = QFormLayout(terrain_box)
        self.terrain = QCheckBox("Manter AGL constante usando raster")
        self.dem = QComboBox()
        self.btn_refresh = QPushButton("Atualizar lista de rasters")
        terrain_form.addRow(self.terrain)
        terrain_form.addRow("MDE/MDT:", self.dem)
        terrain_form.addRow(self.btn_refresh)
        lay.addWidget(terrain_box)

        self.lbl_spacing = QLabel("")
        self.lbl_spacing.setWordWrap(True)
        lay.addWidget(self.lbl_spacing)

        buttons = QHBoxLayout()
        self.btn_generate = QPushButton("Gerar missão")
        self.btn_export = QPushButton("Exportar KMZ DJI")
        self.btn_export.setEnabled(False)
        buttons.addWidget(self.btn_generate)
        buttons.addWidget(self.btn_export)
        lay.addLayout(buttons)

        self.lbl_status = QLabel("Pronto.")
        self.lbl_status.setWordWrap(True)
        lay.addWidget(self.lbl_status)
        lay.addStretch(1)
        self.setWidget(root)

        self.btn_area.clicked.connect(self.load_selected_polygon)
        self.btn_home.clicked.connect(self.start_home_capture)
        self.btn_home_centroid.clicked.connect(self.set_home_centroid)
        self.btn_refresh.clicked.connect(self.refresh_rasters)
        self.btn_generate.clicked.connect(self.generate)
        self.btn_export.clicked.connect(self.export)
        self.drone.currentIndexChanged.connect(self._refresh_camera_modes)
        self.camera_mode.currentIndexChanged.connect(self.update_spacing_label)
        for w in (self.altitude, self.front, self.side, self.speed):
            w.valueChanged.connect(self.update_spacing_label)
        self._refresh_camera_modes()
        self.update_spacing_label()

    def refresh_rasters(self):
        current = self.dem.currentData() if self.dem.count() else None
        self.dem.clear()
        self.dem.addItem("— selecione —", None)
        for layer in QgsProject.instance().mapLayers().values():
            if isinstance(layer, QgsRasterLayer):
                self.dem.addItem(layer.name(), layer.id())
        if current:
            idx = self.dem.findData(current)
            if idx >= 0:
                self.dem.setCurrentIndex(idx)

    def _refresh_camera_modes(self):
        drone_name = self.drone.currentData() or self.drone.currentText()
        previous = self.camera_mode.currentData() if self.camera_mode.count() else None
        self.camera_mode.blockSignals(True)
        self.camera_mode.clear()
        for key in DRONE_MODES.get(drone_name, []):
            profile = CAMERA_PROFILES[key]
            self.camera_mode.addItem(profile_label(profile), key)
        if previous:
            idx = self.camera_mode.findData(previous)
            if idx >= 0:
                self.camera_mode.setCurrentIndex(idx)
        self.camera_mode.blockSignals(False)
        self.update_spacing_label()

    def _camera_profile(self):
        key = self.camera_mode.currentData()
        if not key or key not in CAMERA_PROFILES:
            # Safe fallback used only while UI is being populated.
            key = "mini4pro_12"
        return CAMERA_PROFILES[key]

    def update_spacing_label(self):
        profile = self._camera_profile()
        calc = spacing_for_camera(self.altitude.value(), self.front.value(), self.side.value(), profile)
        self.lbl_camera_info.setText(
            f'{profile["note"]} | {profile["image_w_px"]}×{profile["image_h_px"]} px'
        )
        interval_s = calc["photo_spacing_m"] / max(0.1, self.speed.value())
        self.lbl_spacing.setText(
            f'{profile["drone"]} — {profile["mode"]}: pegada '
            f'{calc["footprint_cross_m"]:.1f} × {calc["footprint_along_m"]:.1f} m | '
            f'linhas {calc["line_spacing_m"]:.1f} m | fotos {calc["photo_spacing_m"]:.1f} m | '
            f'GSD geom. {calc["gsd_cm_px"]:.2f} cm/px | Δt foto ~{interval_s:.1f} s'
        )

    def load_selected_polygon(self):
        layer = self.iface.activeLayer()
        if layer is None or not isinstance(layer, QgsVectorLayer):
            QMessageBox.warning(self, "GeoFly", "Ative uma camada vetorial de polígonos.")
            return
        if QgsWkbTypes.geometryType(layer.wkbType()) != QgsWkbTypes.PolygonGeometry:
            QMessageBox.warning(self, "GeoFly", "A camada ativa precisa ser de polígonos.")
            return
        selected = layer.selectedFeatures()
        if len(selected) != 1:
            QMessageBox.warning(self, "GeoFly", "Selecione exatamente 1 polígono na camada ativa.")
            return
        geom = selected[0].geometry()
        if geom is None or geom.isEmpty():
            QMessageBox.warning(self, "GeoFly", "A feição selecionada não possui geometria válida.")
            return
        if not geom.isGeosValid():
            geom = geom.makeValid()
        self.source_geom = QgsGeometry(geom)
        self.source_crs = layer.crs()
        self.metric_crs = metric_crs_for_geometry(self.source_geom, self.source_crs)
        self.polygon_metric = transform_geometry(self.source_geom, self.source_crs, self.metric_crs)
        self.lbl_area.setText(f"{layer.name()} — feição {selected[0].id()} | CRS métrico: {self.metric_crs.authid()}")
        self.lbl_status.setText("Polígono carregado. Defina o Home e gere a missão.")
        if self.home_project is None:
            self.set_home_centroid()

    def start_home_capture(self):
        self._previous_map_tool = self.canvas.mapTool()
        self._map_tool = QgsMapToolEmitPoint(self.canvas)
        self._map_tool.canvasClicked.connect(self._home_clicked)
        self.canvas.setMapTool(self._map_tool)
        self.lbl_status.setText("Clique no mapa para definir o ponto de decolagem (Home).")

    def _home_clicked(self, point, button):
        self.home_project = QgsPointXY(point)
        project_crs = QgsProject.instance().crs()
        if self.metric_crs is not None:
            self.home_metric = transform_point(self.home_project, project_crs, self.metric_crs)
        else:
            self.home_metric = None
        self._update_home_label()
        if self._previous_map_tool is not None:
            self.canvas.setMapTool(self._previous_map_tool)
        self.lbl_status.setText("Home definido.")

    def set_home_centroid(self):
        if self.source_geom is None:
            QMessageBox.information(self, "GeoFly", "Carregue primeiro um polígono selecionado.")
            return
        project_crs = QgsProject.instance().crs()
        c_src = QgsPointXY(self.source_geom.centroid().asPoint())
        self.home_project = transform_point(c_src, self.source_crs, project_crs)
        self.home_metric = transform_point(c_src, self.source_crs, self.metric_crs)
        self._update_home_label()

    def _update_home_label(self):
        if self.home_project is None:
            self.lbl_home.setText("Home: não definido")
        else:
            self.lbl_home.setText(f"Home: X={self.home_project.x():.3f}, Y={self.home_project.y():.3f} ({QgsProject.instance().crs().authid()})")

    def _selected_dem(self):
        layer_id = self.dem.currentData()
        return QgsProject.instance().mapLayer(layer_id) if layer_id else None

    def generate(self):
        try:
            if self.polygon_metric is None:
                raise ValueError("Selecione e carregue um polígono primeiro.")
            if self.home_metric is None:
                raise ValueError("Defina o ponto Home.")

            profile = self._camera_profile()
            calc = spacing_for_camera(self.altitude.value(), self.front.value(), self.side.value(), profile)
            line_spacing = calc["line_spacing_m"]
            photo_spacing = calc["photo_spacing_m"]
            seg1, wp1 = generate_grid(self.polygon_metric, line_spacing, photo_spacing, self.angle.value(), 1)
            segments = list(seg1)
            waypoints = list(wp1)
            if self.cross.isChecked():
                seg2, wp2 = generate_grid(self.polygon_metric, line_spacing, photo_spacing, (self.angle.value() + 90.0) % 360.0, 2)
                segments.extend(seg2)
                # Avoid exact duplicate at transition when possible.
                if waypoints and wp2:
                    p0, p1 = waypoints[-1]["point"], wp2[0]["point"]
                    if math.hypot(p1.x()-p0.x(), p1.y()-p0.y()) < 0.05:
                        wp2 = wp2[1:]
                waypoints.extend(wp2)

            if self.terrain.isChecked():
                dem = self._selected_dem()
                if dem is None:
                    raise ValueError("Selecione um raster MDE/MDT para acompanhar o terreno.")
                home_ground = apply_terrain(waypoints, dem, self.metric_crs, self.home_metric, self.altitude.value())
            else:
                home_ground = None
                apply_constant_height(waypoints, self.altitude.value())

            self.segments = segments
            self.waypoints = waypoints
            self._create_layers(home_ground)
            photos = sum(1 for w in waypoints if w.get("photo"))
            dist = path_distance_m(waypoints)
            secs = dist / max(0.1, self.speed.value())
            mins = secs / 60.0
            parts = math.ceil(len(waypoints) / 200.0)
            terrain_txt = f" | Home MSL {home_ground:.1f} m" if home_ground is not None else ""
            self.lbl_status.setText(
                f'{profile["drone"]} / {profile["mode"]} | Missão: {len(waypoints)} waypoints | '
                f'{photos} fotos | {dist/1000:.2f} km | ~{mins:.1f} min | {parts} KMZ | '
                f'GSD {calc["gsd_cm_px"]:.2f} cm/px{terrain_txt}'
            )
            self.btn_export.setEnabled(True)
        except Exception as exc:
            QMessageBox.critical(self, "GeoFly — erro", str(exc))
            self.lbl_status.setText(f"Erro: {exc}")

    def _remove_old_layers(self):
        project = QgsProject.instance()
        for layer_id in self.generated_layers:
            if project.mapLayer(layer_id):
                project.removeMapLayer(layer_id)
        self.generated_layers = []

    def _create_layers(self, home_ground):
        self._remove_old_layers()
        project = QgsProject.instance()
        project_crs = project.crs()
        to_project = QgsCoordinateTransform(self.metric_crs, project_crs, project)

        group = project.layerTreeRoot().findGroup("GeoFly")
        if group is None:
            group = project.layerTreeRoot().addGroup("GeoFly")

        # Flight lines
        lines = QgsVectorLayer(f"LineString?crs={project_crs.authid()}", "GeoFly - Linhas de voo", "memory")
        lines.dataProvider().addAttributes([QgsField("grid", QVariant.Int), QgsField("row", QVariant.Int)])
        lines.updateFields()
        feats = []
        for item in self.segments:
            g = QgsGeometry(item["geometry"])
            g.transform(to_project)
            f = QgsFeature(lines.fields()); f.setGeometry(g); f["grid"] = item["grid"]; f["row"] = item["row"]; feats.append(f)
        lines.dataProvider().addFeatures(feats); lines.updateExtents()
        project.addMapLayer(lines, False); group.addLayer(lines); self.generated_layers.append(lines.id())

        # Waypoints
        pts = QgsVectorLayer(f"Point?crs={project_crs.authid()}", "GeoFly - Waypoints", "memory")
        pts.dataProvider().addAttributes([
            QgsField("id", QVariant.Int), QgsField("tipo", QVariant.String), QgsField("foto", QVariant.Int),
            QgsField("grid", QVariant.Int), QgsField("ground_msl", QVariant.Double),
            QgsField("execute_h", QVariant.Double), QgsField("agl_check", QVariant.Double),
        ])
        pts.updateFields(); feats = []
        for i, wp in enumerate(self.waypoints):
            p = to_project.transform(wp["point"])
            f = QgsFeature(pts.fields()); f.setGeometry(QgsGeometry.fromPointXY(p))
            f["id"] = i; f["tipo"] = wp.get("kind", ""); f["foto"] = 1 if wp.get("photo") else 0
            f["grid"] = wp.get("grid", 1)
            if wp.get("ground_msl") is not None: f["ground_msl"] = float(wp["ground_msl"])
            f["execute_h"] = float(wp["execute_h"]); f["agl_check"] = float(wp["agl_check"])
            feats.append(f)
        pts.dataProvider().addFeatures(feats); pts.updateExtents()
        project.addMapLayer(pts, False); group.addLayer(pts); self.generated_layers.append(pts.id())

        # Home
        home = QgsVectorLayer(f"Point?crs={project_crs.authid()}", "GeoFly - Home", "memory")
        home.dataProvider().addAttributes([QgsField("ground_msl", QVariant.Double)]); home.updateFields()
        hp = to_project.transform(self.home_metric)
        hf = QgsFeature(home.fields()); hf.setGeometry(QgsGeometry.fromPointXY(hp))
        if home_ground is not None: hf["ground_msl"] = float(home_ground)
        home.dataProvider().addFeature(hf); home.updateExtents()
        project.addMapLayer(home, False); group.addLayer(home); self.generated_layers.append(home.id())

        self.canvas.refresh()

    def export(self):
        try:
            if not self.waypoints:
                raise ValueError("Gere uma missão antes de exportar.")
            profile = self._camera_profile()
            dji_profile = profile.get("dji_profile")
            if not dji_profile:
                QMessageBox.warning(
                    self,
                    "GeoFly — exportação indisponível",
                    f'Não há perfil de exportação DJI Fly configurado para {profile["drone"]}.'
                )
                return
            if profile.get("export_family") in ("djifly_experimental", "djifly_native_experimental"):
                answer = QMessageBox.question(
                    self,
                    "GeoFly — perfil DJI Fly experimental",
                    f'A exportação para {profile["drone"]} ainda não foi validada em campo no GeoFly QGIS.\n\n'
                    'O KMZ será gerado com um perfil DJI Fly experimental baseado no formato nativo deste modelo. Faça primeiro uma missão curta, '
                    'em área aberta e com poucos waypoints, e confira cuidadosamente altitude, Home, trajetória, '
                    'gimbal e ações antes de executar.\n\nDeseja gerar o KMZ mesmo assim?',
                    QMessageBox.Yes | QMessageBox.No,
                    QMessageBox.No,
                )
                if answer != QMessageBox.Yes:
                    return
            path, _ = QFileDialog.getSaveFileName(self, "Salvar KMZ DJI", "Missao_GeoFly_QGIS.kmz", "KMZ (*.kmz)")
            if not path:
                return
            if path.lower().endswith(".kmz"):
                path = path[:-4]

            wgs84 = QgsCoordinateReferenceSystem("EPSG:4326")
            to_wgs = QgsCoordinateTransform(self.metric_crs, wgs84, QgsProject.instance())
            data = []
            for wp in self.waypoints:
                p = to_wgs.transform(wp["point"])
                data.append({
                    "lon": p.x(), "lat": p.y(), "execute_h": float(wp["execute_h"]),
                    "photo": bool(wp.get("photo")),
                })
            outputs = export_kmz(path, data, self.altitude.value(), self.speed.value(), self.gimbal.value(), dji_profile=dji_profile)
            QMessageBox.information(self, "GeoFly", "KMZ gerado:\n" + "\n".join(outputs))
            self.lbl_status.setText(f"Exportação concluída: {len(outputs)} arquivo(s) KMZ.")
        except Exception as exc:
            QMessageBox.critical(self, "GeoFly — erro na exportação", str(exc))
