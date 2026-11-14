from django.db import migrations


# Ranges copied from the FAO Ecocrop data sheets on 2026-11-14:
# optimal temperature (°C), optimal ANNUAL rainfall (mm), crop cycle (days).
# These global ecological ranges are NOT validated agronomic advice for Ecuador.
ECOCROP = [
    ("Papa", "Solanum tuberosum", "Solanaceae", 1971, 15, 25, 500, 800, 90, 160),
    ("Quinua", "Chenopodium quinoa", "Amaranthaceae", 2509, 14, 18, 500, 1000, 90, 240),
    ("Cebada", "Hordeum vulgare", "Poaceae", 1232, 15, 20, 500, 1000, 90, 240),
    ("Haba", "Vicia faba", "Fabaceae", 2146, 18, 28, 650, 1000, 100, 150),
    ("Arveja", "Pisum sativum", "Fabaceae", 1721, 10, 24, 800, 1200, 60, 140),
    ("Maíz", "Zea mays", "Poaceae", 2175, 18, 33, 600, 1200, 65, 365),
    ("Trigo", "Triticum aestivum", "Poaceae", 2114, 15, 23, 750, 900, 90, 250),
    ("Avena", "Avena sativa", "Poaceae", 481, 16, 20, 600, 1000, 110, 270),
    ("Chocho", "Lupinus mutabilis", "Fabaceae", 7435, 18, 24, 500, 1000, 150, 330),
    ("Zanahoria", "Daucus carota", "Apiaceae", 871, 15, 24, 600, 1200, 40, 150),
    ("Cebolla", "Allium cepa", "Amaryllidaceae", 364, 12, 25, 350, 600, 85, 175),
    ("Repollo", "Brassica oleracea var. capitata", "Brassicaceae", 554, 15, 24, 500, 1000, 60, 200),
    ("Remolacha", "Beta vulgaris", "Amaranthaceae", 514, 15, 25, 600, 800, 160, 240),
    ("Lechuga", "Lactuca sativa", "Asteraceae", 1313, 12, 21, 1100, 1400, 35, 85),
    ("Rábano", "Raphanus sativus", "Brassicaceae", 1839, 12, 26, 1000, 1500, 50, 80),
]


def seed_ecocrop(apps, schema_editor):
    Crop = apps.get_model("core", "Crop")
    for name, scientific, family, fao_id, temp_min, temp_max, rain_min, rain_max, days_min, days_max in ECOCROP:
        Crop.objects.get_or_create(
            scientific_name=scientific, region="Sierra ecuatoriana", country_code="EC",
            defaults={
                "name": name, "family": family, "min_temp_c": temp_min, "max_temp_c": temp_max,
                "min_annual_rain_mm": rain_min, "max_annual_rain_mm": rain_max,
                "cycle_days": days_min, "max_cycle_days": days_max, "validated": True,
                "regional_validated": False,
                "source": f"https://ecocrop.apps.fao.org/ecocrop/srv/en/dataSheet?id={fao_id}",
                "soil_notes": "Consultar ficha FAO. Rangos generales; no sustituyen análisis de suelo local.",
                "rotation_notes": "Confirmar compatibilidad de la rotación con un agrónomo local.",
            },
        )


class Migration(migrations.Migration):
    dependencies = [("core", "0003_crop_max_annual_rain_mm_crop_max_cycle_days_and_more")]
    operations = [migrations.RunPython(seed_ecocrop, migrations.RunPython.noop)]
