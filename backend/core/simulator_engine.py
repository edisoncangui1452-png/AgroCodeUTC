"""Deterministic partial agronomic evaluation; no yield, survival or height model."""

from datetime import date, timedelta

from .simulator_crops import CROPS

STAGES = ("siembra", "germinacion", "emergencia", "crecimiento_inicial",
          "desarrollo_vegetativo", "desarrollo_avanzado", "posible_cosecha")


def evaluate(simulation, weather, simulated_at):
    """Weather is the trusted phase-2 contract, not a client-supplied series."""
    crop = CROPS[simulation.crop]
    planted = simulation.planted_on
    observed = simulation.observed_stage
    observed_on = simulation.observed_on
    if weather["information_type"] == "historical":
        rows = []
    else:
        rows = weather["rows"]
    results = []
    all_missing = set()
    for row in rows:
        start = date.fromisoformat(row["period_start"])
        end = date.fromisoformat(row["period_end"])
        if end < planted:
            continue
        values = row["values"]
        missing = list(row["missing"])
        all_missing.update(missing)
        heat = crop["heat_alert_c"]
        # A weekly average maximum cannot prove that any particular day exceeded a threshold.
        temp = values.get("temperature_max_c")
        heat_alert = heat is not None and temp is not None and temp > heat
        risks = []
        if heat_alert:
            risks.append({"code": "calor", "status": "posible", "evidence": "temperatura máxima diaria del modelo" if weather["resolution"] == "daily" else "promedio semanal de máximas del modelo",
                          "note": "Espigado posible; no demuestra daño ni pérdida."})
        soil_condition = simulation.observed_soil_condition if observed_on and observed_on <= end else ""
        if soil_condition in ("seco", "encharcado"):
            risks.append({"code": "falta_agua" if soil_condition == "seco" else "exceso_humedad",
                          "status": "observado_en_fecha" if start <= observed_on <= end else "antecedente_no_reconfirmado",
                          "evidence": "observación manual del suelo",
                          "note": "La observación no verifica el estado futuro; no equivale a enfermedad ni muerte."})
        stage = observed if observed and observed_on and observed_on <= end else ("siembra" if start <= planted <= end else None)
        stage_source = "observacion_confirmada" if stage == observed and observed and observed_on and observed_on <= end else (
            "fecha_de_siembra" if stage == "siembra" else "no_determinada")
        # The stage observation is a snapshot, not a claim that no transition occurred afterwards.
        if observed_on and start <= observed_on <= end and weather["resolution"] == "weekly" and stage_source == "observacion_confirmada":
            stage_source = "observacion_en_periodo_no_proyeccion"
        elif observed_on and end > observed_on and stage_source == "observacion_confirmada":
            stage_source = "ultima_observacion_no_reconfirmada"
        rain = values.get("precipitation_mm")
        results.append({
            "period_start": row["period_start"], "period_end": row["period_end"],
            "days_since_sowing": {"start": max(0, (start - planted).days), "end": (end - planted).days},
            "stage": stage, "stage_source": stage_source,
            "thermal": {"status": "sin_datos" if temp is None else "sin_umbral_validado" if heat is None else
                        "alerta_calor" if heat_alert else "sin_alerta_de_calor",
                        "temperature_max_c": temp, "alert_threshold_c": heat,
                        "not_evaluated": temp is None},
            "water": {"status": ("suelo_seco_observado" if soil_condition == "seco" else "encharcamiento_observado")
                      if soil_condition in ("seco", "encharcado") and start <= observed_on <= end else
                      "antecedente_no_reconfirmado" if soil_condition in ("seco", "encharcado") else "no_determinable",
                      "precipitation_mm": rain, "soil_moisture_model_percent": values.get("soil_moisture_model_percent"),
                      "note": "La lluvia y humedad superficial modelada no miden agua disponible en raíces."},
            "humidity": {"relative_humidity_air_percent": values.get("relative_humidity_air_percent"),
                         "status": "sin_umbral_validado"},
            "radiation": {"solar_radiation_mj_m2": values.get("solar_radiation_mj_m2"),
                          "status": "sin_umbral_validado"},
            "risks": risks, "missing": missing,
            "meteorological_uncertainty": row.get("uncertainty"),
            "basis": row.get("basis"),
            "partial_sowing_period": start < planted <= end,
            "visual_state": {"stage": stage, "risk_codes": [risk["code"] for risk in risks],
                             "rendering": "not_implemented"},
        })
    window = crop["indicative_days"]
    warnings = [
        "Sin modelo térmico validado por especie, variedad y localidad: no se calculan grados-día, altura ni avance automático.",
        "Sin análisis físico-químico no se estima fertilidad porcentual ni aptitud final.",
        "Sin mediciones de raíz, riego y suelo no se confirma déficit o exceso hídrico a partir de lluvia o humedad superficial.",
        "La densidad no permite inferir germinación, supervivencia ni plantas cosechables.",
    ]
    if weather["information_type"] == "historical":
        warnings.append("NASA POWER histórico no se usa para proyectar desarrollo futuro.")
    if window:
        warnings.append("La ventana orientativa procede de otra región/variedad; no confirma cosecha local.")
    if weather.get("stale"):
        warnings.append("Pronóstico meteorológico de caché anterior: revisar antigüedad.")
    if any(row["partial_sowing_period"] for row in results):
        warnings.append("La siembra cae dentro de una semana EC46: el clima agregado incluye días anteriores a la siembra y no se desagrega.")
    if all_missing:
        warnings.append("Variables sin dato: " + ", ".join(sorted(all_missing)) + ". Obtener observaciones de campo.")
    return {
        "simulation_id": simulation.pk, "parcel": simulation.parcel_id,
        "crop": {"id": simulation.crop, **crop}, "planted_on": planted.isoformat(),
        "simulated_at": simulated_at.isoformat(), "horizon_days": weather["days"],
        "weather": {key: weather.get(key) for key in ("information_type", "resolution", "source", "model", "fetched_at", "stale")},
        "quantity": {"input": simulation.quantity, "type": simulation.quantity_type,
                     "density_per_m2": simulation.quantity / simulation.area_m2,
                     "area_m2": simulation.area_m2,
                     "observed_plants": simulation.observed_plants,
                     "potentially_harvestable": None},
        "soil_fertility": {"status": "no_evaluada", "percent": None, "reason": "Sin análisis físico-químico del suelo."},
        "agroclimate": {"status": "evaluacion_parcial", "reason": "Variables meteorológicas de modelo, no mediciones en raíces."},
        "crop_suitability": {"status": "no_determinable", "reason": "Faltan variedad, fenología y validación local."},
        "initial_state": {"stage": observed or None, "observed_on": observed_on.isoformat() if observed_on else None,
                          "soil_condition": simulation.observed_soil_condition or None,
                          "source": "observacion_confirmada" if observed_on else "no_disponible"},
        "stage": results[-1]["stage"] if results else (observed or None),
        "qualitative_assessment": "Evaluación parcial; verificar etapa, agua en raíces y condiciones locales en campo.",
        "indicative_harvest_window": {
            "from": (planted + timedelta(days=window[0])).isoformat(),
            "to": (planted + timedelta(days=window[1])).isoformat(),
            "status": "referencia_externa_no_confirmada", "source": crop["sources"][0],
        } if window else None,
        "uncertainty": {"weather": "Dispersión EC46 por semana, no probabilidad calibrada" if weather["resolution"] == "weekly"
                        else "Pronóstico de modelo, sujeto a actualización" if results else "Referencia histórica, no pronóstico",
                        "crop_model": "No existe calibración local ni parámetros fenológicos validados."},
        "missing": sorted(all_missing), "warnings": warnings, "results": results,
        "visual_state": results[-1]["visual_state"] if results else {"stage": observed or None, "risk_codes": [], "rendering": "not_implemented"},
    }
