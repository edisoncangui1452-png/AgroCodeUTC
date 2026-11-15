import calendar
from datetime import date, timedelta
from math import isfinite
from statistics import mean, pstdev

import requests
from django.utils import timezone
from pyproj import Geod
from shapely.geometry import shape
from shapely.errors import ShapelyError
from shapely.validation import explain_validity

from .models import ClimateQuery, Crop

PARAMETERS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M", "ALLSKY_SFC_SW_DWN", "WS2M"]
UNITS = {
    "T2M": "°C", "T2M_MAX": "°C", "T2M_MIN": "°C", "PRECTOTCORR": "mm/día",
    "RH2M": "%", "ALLSKY_SFC_SW_DWN": "MJ/m²/día", "WS2M": "m/s",
}
POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
GEOD = Geod(ellps="WGS84")


def validate_geometry(value):
    if not isinstance(value, dict) or value.get("type") != "Polygon":
        raise ValueError("Se requiere un polígono GeoJSON.")
    if len(str(value)) > 100_000:
        raise ValueError("El GeoJSON supera el tamaño permitido.")
    try:
        geom = shape(value)
        points = sum(len(ring.coords) for ring in [geom.exterior, *geom.interiors])
        if points > 500 or geom.is_empty or not geom.is_valid or geom.area == 0:
            raise ValueError(f"Polígono inválido: {explain_validity(geom)}")
        if any(not (-180 <= x <= 180 and -90 <= y <= 90) for ring in [geom.exterior, *geom.interiors] for x, y in ring.coords):
            raise ValueError("Las coordenadas deben estar dentro de latitud/longitud válidas.")
        if geom.bounds[2] - geom.bounds[0] > 180:
            raise ValueError("Los polígonos que cruzan el antimeridiano aún no están admitidos.")
        area, _ = GEOD.geometry_area_perimeter(geom)
        point = geom.representative_point()
        return point.y, point.x, abs(area) / 10_000
    except (TypeError, AttributeError, IndexError, ShapelyError) as exc:
        raise ValueError("GeoJSON inválido.") from exc


def available_years():
    # The last complete calendar year is the safe default, avoiding partial recent POWER data.
    return timezone.now().year - 3, timezone.now().year - 1


def get_climate(parcel, start_year, end_year):
    if start_year < 1981 or end_year >= timezone.now().year or end_year < start_year or end_year - start_year > 2:
        raise ValueError("Selecciona hasta tres años calendario completos entre 1981 y el año pasado.")
    cached = ClimateQuery.objects.filter(
        parcel=parcel, start_year=start_year, end_year=end_year,
        latitude=parcel.latitude, longitude=parcel.longitude,
        fetched_at__gte=timezone.now() - timezone.timedelta(days=30),
    ).order_by("-fetched_at").first()
    if cached:
        return cached.payload, True, cached.fetched_at
    params = {
        "parameters": ",".join(PARAMETERS), "community": "AG", "longitude": parcel.longitude,
        "latitude": parcel.latitude, "start": f"{start_year}0101", "end": f"{end_year}1231",
        "format": "JSON", "time-standard": "UTC",
    }
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    with requests.Session() as session:
        session.mount("https://", HTTPAdapter(max_retries=Retry(
            total=2, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504],
        )))
        response = session.get(POWER_URL, params=params, timeout=(5, 35))
        response.raise_for_status()
        data = response.json()
    values = data.get("properties", {}).get("parameter", {})
    if not all(isinstance(values.get(p), dict) for p in PARAMETERS):
        raise ValueError("NASA POWER devolvió datos incompletos o un formato inesperado.")
    query = ClimateQuery.objects.create(
        parcel=parcel, latitude=parcel.latitude, longitude=parcel.longitude,
        start_year=start_year, end_year=end_year, payload=values, parameters=PARAMETERS, units=UNITS,
        metadata={
            "api": data.get("header", {}).get("api", {}),
            "sources": data.get("header", {}).get("sources", []),
            "time_standard": data.get("header", {}).get("time_standard", "UTC"),
            "original_units": {key: data.get("parameters", {}).get(key, {}).get("units") for key in PARAMETERS},
            "spatial_resolution": "Resolución espacial nativa de las fuentes NASA POWER; no resolución de parcela",
        },
    )
    return values, False, query.fetched_at


