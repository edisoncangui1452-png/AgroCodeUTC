"""Weather-only inputs for the simulator. No crop or fertilizer calculations."""

import math
from datetime import date, timedelta
from statistics import mean

import requests
from django.core.cache import cache
from django.utils import timezone

from .services import get_historical_baseline

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
SEASONAL_URL = "https://seasonal-api.open-meteo.com/v1/seasonal"
SHORT_MODEL = "ecmwf_ifs"
LONG_MODEL = "ecmwf_ec46"
DAILY = (
    "temperature_2m_min", "temperature_2m_mean", "temperature_2m_max",
    "precipitation_sum", "relative_humidity_2m_mean", "shortwave_radiation_sum",
)
SOIL_SHORT = "soil_moisture_0_to_1cm"
SOIL_LONG = "soil_moisture_0_to_7cm_mean"
FIELDS = {
    "temperature_min_c": ("temperature_2m_min", "°C"),
    "temperature_mean_c": ("temperature_2m_mean", "°C"),
    "temperature_max_c": ("temperature_2m_max", "°C"),
    "precipitation_mm": ("precipitation_sum", "mm"),
    "relative_humidity_air_percent": ("relative_humidity_2m_mean", "%"),
    "solar_radiation_mj_m2": ("shortwave_radiation_sum", "MJ/m²"),
}
UNITS = {key: unit for key, (_, unit) in FIELDS.items()} | {"soil_moisture_model_percent": "% volumétrico"}
NOTES = {
    "forecast": "Pronóstico regional de modelo: puede cambiar; no es una medición dentro de la parcela.",
    "subseasonal_forecast": "EC46 (36 km) no está corregido para la parcela. Semanas y escenarios, no predicciones diarias exactas ni probabilidades de cosecha.",
    "historical": "Referencia mensual histórica 1983–2025; NO es un pronóstico para estas fechas.",
}


class WeatherUnavailable(Exception):
    """Safe-to-display error without external URLs or private coordinates."""


def valid_coordinates(parcel):
    try:
        lat, lon = float(parcel.latitude), float(parcel.longitude)
    except (TypeError, ValueError):
        raise ValueError("La parcela no tiene coordenadas válidas.")
    if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError("La parcela no tiene coordenadas válidas.")
    return lat, lon


def _number(value):
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def _value(series, unit, index, expected, soil=False):
    if not isinstance(series, list) or unit != expected or index >= len(series):
        return None
    number = _number(series[index])
    return round(number * 100, 1) if soil and number is not None and 0 <= number <= 1 else (
        round(number, 1) if number is not None and not soil else None
    )


def _rows(data, days):
    daily = data.get("daily")
    units = data.get("daily_units")
    if data.get("timezone", "GMT") not in ("GMT", "UTC") or data.get("utc_offset_seconds", 0) != 0:
        raise WeatherUnavailable("El servicio meteorológico no confirmó el horario UTC solicitado.")
    if not isinstance(daily, dict) or not isinstance(units, dict) or not isinstance(daily.get("time"), list):
        raise WeatherUnavailable("El servicio meteorológico no entregó fechas diarias válidas.")
    start = timezone.now().date()
    expected = [(start + timedelta(days=index)).isoformat() for index in range(days)]
    if daily["time"][:days] != expected:
        raise WeatherUnavailable("El servicio meteorológico no entregó el periodo solicitado en UTC.")
    return daily, units, expected


def _request(url, params):
    try:
        with requests.Session() as session:
            response = session.get(url, params=params, timeout=(5, 30), allow_redirects=False)
            if response.is_redirect:
                raise WeatherUnavailable("El servicio meteorológico respondió con una redirección inesperada.")
            response.raise_for_status()
            data = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise WeatherUnavailable("No fue posible consultar Open-Meteo en este momento.") from exc
    if not isinstance(data, dict) or data.get("error"):
        raise WeatherUnavailable("Open-Meteo no entregó datos meteorológicos válidos.")
    return data


def _base(parcel, days, info_type, model, fetched_at):
    return {
        "parcel": parcel.pk, "coordinates": {"latitude": parcel.latitude, "longitude": parcel.longitude},
        "days": days, "information_type": info_type,
        "measurement_type": "historical_model_estimate" if info_type == "historical" else "model_forecast",
        "demonstration_scenario": False,
        "variable_origin": {key: "not_available" if info_type == "historical" and key == "soil_moisture_model_percent"
                            else "model_soil_estimate" if key == "soil_moisture_model_percent"
                            else "historical_model_estimate" if info_type == "historical" else "model_forecast"
                            for key in UNITS},
        "source": "NASA POWER" if info_type == "historical" else "Open-Meteo",
        "model": model, "queried_at": timezone.now().isoformat(), "issued_at": None,
        "timezone": "UTC", "units": UNITS, "fetched_at": fetched_at,
        "cached": False, "stale": False, "age_seconds": 0, "notice": NOTES[info_type],
    }


