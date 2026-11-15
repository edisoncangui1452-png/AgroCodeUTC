import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import { MapContainer, TileLayer, useMap, useMapEvents, Polygon, Marker, WMSTileLayer } from 'react-leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow })
L.drawLocal.draw.toolbar.buttons.polygon = 'Dibujar parcela'
L.drawLocal.draw.handlers.polygon.tooltip.start = 'Haz clic para comenzar el polígono.'
L.drawLocal.draw.handlers.polygon.tooltip.cont = 'Haz clic para agregar un vértice.'
L.drawLocal.draw.handlers.polygon.tooltip.end = 'Haz clic en el primer punto para cerrar.'
L.drawLocal.edit.toolbar.buttons.edit = 'Editar parcela'
L.drawLocal.edit.toolbar.buttons.remove = 'Eliminar parcela del mapa'
L.drawLocal.edit.toolbar.actions.save.title = 'Guardar cambios'
L.drawLocal.edit.toolbar.actions.cancel.title = 'Cancelar'

function MapEditor({ geometry, onChange, onPoint }) {
  const map = useMap()
  const layer = useRef(null)
  useMapEvents({ click(e) { onPoint?.([e.latlng.lat, e.latlng.lng]) } })
  useEffect(() => {
    const drawn = new L.FeatureGroup()
    map.addLayer(drawn)
    const draw = new L.Control.Draw({
      position: 'topright',
      edit: { featureGroup: drawn, remove: true },
      draw: { polygon: { allowIntersection: false, shapeOptions: { color: 'var(--map-field)', weight: 3 } }, rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false },
    })
    map.addControl(draw)
    const onCreated = e => { drawn.clearLayers(); drawn.addLayer(e.layer); onChange(e.layer.toGeoJSON().geometry) }
    const onEdited = () => { const feature = drawn.getLayers()[0]; onChange(feature ? feature.toGeoJSON().geometry : null) }
    const onDeleted = () => onChange(null)
    map.on(L.Draw.Event.CREATED, onCreated)
    map.on(L.Draw.Event.EDITED, onEdited)
    map.on(L.Draw.Event.DELETED, onDeleted)
    layer.current = drawn
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated); map.off(L.Draw.Event.EDITED, onEdited); map.off(L.Draw.Event.DELETED, onDeleted)
      map.removeControl(draw); map.removeLayer(drawn); layer.current = null
    }
  }, [map, onChange, onPoint])
  useEffect(() => {
    if (!layer.current) return
    layer.current.clearLayers()
    if (geometry?.type === 'Polygon') {
      const geo = L.geoJSON({ type: 'Feature', properties: {}, geometry }, { style: { color: 'var(--map-field)', weight: 3, fillOpacity: 0.15 } })
      geo.eachLayer(l => layer.current?.addLayer(l))
      map.fitBounds(geo.getBounds(), { maxZoom: 14, padding: [30, 30] })
    }
  }, [geometry, map])
  return null
}

function FlyTo({ point }) {
  const map = useMap()
  useEffect(() => { if (point) map.flyTo(point, 12) }, [point, map])
  return null
}

export default function ParcelMap({ geometry, onChange, point, onPoint, satellite = false, date }) {
  return <MapContainer center={point || [-1.4, -78.5]} zoom={point ? 12 : 6} className="h-full w-full" scrollWheelZoom>
    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
    {satellite && <WMSTileLayer url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi" layers="MODIS_Terra_CorrectedReflectance_TrueColor" format="image/png" transparent opacity={0.85} time={date} attribution="NASA GIBS / MODIS Terra" />}
    {onChange ? <MapEditor geometry={geometry} onChange={onChange} onPoint={onPoint} /> : geometry?.coordinates && <Polygon positions={geometry.coordinates[0].map(([lon, lat]) => [lat, lon])} pathOptions={{ color: 'var(--map-field)', weight: 3 }} />}
    {point && !geometry && <Marker position={point} />}
    <FlyTo point={point} />
  </MapContainer>
}