def monthly_summary(values, start_year, end_year):
    output = []
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            days = calendar.monthrange(year, month)[1]
            row = {"year": year, "month": month, "days": days, "coverage": {}}
            for parameter in PARAMETERS:
                series = []
                for day in range(1, days + 1):
                    number = values.get(parameter, {}).get(f"{year}{month:02}{day:02}")
                    if isinstance(number, (int, float)) and number > -900:
                        series.append(float(number))
                row["coverage"][parameter] = len(series)
                # A partial rainfall sum would understate the full month, so require every day.
                enough = len(series) == days if parameter == "PRECTOTCORR" else len(series) >= days * 0.8
                aggregate = {
                    "PRECTOTCORR": sum, "T2M_MAX": max, "T2M_MIN": min,
                }.get(parameter, mean)
                row[parameter] = round(aggregate(series), 2) if enough else None
            output.append(row)
    return output


def daily_coverage(values, start_year, end_year):
    """Describe observed daily coverage without exposing the raw NASA payload."""
    first = date(start_year, 1, 1)
    last = date(end_year, 12, 31)
    total_days = (last - first).days + 1
    output = {}
    for parameter in PARAMETERS:
        valid_days = 0
        first_valid_date = None
        last_valid_date = None
        missing_ranges = []
        missing_start = None
        missing_end = None
        missing_count = 0

        current = first
        while current <= last:
            value = values.get(parameter, {}).get(current.strftime("%Y%m%d"))
            valid = isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value) and value > -900
            if valid:
                valid_days += 1
                first_valid_date = first_valid_date or current
                last_valid_date = current
                if missing_start:
                    missing_ranges.append({
                        "start": missing_start.isoformat(),
                        "end": missing_end.isoformat(),
                        "days": missing_count,
                    })
                    missing_start = missing_end = None
                    missing_count = 0
            else:
                missing_start = missing_start or current
                missing_end = current
                missing_count += 1
            current += timedelta(days=1)

        if missing_start:
            missing_ranges.append({
                "start": missing_start.isoformat(),
                "end": missing_end.isoformat(),
                "days": missing_count,
            })
        missing_days = total_days - valid_days
        output[parameter] = {
            "valid_days": valid_days,
            "missing_days": missing_days,
            "total_days": total_days,
            "coverage_percent": round(valid_days * 100 / total_days, 2),
            "complete": missing_days == 0,
            "first_valid_date": first_valid_date.isoformat() if first_valid_date else None,
            "last_valid_date": last_valid_date.isoformat() if last_valid_date else None,
            "missing_ranges": missing_ranges,
        }
    return output


def historical_scenario(monthly):
    scenario = []
    for month in range(1, 13):
        item = {"month": month}
        for key in ["T2M", "PRECTOTCORR"]:
            valid = [row[key] for row in monthly if row["month"] == month and row[key] is not None]
            item[key] = {"central": round(mean(valid), 2), "min": min(valid), "max": max(valid),
                         "variation": round(pstdev(valid), 2), "observations": len(valid)} if len(valid) >= 2 else None
        scenario.append(item)
    return scenario


def recommendations(parcel, monthly):
    country = parcel.country.strip().upper()
    # Never silently extrapolate a regionally documented crop to another region.
    crops = Crop.objects.filter(validated=True, country_code=country)
    result = []
    for crop in crops:
        if crop.region.lower() not in (parcel.location or "").lower():
            continue
        compatible = []
        for month in range(1, 13):
            rows = [r for r in monthly if r["month"] == month and r["T2M"] is not None and r["PRECTOTCORR"] is not None]
            if len(rows) < 2:
                continue
            temp = mean(r["T2M"] for r in rows)
            rain = mean(r["PRECTOTCORR"] for r in rows)
            if crop.min_temp_c <= temp <= crop.max_temp_c and (
                crop.min_rain_mm is None or crop.min_rain_mm <= rain <= crop.max_rain_mm
            ):
                compatible.append(month)
        if compatible:
            result.append({
                "crop": crop.name, "family": crop.family, "months": compatible, "region": crop.region,
                "cycle_days": crop.cycle_days, "source": crop.source,
                "reason": "En estos meses, los promedios históricos de temperatura y lluvia coinciden con los rangos de la ficha regional.",
                "risks": "Tres años son una muestra pequeña. Confirma suelo, agua, altitud y calendario con un profesional.",
            })
    return result
