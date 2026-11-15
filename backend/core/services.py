import calendar
from datetime import date, timedelta
from math import isfinite
from statistics import mean, pstdev

import numpy as np
import requests
from django.core.cache import cache
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
DASHBOARD_PARAMETERS = ["T2M", "PRECTOTCORR", "GWETTOP", "T2M_MIN"]
BASELINE_PARAMETERS = ["T2M", "PRECTOTCORR", "T2M_MIN"]
BASELINE_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"


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


def summarize_dashboard_month(values, year, month):
    days = calendar.monthrange(year, month)[1]
    readings = {}
    coverage = {}
    for parameter in DASHBOARD_PARAMETERS:
        series = []
        for day in range(1, days + 1):
            value = values.get(parameter, {}).get(f"{year}{month:02}{day:02}")
            if isinstance(value, (int, float)) and value > -900 and (
                parameter != "GWETTOP" or 0 <= value <= 1
            ) and (parameter != "PRECTOTCORR" or value >= 0):
                series.append(float(value))
        readings[parameter] = series
        coverage[parameter] = len(series)
    temperature = round(mean(readings["T2M"]), 1) if coverage["T2M"] >= days * 0.8 else None
    rainfall = round(sum(readings["PRECTOTCORR"]), 1) if coverage["PRECTOTCORR"] == days else None
    soil_index = round(mean(readings["GWETTOP"]) * 100) if coverage["GWETTOP"] >= days * 0.8 else None
    frost = round(sum(value < 0 for value in readings["T2M_MIN"]) / coverage["T2M_MIN"] * 100) if coverage["T2M_MIN"] >= days * 0.8 else None
    return {
        "period": f"{year}-{month:02}", "days": days, "coverage": coverage,
        "temperature_c": temperature, "precipitation_mm": rainfall,
        "soil_wetness_index_percent": soil_index, "observed_frost_percent": frost,
    }


def get_dashboard_metrics(parcel):
    """Only completed months; never convert missing data into a dashboard number."""
    last_day = timezone.now().date().replace(day=1) - timedelta(days=1)
    for _ in range(3):
        year, month = last_day.year, last_day.month
        key = f"dashboard:v1:{parcel.pk}:{parcel.latitude:.5f}:{parcel.longitude:.5f}:{year}:{month}"
        cached = cache.get(key)
        if cached is not None:
            return {**cached, "cached": True}
        params = {
            "parameters": ",".join(DASHBOARD_PARAMETERS), "community": "AG",
            "longitude": parcel.longitude, "latitude": parcel.latitude,
            "start": f"{year}{month:02}01", "end": f"{year}{month:02}{last_day.day:02}",
            "format": "JSON", "time-standard": "UTC",
        }
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        with requests.Session() as session:
            session.mount("https://", HTTPAdapter(max_retries=Retry(total=1, backoff_factor=0.5, status_forcelist=[429, 502, 503, 504])))
            response = session.get(POWER_URL, params=params, timeout=(5, 25))
            response.raise_for_status()
            payload = response.json()
        values = payload.get("properties", {}).get("parameter", {})
        if not isinstance(values, dict) or not all(isinstance(values.get(p), dict) for p in DASHBOARD_PARAMETERS):
            raise ValueError("NASA POWER devolvió un formato inesperado para los indicadores.")
        summary = summarize_dashboard_month(values, year, month)
        if summary["temperature_c"] is not None and summary["precipitation_mm"] is not None:
            result = {
                **summary, "cached": False, "source": "NASA POWER daily point · AG",
                "notice": "Estimaciones regionales. Humedad: índice superficial GWETTOP (0–1), no medición volumétrica de la finca. "
                          "Heladas: porcentaje de días observados con T2M_MIN < 0 °C, no pronóstico de riesgo futuro.",
            }
            cache.set(key, result, 6 * 60 * 60)
            return result
        last_day = last_day.replace(day=1) - timedelta(days=1)
    raise ValueError("No hay un mes calendario completo con datos suficientes en los últimos tres meses.")


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


