from qgis.PyQt.QtCore import Qt
import os
from qgis.PyQt.QtGui import QIcon
from qgis.PyQt.QtWidgets import QAction

from .dock import GeoFlyDock


class GeoFlyPlugin:
    def __init__(self, iface):
        self.iface = iface
        self.action = None
        self.dock = None

    def initGui(self):
        icon = QIcon(os.path.join(os.path.dirname(__file__), "icons", "geofly.svg"))
        self.action = QAction(icon, "GeoFly QGIS", self.iface.mainWindow())
        self.action.setCheckable(True)
        self.action.triggered.connect(self.toggle_dock)
        self.iface.addToolBarIcon(self.action)
        self.iface.addPluginToMenu("&GeoFly", self.action)

        self.dock = GeoFlyDock(self.iface, self.iface.mainWindow())
        self.iface.addDockWidget(Qt.RightDockWidgetArea, self.dock)
        self.dock.hide()
        self.dock.visibilityChanged.connect(self.action.setChecked)

    def unload(self):
        if self.dock is not None:
            self.iface.removeDockWidget(self.dock)
            self.dock.deleteLater()
            self.dock = None
        if self.action is not None:
            self.iface.removeToolBarIcon(self.action)
            self.iface.removePluginMenu("&GeoFly", self.action)
            self.action.deleteLater()
            self.action = None

    def toggle_dock(self, checked=False):
        if self.dock is None:
            return
        if checked:
            self.dock.show()
            self.dock.raise_()
        else:
            self.dock.hide()
