"""Transparent, conservative rules for rotations; no generated agronomic claims."""

from .models import ClimateQuery, CropHistory, AgronomicProfile
from .services import monthly_summary


def cached_rotation_months(parcel):
    """Use only an existing NASA daily query for the same point; never fetch a forecast."""
    query = ClimateQuery.objects.filter(
        parcel=parcel, latitude=parcel.latitude, longitude=parcel.longitude,
        source="NASA POWER daily point",
    ).order_by("-fetched_at").first()
    if query and query.end_year - query.start_year <= 2:
        return monthly_summary(query.payload, query.start_year, query.end_year)
    return []


def annual_rain_context(crop, monthly):
    if crop.min_annual_rain_mm is None or crop.max_annual_rain_mm is None:
        return "La ficha no tiene un rango anual de lluvia comparable."
    by_year = {}
    for row in monthly:
        by_year.setdefault(row["year"], {})[row["month"]] = row.get("PRECTOTCORR")
    totals = [sum(months.values()) for months in by_year.values()
              if len(months) == 12 and all(value is not None for value in months.values())]
    if not totals:
        return "No hay años completos de lluvia histórica para esta parcela; falta comprobar el agua disponible."
    matching = sum(crop.min_annual_rain_mm <= total <= crop.max_annual_rain_mm for total in totals)
    if matching == 0:
        return "La lluvia anual histórica no coincidió con el rango óptimo FAO; compatibilidad parcial, revise el agua disponible."
    if matching < len(totals):
        return "La lluvia anual histórica coincidió solo en parte con el rango FAO; compatibilidad parcial, revise el agua disponible."
    return "La lluvia anual histórica estuvo en el rango FAO, pero no mide el agua disponible durante el ciclo."


def rotation_guidance(parcel, names, matched, catalog, monthly):
    """Compare an existing strategy with actual prior crop and documented families."""
    previous = CropHistory.objects.filter(parcel=parcel).order_by("-planted_on").first()
    profile = AgronomicProfile.objects.filter(parcel=parcel).first()
    guidance = []
    if previous:
        guidance.append(f"Último cultivo registrado: {previous.crop_name}.")
        if not previous.harvested_on:
            guidance.append("No hay fecha de cosecha registrada para el cultivo anterior; confirme si la parcela está disponible.")
        if names and names[0].casefold() == previous.crop_name.casefold():
            guidance.append("La estrategia inicia con el mismo cultivo anterior; considere alternar para reducir riesgos compartidos.")
        previous_crop = catalog.get(previous.crop_name.casefold())
        if previous_crop and matched and matched[0] and previous_crop.family == matched[0].family:
            guidance.append("El primer cultivo propuesto comparte familia con el anterior; valore otra familia por posibles plagas y enfermedades comunes.")
        elif matched and matched[0] and previous_crop:
            guidance.append("El primer cultivo propuesto pertenece a otra familia; esto diversifica la rotación, sin garantizar control de plagas.")
        elif matched and matched[0]:
            guidance.append("No hay ficha del cultivo anterior; no se puede comparar su familia.")
    else:
        guidance.append("No hay un cultivo anterior registrado; registre la última siembra para evaluar la sucesión.")
    if profile and profile.soil_texture:
        guidance.append(f"Textura declarada del suelo: {profile.soil_texture}; no equivale a un análisis de fertilidad.")
    if profile and profile.organic_matter is not None:
        guidance.append("Hay materia orgánica registrada, pero sin análisis local no se califica la fertilidad.")
    else:
        guidance.append("Sin análisis de fertilidad; considere una prueba de suelo antes de ajustar nutrientes.")
    if not profile or not profile.irrigation:
        guidance.append("Sin información de riego; compruebe la humedad en campo y el acceso al agua.")
    else:
        guidance.append(f"Riego declarado: {profile.irrigation}; no indica cuánta agua reciben los cultivos.")
    if not monthly:
        guidance.append("No hay clima diario histórico guardado para esta ubicación; no se evaluó temperatura ni lluvia.")
    else:
        guidance.append("Hay clima histórico, pero sin mes de siembra no se puede evaluar la temperatura del ciclo; no es pronóstico.")
        for name, crop in zip(names, matched):
            if crop:
                guidance.append(f"{name}: {annual_rain_context(crop, monthly)}")
    return guidance
