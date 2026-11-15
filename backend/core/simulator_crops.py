"""Documented, species-specific references; absent parameters are intentionally None."""

UMN = "https://extension.umn.edu/vegetable-growing-guides-farmers/crop-and-field-planning-tools-vegetable-farmers"
OSU_RADISH = "https://extension.oregonstate.edu/imported-publication/radishes"
OSU_CILANTRO = "https://extension.oregonstate.edu/imported-publication/cilantro"
OSU_GREENS = "https://extension.oregonstate.edu/imported-publication/salad-greens"

CROPS = {
    "cilantro": {
        "name": "Cilantro", "scientific_name": "Coriandrum sativum", "harvest_type": "hojas",
        "variety": None, "indicative_days": None, "heat_alert_c": 26.7,
        "sources": [OSU_CILANTRO],
    },
    "rabano": {
        "name": "Rábano", "scientific_name": "Raphanus sativus", "harvest_type": "raíz",
        "variety": None, "indicative_days": [21, 42], "heat_alert_c": None,
        "sources": [OSU_RADISH],
    },
    "rucula": {
        "name": "Rúcula", "scientific_name": "Eruca sativa", "harvest_type": "hojas",
        "variety": None, "indicative_days": [25, 45], "heat_alert_c": None,
        "sources": [UMN],
    },
    "lechuga_hoja": {
        "name": "Lechuga de hoja tierna", "scientific_name": "Lactuca sativa", "harvest_type": "hojas tiernas",
        "variety": None, "indicative_days": None, "heat_alert_c": 26.7,
        "sources": [OSU_GREENS],
    },
    "espinaca": {
        "name": "Espinaca", "scientific_name": "Spinacia oleracea", "harvest_type": "hojas",
        "variety": None, "indicative_days": [30, 40], "heat_alert_c": None,
        "sources": [UMN],
    },
}

for crop in CROPS.values():
    crop.update({
        "development_temperature_c": None, "water_requirement_mm": None,
        "humidity_threshold_percent": None, "radiation_requirement_mj_m2": None,
        "thermal_time_model": None,
    })