def _short(parcel, days):
    data = _request(FORECAST_URL, {
        "latitude": parcel.latitude, "longitude": parcel.longitude, "models": SHORT_MODEL,
        "timezone": "UTC", "forecast_days": days, "daily": ",".join(DAILY),
        "hourly": SOIL_SHORT, "temperature_unit": "celsius", "precipitation_unit": "mm",
    })
    daily, units, dates = _rows(data, days)
    hourly, hourly_units = data.get("hourly", {}), data.get("hourly_units", {})
    soil_by_date = {}
    if isinstance(hourly, dict) and isinstance(hourly_units, dict) and hourly_units.get(SOIL_SHORT) == "m³/m³":
        for stamp, value in zip(hourly.get("time", []), hourly.get(SOIL_SHORT, [])):
            number = _number(value)
            if isinstance(stamp, str) and number is not None and 0 <= number <= 1:
                soil_by_date.setdefault(stamp[:10], []).append(number)
    rows = []
    for index, day in enumerate(dates):
        values = {key: _value(daily.get(field), units.get(field), index, unit)
                  for key, (field, unit) in FIELDS.items()}
        soil = soil_by_date.get(day, [])
        values["soil_moisture_model_percent"] = round(mean(soil) * 100, 1) if len(soil) == 24 else None
        rows.append({"period_start": day, "period_end": day, "values": values,
                     "missing": [name for name, value in values.items() if value is None],
                     "uncertainty": None})
    result = _base(parcel, days, "forecast", "ECMWF IFS (Open-Meteo)", timezone.now().isoformat())
    result.update({"valid_from": dates[0], "valid_to": dates[-1], "resolution": "daily", "rows": rows})
    return result


def _ensemble_values(daily, units, field, expected_unit, indices, aggregate, soil=False):
    if units.get(field) != expected_unit:
        return []
    members = []
    for key, series in daily.items():
        if not key.startswith(field + "_member") or not isinstance(series, list):
            continue
        numbers = [_number(series[i]) if i < len(series) else None for i in indices]
        if all(number is not None and (not soil or 0 <= number <= 1) for number in numbers):
            members.append((sum(numbers) if aggregate == "sum" else mean(numbers)) * (100 if soil else 1))
    return members


def _ensemble_range(members):
    if len(members) < 2:
        return None
    return {"min": round(min(members), 1), "max": round(max(members), 1),
            "members": len(members), "method": "rango de miembros EC46; no intervalo de confianza"}


def _long(parcel):
    data = _request(SEASONAL_URL, {
        "latitude": parcel.latitude, "longitude": parcel.longitude, "models": LONG_MODEL,
        "timezone": "UTC", "forecast_days": 45, "daily": ",".join((*DAILY, SOIL_LONG)),
        "temperature_unit": "celsius", "precipitation_unit": "mm",
    })
    daily, units, dates = _rows(data, 45)
    rows = []
    for offset in range(0, 45, 7):
        indices = list(range(offset, min(offset + 7, 45)))
        values = {}
        basis = {}
        for key, (field, unit) in FIELDS.items():
            numbers = [_value(daily.get(field), units.get(field), i, unit) for i in indices]
            aggregate = "sum" if key in ("precipitation_mm", "solar_radiation_mj_m2") else "mean"
            members = _ensemble_values(daily, units, field, unit, indices, aggregate)
            values[key] = round(mean(members), 1) if members else (
                round(sum(numbers) if aggregate == "sum" else mean(numbers), 1)
                if all(v is not None for v in numbers) else None)
            basis[key] = "ensemble_mean" if members else "control_run" if values[key] is not None else "missing"
        soil = [_value(daily.get(SOIL_LONG), units.get(SOIL_LONG), i, "m³/m³", soil=True) for i in indices]
        soil_members = _ensemble_values(daily, units, SOIL_LONG, "m³/m³", indices, "mean", soil=True)
        values["soil_moisture_model_percent"] = round(mean(soil_members), 1) if soil_members else (
            round(mean(soil), 1) if all(v is not None for v in soil) else None)
        basis["soil_moisture_model_percent"] = "ensemble_mean" if soil_members else (
            "control_run" if values["soil_moisture_model_percent"] is not None else "missing")
        uncertainty = {}
        for key, field, unit, aggregate in (
            ("temperature_mean_c", "temperature_2m_mean", "°C", "mean"),
            ("precipitation_mm", "precipitation_sum", "mm", "sum"),
        ):
            interval = _ensemble_range(_ensemble_values(daily, units, field, unit, indices, aggregate))
            if interval:
                uncertainty[key] = interval
        rows.append({"period_start": dates[indices[0]], "period_end": dates[indices[-1]],
                     "values": values, "missing": [name for name, value in values.items() if value is None],
                     "uncertainty": uncertainty or None, "basis": basis})
    if all(row["values"]["temperature_mean_c"] is None and row["values"]["precipitation_mm"] is None for row in rows):
        raise WeatherUnavailable("EC46 no entregó tendencias subestacionales utilizables.")
    result = _base(parcel, 45, "subseasonal_forecast", "ECMWF EC46 (Open-Meteo)", timezone.now().isoformat())
    result.update({"valid_from": dates[0], "valid_to": dates[-1], "resolution": "weekly",
                   "rows": rows, "uncertainty_method": "extremos de miembros del conjunto, no probabilidad calibrada"})
    return result