def historical_baseline(values, start_year=1983, end_year=2025):
    """Monthly climatology. POWER monthly PRECTOTCORR is mm/day, not mm/month."""
    series = []
    for year in range(start_year, end_year + 1):
        for month in range(1, 13):
            key = f"{year}{month:02}"
            row = {"year": year, "month": month}
            for parameter in BASELINE_PARAMETERS:
                value = values.get(parameter, {}).get(key)
                valid = isinstance(value, (int, float)) and value > -900
                row[parameter] = float(value) if valid else None
            if row["PRECTOTCORR"] is not None and row["PRECTOTCORR"] >= 0:
                row["rain_mm"] = row["PRECTOTCORR"] * calendar.monthrange(year, month)[1]
            else:
                row["rain_mm"] = None
            series.append(row)
    months = []
    for month in range(1, 13):
        rows = [row for row in series if row["month"] == month]
        temps = [row["T2M"] for row in rows if row["T2M"] is not None]
        rains = [row["rain_mm"] for row in rows if row["rain_mm"] is not None]
        minima = [row["T2M_MIN"] for row in rows if row["T2M_MIN"] is not None]
        def interval(data):
            return {
                "median": round(float(np.median(data)), 1),
                "p10": round(float(np.percentile(data, 10)), 1),
                "p90": round(float(np.percentile(data, 90)), 1),
                "observations": len(data),
            } if len(data) >= 30 else None
        months.append({
            "month": month, "temperature_c": interval(temps), "rain_mm": interval(rains),
            "rain_ge_100mm_frequency_percent": round(100 * sum(v >= 100 for v in rains) / len(rains))
            if len(rains) >= 30 else None,
            "temperature_below_10c_frequency_percent": round(100 * sum(v < 10 for v in temps) / len(temps))
            if len(temps) >= 30 else None,
            "monthly_mean_min_below_zero_frequency_percent": round(100 * sum(v < 0 for v in minima) / len(minima))
            if len(minima) >= 30 else None,
            "minimum_years_checked": len(minima),
        })
    return months


def get_historical_baseline(parcel):
    cached = ClimateQuery.objects.filter(
        parcel=parcel, latitude=parcel.latitude, longitude=parcel.longitude,
        start_year=1983, end_year=2025, source="NASA POWER monthly point",
        fetched_at__gte=timezone.now() - timedelta(days=90),
    ).order_by("-fetched_at").first()
    if cached:
        values, fetched_at, from_cache = cached.payload, cached.fetched_at, True
    else:
        from requests.adapters import HTTPAdapter
        from urllib3.util.retry import Retry
        with requests.Session() as session:
            session.mount("https://", HTTPAdapter(max_retries=Retry(
                total=2, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504],
            )))
            response = session.get(BASELINE_URL, params={
                "parameters": ",".join(BASELINE_PARAMETERS), "community": "AG",
                "longitude": parcel.longitude, "latitude": parcel.latitude,
                "start": 1983, "end": 2025, "format": "JSON",
            }, timeout=(5, 40))
            response.raise_for_status()
            data = response.json()
        values = data.get("properties", {}).get("parameter", {})
        if not all(isinstance(values.get(p), dict) for p in BASELINE_PARAMETERS):
            raise ValueError("NASA POWER no devolvió la serie histórica esperada.")
        entry = ClimateQuery.objects.create(
            parcel=parcel, latitude=parcel.latitude, longitude=parcel.longitude,
            start_year=1983, end_year=2025, payload=values, source="NASA POWER monthly point",
            parameters=BASELINE_PARAMETERS,
            units={"T2M": "°C", "PRECTOTCORR": "mm/día", "T2M_MIN": "°C"},
            metadata={"api": data.get("header", {}).get("api", {}), "sources": data.get("header", {}).get("sources", [])},
        )
        fetched_at, from_cache = entry.fetched_at, False
    return {
        "period": [1983, 2025], "months": historical_baseline(values),
        "source": "NASA POWER monthly point · AG", "fetched_at": fetched_at,
        "cached": from_cache,
            "notice": "Frecuencias empíricas de meses históricos, NO probabilidades calibradas para una fecha futura. "
                  "T2M_MIN mensual es la media de mínimas diarias: no mide si hubo alguna helada en el mes. "
                  "No hay pronóstico diario ni proyección anual. Los datos son regionales, no sensores de la parcela.",
    }


