from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import CropSimulation, Parcel
from .simulator_crops import CROPS
from .simulator_engine import STAGES, evaluate


def weather(days=4, missing=False, historical=False):
    today = timezone.localdate()
    rows = []
    for i in range(0, days, 7 if days == 45 else 1):
        start = today + timedelta(days=i)
        end = today + timedelta(days=min(i + (6 if days == 45 else 0), days - 1))
        values = {
            "temperature_max_c": 30, "temperature_mean_c": 20,
            "precipitation_mm": 0, "soil_moisture_model_percent": None,
            "relative_humidity_air_percent": None if missing else 80,
            "solar_radiation_mj_m2": 14,
        }
        rows.append({
            "period_start": start.isoformat(), "period_end": end.isoformat(),
            "values": values, "missing": [key for key, value in values.items() if value is None],
            "uncertainty": {"precipitation_mm": {"min": 0, "max": 20, "members": 50}} if days == 45 else None,
            "basis": {"precipitation_mm": "ensemble_mean"} if days == 45 else None,
        })
    return {"days": days, "information_type": "historical" if historical else
            "subseasonal_forecast" if days == 45 else "forecast",
            "resolution": "historical_month" if historical else "weekly" if days == 45 else "daily",
            "source": "NASA POWER" if historical else "Open-Meteo", "model": "test",
            "fetched_at": "2026-01-01T00:00:00+00:00", "stale": False, "rows": rows}


class SimulationTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("engine-owner", "engine@example.invalid", "password")
        self.other = get_user_model().objects.create_user("engine-other", "other@example.invalid", "password")
        self.parcel = Parcel.objects.create(
            owner=self.user, name="Engine", geometry={"type": "Polygon", "coordinates": [[
                [-78.65, -1.67], [-78.64, -1.67], [-78.64, -1.66], [-78.65, -1.66], [-78.65, -1.67]]]},
            latitude=-1.665, longitude=-78.645, area_ha=1)
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.payload = {"parcel": self.parcel.pk, "crop": "cilantro",
                        "planted_on": (timezone.localdate() - timedelta(days=2)).isoformat(),
                        "quantity": 100, "quantity_type": "seeds", "area_m2": 25, "days": 4}

    def create(self, **updates):
        response = self.client.post("/api/v1/simulations/", {**self.payload, **updates}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    @patch("core.views.get_simulator_weather")
    def test_five_species_and_sources(self, get_weather):
        get_weather.return_value = weather()
        self.assertEqual(len(CROPS), 5)
        for key, profile in CROPS.items():
            self.assertIsNone(profile["thermal_time_model"])
            self.assertIsNone(profile["water_requirement_mm"])
            self.assertTrue(profile["sources"])
            saved = self.create(crop=key)
            result = self.client.get(f"/api/v1/simulations/{saved['id']}/evaluate/")
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.data["crop"]["id"], key)
            self.assertEqual(result.data["quantity"]["density_per_m2"], 4)
            self.assertIsNone(result.data["quantity"]["potentially_harvestable"])
            self.assertEqual(len(result.data["results"]), 4)
            self.assertEqual(result.data["stage"], None)
            self.assertEqual(result.data["results"][0]["visual_state"]["rendering"], "not_implemented")
            self.assertEqual(bool(result.data["indicative_harvest_window"]), profile["indicative_days"] is not None)

    def test_invalid_inputs_and_limits(self):
        for changes in (
            {"crop": "zanahoria"}, {"quantity": 0}, {"quantity": -1},
            {"quantity": 2.5}, {"quantity_type": "unknown"}, {"area_m2": 0},
            {"area_m2": 10001}, {"days": 8},
            {"planted_on": (timezone.localdate() + timedelta(days=1)).isoformat()},
            {"observed_stage": "emergencia"},
            {"observed_on": (timezone.localdate() - timedelta(days=3)).isoformat(), "observed_stage": "emergencia"},
            {"observed_plants": 101, "observed_on": timezone.localdate().isoformat()},
        ):
            self.assertEqual(self.client.post("/api/v1/simulations/", {**self.payload, **changes}, format="json").status_code, 400, changes)
        self.assertEqual(CropSimulation.objects.count(), 0)

    @patch("core.views.get_simulator_weather")
    def test_observation_persists_after_refresh_and_is_not_forecast(self, get_weather):
        saved = self.create()
        url = f"/api/v1/simulations/{saved['id']}/"
        updated = self.client.patch(url, {
            "observed_on": timezone.localdate().isoformat(), "observed_stage": "emergencia",
            "observed_soil_condition": "seco", "observed_plants": 64,
        }, format="json")
        self.assertEqual(updated.status_code, 200, updated.data)
        get_weather.return_value = weather()
        first = self.client.get(url + "evaluate/").data
        second = self.client.get(url + "evaluate/?refresh=1").data
        self.assertEqual(first["planted_on"], second["planted_on"])
        self.assertEqual(first["initial_state"], second["initial_state"])
        self.assertEqual(second["initial_state"]["source"], "observacion_confirmada")
        self.assertEqual(second["quantity"]["observed_plants"], 64)
        self.assertEqual(second["results"][0]["stage_source"], "observacion_confirmada")
        self.assertEqual(second["results"][1]["stage_source"], "ultima_observacion_no_reconfirmada")
        self.assertIn("falta_agua", [risk["code"] for risk in second["results"][0]["risks"]])
        self.assertTrue(get_weather.call_args.kwargs["refresh"])
        self.assertEqual(CropSimulation.objects.get(pk=saved["id"]).planted_on.isoformat(), self.payload["planted_on"])
        self.assertEqual(self.client.patch(url, {"planted_on": timezone.localdate().isoformat()}, format="json").status_code, 400)

    @patch("core.views.get_simulator_weather")
    def test_heat_dry_wet_and_missing_without_fake_fertility_or_disease(self, get_weather):
        get_weather.return_value = weather(missing=True)
        saved = self.create(observed_on=timezone.localdate().isoformat(), observed_soil_condition="encharcado")
        result = self.client.get(f"/api/v1/simulations/{saved['id']}/evaluate/").data
        codes = [risk["code"] for risk in result["results"][0]["risks"]]
        self.assertEqual(codes, ["calor", "exceso_humedad"])
        self.assertEqual(result["results"][0]["water"]["status"], "encharcamiento_observado")
        self.assertEqual(result["results"][1]["water"]["status"], "antecedente_no_reconfirmado")
        self.assertIn("relative_humidity_air_percent", result["missing"])
        self.assertNotIn("fertility_percent", str(result))
        self.assertNotIn("disease", str(result))
        get_weather.return_value["rows"][0]["values"]["temperature_max_c"] = 26.7
        self.assertFalse(any(r["code"] == "calor" for r in self.client.get(f"/api/v1/simulations/{saved['id']}/evaluate/").data["results"][0]["risks"]))
        get_weather.return_value["rows"][0]["values"]["temperature_max_c"] = None
        self.assertEqual(self.client.get(f"/api/v1/simulations/{saved['id']}/evaluate/").data["results"][0]["thermal"]["status"], "sin_datos")

    @patch("core.views.get_simulator_weather")
    def test_daily_weekly_and_historical_distinction(self, get_weather):
        for days, length, resolution in ((4, 4, "daily"), (7, 7, "daily"), (45, 7, "weekly")):
            get_weather.return_value = weather(days)
            saved = self.create(days=days)
            result = self.client.get(f"/api/v1/simulations/{saved['id']}/evaluate/").data
            self.assertEqual(len(result["results"]), length)
            self.assertEqual(result["weather"]["resolution"], resolution)
            if days == 45:
                self.assertEqual(result["results"][0]["meteorological_uncertainty"]["precipitation_mm"]["members"], 50)
                self.assertEqual(result["results"][-1]["days_since_sowing"]["end"], 46)
                self.assertEqual(result["soil_fertility"]["percent"], None)
                self.assertEqual(result["crop_suitability"]["status"], "no_determinable")
        get_weather.return_value = weather(45, historical=True)
        historical = self.client.get(f"/api/v1/simulations/{saved['id']}/evaluate/").data
        self.assertEqual(historical["results"], [])
        self.assertIn("no se usa", str(historical["warnings"]))

    def test_deterministic_engine_with_fixed_time(self):
        saved = self.create(crop="rabano", quantity_type="established_plants")
        instance = CropSimulation.objects.get(pk=saved["id"])
        stamp = timezone.now()
        first = evaluate(instance, weather(), stamp)
        self.assertEqual(first, evaluate(instance, weather(), stamp))
        self.assertEqual(first["quantity"]["density_per_m2"], 4)
        self.assertEqual(first["indicative_harvest_window"]["status"], "referencia_externa_no_confirmada")
        self.assertEqual(first["indicative_harvest_window"]["from"], (instance.planted_on + timedelta(days=21)).isoformat())
        self.assertEqual(len(STAGES), 7)

    def test_sparse_density_is_not_rounded_to_zero(self):
        self.parcel.area_ha = 100
        self.parcel.save(update_fields=["area_ha"])
        saved = self.create(quantity=1, area_m2=1000000)
        instance = CropSimulation.objects.get(pk=saved["id"])
        self.assertEqual(evaluate(instance, weather(), timezone.now())["quantity"]["density_per_m2"], 0.000001)

    @patch("core.views.get_simulator_weather")
    def test_owner_scope_and_no_weather_leak(self, get_weather):
        saved = self.create()
        self.client.force_authenticate(self.other)
        for method, url in (
            ("get", f"/api/v1/simulations/{saved['id']}/evaluate/"),
            ("get", f"/api/v1/simulations/{saved['id']}/"),
            ("patch", f"/api/v1/simulations/{saved['id']}/"),
        ):
            response = getattr(self.client, method)(url)
            self.assertEqual(response.status_code, 404)
        response = self.client.post("/api/v1/simulations/", self.payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get("/api/v1/simulations/").data, [])
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(f"/api/v1/simulations/{saved['id']}/evaluate/").status_code, (401, 403))
        get_weather.assert_not_called()

    def test_invalid_parcel_filter_is_400(self):
        self.assertEqual(self.client.get("/api/v1/simulations/?parcel=oops").status_code, 400)

    def test_week_crossing_sowing_is_partial_not_daily(self):
        saved = self.create(planted_on=timezone.localdate().isoformat(), days=45)
        instance = CropSimulation.objects.get(pk=saved["id"])
        forecast = weather(45)
        forecast["rows"][0]["period_start"] = (instance.planted_on - timedelta(days=3)).isoformat()
        result = evaluate(instance, forecast, timezone.now())
        self.assertTrue(result["results"][0]["partial_sowing_period"])
        self.assertEqual(result["results"][0]["days_since_sowing"]["start"], 0)
        self.assertIn("no se desagrega", str(result["warnings"]))

    def test_weekly_observation_does_not_confirm_entire_future_week(self):
        saved = self.create(days=45, observed_on=timezone.localdate().isoformat(),
                            observed_stage="emergencia", observed_soil_condition="seco")
        instance = CropSimulation.objects.get(pk=saved["id"])
        result = evaluate(instance, weather(45), timezone.now())
        self.assertEqual(result["results"][0]["stage_source"], "observacion_en_periodo_no_proyeccion")
        self.assertEqual(result["results"][1]["stage_source"], "ultima_observacion_no_reconfirmada")
        self.assertEqual(next(r for r in result["results"][1]["risks"] if r["code"] == "falta_agua")["status"],
                         "antecedente_no_reconfirmado")
