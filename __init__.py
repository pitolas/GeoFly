def classFactory(iface):
    from .plugin import GeoFlyPlugin
    return GeoFlyPlugin(iface)