def _historical(parcel):
    baseline = get_historical_baseline(parcel)
    end = timezone.now().date() + timedelta(days=44)
    months = []
    cursor = timezone.now().date().replace(day=1)
    while cursor <= end:
        months.append(cursor.month)
        cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
    rows = []
    for month in months:
        data = baseline["months"][month - 1]
        temp, rain = data["temperature_c"], data["rain_mm"]
        values = {key: None for key in UNITS}
        values["temperature_mean_c"] = temp["median"] if temp else None
        values["precipitation_mm"] = rain["median"] if rain else None
        ranges = {key: {"p10": source["p10"], "p90": source["p90"],
                        "method": "percentiles mensuales históricos; no incertidumbre de pronóstico"}
                  for key, source in (("temperature_mean_c", temp), ("precipitation_mm", rain)) if source}
        rows.append({"reference_month": month, "period_start": None, "period_end": None,
                     "values": values, "missing": [key for key, value in values.items() if value is None],
                     "uncertainty": ranges or None})
    fetched = baseline["fetched_at"].isoformat()
    result = _base(parcel, 45, "historical", "NASA POWER climatología mensual (1983–2025)", fetched)
    result.update({"valid_from": None, "valid_to": None, "resolution": "historical_month",
                   "historical_period": baseline["period"], "rows": rows, "cached": baseline["cached"],
                   "age_seconds": max(0, int((timezone.now() - baseline["fetched_at"]).total_seconds()))})
    return result


def get_simulator_weather(parcel, days, refresh=False):
    lat, lon = valid_coordinates(parcel)
    if days not in (4, 7, 45):
        raise ValueError("Seleccione una modalidad de 4, 7 o 45 días.")
    key = f"sim-weather:v1:{parcel.pk}:{lat}:{lon}:{days}:{timezone.now().date().isoformat()}"
    retained = cache.get(key + ":retained")
    if not refresh:
        fresh = cache.get(key)
        if fresh:
            return {**fresh, "cached": True, "age_seconds": max(0, int(
                (timezone.now() - timezone.datetime.fromisoformat(fresh["fetched_at"])).total_seconds()))}
    try:
        result = _long(parcel) if days == 45 else _short(parcel, days)
    except WeatherUnavailable as exc:
        if retained:
            return {**retained, "cached": True, "stale": True,
                    "age_seconds": max(0, int((timezone.now() - timezone.datetime.fromisoformat(
                        retained["fetched_at"])).total_seconds())),
                    "notice": retained["notice"] + " Open-Meteo no respondió; se muestra caché anterior."}
        if days != 45:
            raise
        try:
            result = _historical(parcel)
            result["notice"] += f" EC46 no disponible ({exc}); no se infiere un pronóstico."
        except (ValueError, requests.RequestException) as error:
            raise WeatherUnavailable("No hay pronóstico EC46 ni referencia histórica NASA disponible.") from error
    cache.set(key, result, timeout=1800 if days != 45 else 21600)
    cache.set(key + ":retained", result, timeout=172800)
    return result
