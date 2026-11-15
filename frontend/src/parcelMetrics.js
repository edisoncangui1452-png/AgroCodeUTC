export function parcelArea(geometry, areaHectares) {
  if (areaHectares === null || areaHectares === undefined || areaHectares === '') return null
  const hectares = Number(areaHectares)
  if (!geometry || geometry.type !== 'Polygon' || !Number.isFinite(hectares) || hectares < 0) return null
  return { hectares, squareMeters: hectares * 10000 }
}

export function formatParcelArea(geometry, areaHectares, locale = 'es') {
  const area = parcelArea(geometry, areaHectares)
  if (!area) return null
  const format = value => value.toLocaleString(locale, { maximumFractionDigits: 2 })
  return { hectares: format(area.hectares), squareMeters: format(area.squareMeters) }
}

export function selectedParcelArea(parcels, selectedId, geometry, locale = 'es') {
  const parcel = parcels.find(item => String(item.id) === String(selectedId))
  if (!parcel || JSON.stringify(parcel.geometry) !== JSON.stringify(geometry)) return null
  return formatParcelArea(parcel.geometry, parcel.area_ha, locale)
}