def recommendations(parcel, monthly):
    """Explore complete historical growth windows without treating annual rain as monthly water demand."""
    if parcel.country.upper() != "EC" or not (-4.4 <= parcel.latitude <= 0.5 and -79.2 <= parcel.longitude <= -77.5):
        return []
    by_month = {(row["year"], row["month"]): row for row in monthly}
    years = sorted({row["year"] for row in monthly})
    annual_rain = [
        round(sum(by_month[(year, month)]["PRECTOTCORR"] for month in range(1, 13)), 1)
        for year in years
        if all(by_month.get((year, month), {}).get("PRECTOTCORR") is not None for month in range(1, 13))
    ]
    result = []
    for crop in Crop.objects.filter(validated=True, country_code="EC", region="Sierra ecuatoriana"):
        durations = {}
        for target in (2, 3, 6):
            if not (crop.cycle_days <= target * 30 <= (crop.max_cycle_days or crop.cycle_days)):
                continue
            compatible = []
            for start_month in range(1, 13):
                observed = []
                for year in years:
                    rows = [
                        by_month.get((year + (start_month + offset - 1) // 12, (start_month + offset - 1) % 12 + 1))
                        for offset in range(target)
                    ]
                    if any(not row or row["T2M"] is None or row["PRECTOTCORR"] is None for row in rows):
                        continue
                    observed.append({
                        "year": year,
                        "fits": all(crop.min_temp_c <= row["T2M"] <= crop.max_temp_c for row in rows),
                        "rain_mm": round(sum(row["PRECTOTCORR"] for row in rows), 1),
                    })
                fits = sum(item["fits"] for item in observed)
                if len(observed) >= 2 and fits >= 2:
                    compatible.append({
                        "start_month": start_month, "historical_matches": fits,
                        "years_checked": len(observed),
                        "observed_rain_mm": [item["rain_mm"] for item in observed],
                    })
            if compatible:
                durations[str(target)] = compatible
        if durations:
            optimal_rain_years = sum(
                crop.min_annual_rain_mm <= total <= crop.max_annual_rain_mm
                for total in annual_rain
            ) if crop.min_annual_rain_mm is not None and crop.max_annual_rain_mm is not None else None
            rain_context = (
                f"Lluvia anual observada: {min(annual_rain):.0f}–{max(annual_rain):.0f} mm; "
                f"rango óptimo anual FAO: {crop.min_annual_rain_mm:.0f}–{crop.max_annual_rain_mm:.0f} mm. "
                f"{optimal_rain_years}/{len(annual_rain)} años en ese rango."
                if annual_rain and crop.min_annual_rain_mm is not None and crop.max_annual_rain_mm is not None
                else "Sin comparación anual de lluvia suficiente."
            )
            if optimal_rain_years is None or not annual_rain:
                rain_status = "sin_datos"
            elif optimal_rain_years == len(annual_rain):
                rain_status = "en_rango_historico"
            else:
                rain_status = "compatibilidad_parcial"
            available = [int(duration) for duration in durations]
            midpoint = (crop.cycle_days + (crop.max_cycle_days or crop.cycle_days)) / 2
            primary_duration = min(available, key=lambda duration: (abs(duration * 30 - midpoint), duration))
            result.append({
                "id": crop.pk, "crop": crop.name, "family": crop.family, "region": crop.region,
                "cycle_days": crop.cycle_days, "max_cycle_days": crop.max_cycle_days,
                "primary_duration": primary_duration, "rain_status": rain_status,
                "durations": durations, "months": sorted({w["start_month"] for windows in durations.values() for w in windows}),
                "source": crop.source, "regional_validated": crop.regional_validated,
                "rain_context": rain_context, "rain_optimal_years": optimal_rain_years,
                "reason": "La temperatura media de todos los meses del ciclo coincide con el rango óptimo FAO en al menos dos temporadas históricas completas.",
                "risks": "FAO aporta rangos generales, no validación local ni requerimiento hídrico del ciclo. "
                         "La lluvia se informa por separado; verifica suelo, agua, altitud y calendario local antes de sembrar.",
            })
    return result
