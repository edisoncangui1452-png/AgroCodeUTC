from datetime import timedelta
from unittest.mock import patch

import requests
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Parcel
from .simulator_weather import DAILY, SOIL_LONG, SOIL_SHORT, valid_coordinates


class SimulatorWeatherTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = get_user_model().objects.create_user("weather-owner", "owner@example.invalid", "test-password")
        self.other = get_user_model().objects.create_user("weather-other", "other@example.invalid", "test-password")
        self.parcel = Parcel.objects.create(
            owner=self.owner, name="Parcela meteorológica", country="EC",
            latitude=-1.665, longitude=-78.645, area_ha=1,
            geometry={"type": "Polygon", "coordinates": [[[-78.65, -1.67], [-78.64, -1.67],
                [-78.64, -1.66], [-78.65, -1.66], [-78.65, -1.67]]]},
        )
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def url(self, days):
        return f"/api/v1/parcels/{self.parcel.pk}/simulator-weather/?days={days}"

    def sample(self, days, seasonal=False):
        dates = [(timezone.now().date() + timedelta(days=i)).isoformat() for i in range(days)]
        daily = {"time": dates, **{key: [10 + i for i in range(days)] for key in DAILY}}
        units = dict.fromkeys(DAILY[:3], "°C") | {
            "precipitation_sum": "mm", "relative_humidity_2m_mean": "%",
            "shortwave_radiation_sum": "MJ/m²",
        }
        if seasonal:
            daily[SOIL_LONG] = [0.3] * days
            units[SOIL_LONG] = "m³/m³"
            daily["temperature_2m_mean_member01"] = [9] * days
            daily["temperature_2m_mean_member02"] = [13] * days
            daily["precipitation_sum_member01"] = [2] * days
            daily["precipitation_sum_member02"] = [4] * days
            return {"daily": daily, "daily_units": units}
        times = [f"{day}T{hour:02}:00" for day in dates for hour in range(24)]
        return {"daily": daily, "daily_units": units,
                "hourly": {"time": times, SOIL_SHORT: [0.2] * len(times)},
                "hourly_units": {SOIL_SHORT: "m³/m³"}}

    def mock_api(self, session_class, data):
        response = session_class.return_value.__enter__.return_value.get.return_value
        response.is_redirect = False
        response.json.return_value = data

    @patch("core.simulator_weather.requests.Session")
    def test_four_days_units_coordinates_dates_and_cache(self, session_class):
        self.mock_api(session_class, self.sample(4))
        first = self.client.get(self.url(4))
        second = self.client.get(self.url(4))
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(first.data["coordinates"], {"latitude": -1.665, "longitude": -78.645})
        self.assertEqual(first.data["information_type"], "forecast")
        self.assertEqual(first.data["variable_origin"]["soil_moisture_model_percent"], "model_soil_estimate")
        self.assertFalse(first.data["demonstration_scenario"])
        self.assertEqual(first.data["model"], "ECMWF IFS (Open-Meteo)")
        self.assertEqual(first.data["timezone"], "UTC")
        self.assertIsNone(first.data["issued_at"])
        self.assertEqual(first.data["valid_from"], timezone.now().date().isoformat())
        self.assertEqual(first.data["valid_to"], (timezone.now().date() + timedelta(days=3)).isoformat())
        self.assertEqual(first.data["rows"][0]["values"]["soil_moisture_model_percent"], 20)
        self.assertEqual(first.data["units"]["soil_moisture_model_percent"], "% volumétrico")
        self.assertEqual(first.data["rows"][0]["values"]["solar_radiation_mj_m2"], 10)
        self.assertFalse(first.data["cached"])
        self.assertTrue(second.data["cached"])
        self.assertGreaterEqual(second.data["age_seconds"], 0)
        self.assertEqual(session_class.return_value.__enter__.return_value.get.call_count, 1)
        kwargs = session_class.return_value.__enter__.return_value.get.call_args.kwargs
        self.assertEqual(kwargs["params"]["latitude"], -1.665)
        self.assertEqual(kwargs["params"]["forecast_days"], 4)
        self.assertEqual(kwargs["params"]["timezone"], "UTC")
        self.assertFalse(kwargs["allow_redirects"])

    @patch("core.simulator_weather.requests.Session")
    def test_seven_days_and_refresh(self, session_class):
        self.mock_api(session_class, self.sample(7))
        self.assertEqual(len(self.client.get(self.url(7)).data["rows"]), 7)
        refreshed = self.client.get(self.url(7) + "&refresh=1")
        self.assertEqual(refreshed.status_code, 200)
        self.assertFalse(refreshed.data["cached"])
        self.assertEqual(session_class.return_value.__enter__.return_value.get.call_count, 2)
        self.assertEqual(session_class.return_value.__enter__.return_value.get.call_args.kwargs["params"]["forecast_days"], 7)

    @patch("core.simulator_weather.requests.Session")
    def test_missing_values_and_wrong_units_are_not_zero(self, session_class):
        data = self.sample(4)
        data["daily"]["precipitation_sum"][0] = None
        data["daily"]["relative_humidity_2m_mean"][0] = float("nan")
        data["daily_units"]["shortwave_radiation_sum"] = "W/m²"
        del data["hourly_units"][SOIL_SHORT]
        self.mock_api(session_class, data)
        row = self.client.get(self.url(4)).data["rows"][0]
        for field in ("precipitation_mm", "relative_humidity_air_percent", "solar_radiation_mj_m2",
                      "soil_moisture_model_percent"):
            self.assertIsNone(row["values"][field])
            self.assertIn(field, row["missing"])

    @patch("core.simulator_weather.requests.Session")
    def test_45_day_ec46_is_weekly_with_member_envelopes(self, session_class):
        self.mock_api(session_class, self.sample(45, seasonal=True))
        result = self.client.get(self.url(45))
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["information_type"], "subseasonal_forecast")
        self.assertEqual(result.data["resolution"], "weekly")
        self.assertEqual(result.data["model"], "ECMWF EC46 (Open-Meteo)")
        self.assertEqual(len(result.data["rows"]), 7)
        first = result.data["rows"][0]
        self.assertEqual(first["values"]["precipitation_mm"], 21)
        self.assertEqual(first["values"]["temperature_mean_c"], 11)
        self.assertEqual(first["basis"]["precipitation_mm"], "ensemble_mean")
        self.assertEqual(first["basis"]["relative_humidity_air_percent"], "control_run")
        self.assertEqual(first["values"]["soil_moisture_model_percent"], 30)
        self.assertEqual(first["uncertainty"]["temperature_mean_c"]["min"], 9)
        self.assertEqual(first["uncertainty"]["temperature_mean_c"]["max"], 13)
        self.assertEqual(first["uncertainty"]["precipitation_mm"]["min"], 14)
        self.assertEqual(first["uncertainty"]["precipitation_mm"]["max"], 28)
        self.assertEqual(result.data["rows"][-1]["period_end"], (timezone.now().date() + timedelta(days=44)).isoformat())
        self.assertEqual(session_class.return_value.__enter__.return_value.get.call_args.kwargs["params"]["models"], "ecmwf_ec46")

    @patch("core.simulator_weather.requests.Session")
    def test_45_day_without_members_has_no_invented_uncertainty(self, session_class):
        data = self.sample(45, seasonal=True)
        data["daily"] = {key: value for key, value in data["daily"].items() if "_member" not in key}
        self.mock_api(session_class, data)
        result = self.client.get(self.url(45))
        self.assertEqual(result.status_code, 200)
        self.assertIsNone(result.data["rows"][0]["uncertainty"])
        self.assertEqual(result.data["rows"][0]["basis"]["temperature_mean_c"], "control_run")
        self.assertEqual(result.data["information_type"], "subseasonal_forecast")

    @patch("core.simulator_weather.requests.Session")
    def test_failure_serves_identified_stale_cache_then_503(self, session_class):
        self.mock_api(session_class, self.sample(4))
        self.client.get(self.url(4))
        session_class.return_value.__enter__.return_value.get.side_effect = requests.Timeout("sensitive details")
        stale = self.client.get(self.url(4) + "&refresh=1")
        self.assertEqual(stale.status_code, 200)
        self.assertTrue(stale.data["stale"])
        self.assertTrue(stale.data["cached"])
        self.assertIn("caché anterior", stale.data["notice"])
        self.parcel.latitude = -2
        self.parcel.save()
        failed = self.client.get(self.url(4))
        self.assertEqual(failed.status_code, 503)
        self.assertNotIn("sensitive details", str(failed.data))

    @patch("core.simulator_weather.get_historical_baseline")
    @patch("core.simulator_weather.requests.Session")
    def test_45_day_fallback_is_explicitly_historical(self, session_class, baseline):
        session_class.return_value.__enter__.return_value.get.side_effect = requests.Timeout()
        baseline.return_value = {
            "months": [{"month": i, "temperature_c": {"median": 14, "p10": 10, "p90": 18},
                        "rain_mm": {"median": 80, "p10": 40, "p90": 120}} for i in range(1, 13)],
            "fetched_at": timezone.now(), "period": [1983, 2025], "cached": True,
        }
        result = self.client.get(self.url(45))
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["information_type"], "historical")
        self.assertEqual(result.data["measurement_type"], "historical_model_estimate")
        self.assertEqual(result.data["source"], "NASA POWER")
        self.assertIsNone(result.data["issued_at"])
        self.assertIsNone(result.data["valid_from"])
        self.assertIsNone(result.data["rows"][0]["period_start"])
        self.assertIn("NO es un pronóstico", result.data["notice"])
        self.assertIsNone(result.data["rows"][0]["values"]["relative_humidity_air_percent"])
        self.assertEqual(result.data["rows"][0]["uncertainty"]["precipitation_mm"]["p10"], 40)
        baseline.assert_called_once()

    @patch("core.simulator_weather.get_historical_baseline", side_effect=requests.Timeout())
    @patch("core.simulator_weather.requests.Session")
    def test_45_day_without_forecast_or_history_is_unavailable(self, session_class, baseline):
        session_class.return_value.__enter__.return_value.get.side_effect = requests.Timeout()
        self.assertEqual(self.client.get(self.url(45)).status_code, 503)
        baseline.assert_called_once()

    @patch("core.simulator_weather.requests.Session")
    def test_invalid_dates_or_api_response_fail_safely(self, session_class):
        data = self.sample(4)
        data["daily"]["time"][0] = "2021-01-01"
        self.mock_api(session_class, data)
        self.assertEqual(self.client.get(self.url(4)).status_code, 503)
        data = self.sample(4)
        data["timezone"] = "America/Guayaquil"
        self.mock_api(session_class, data)
        self.assertEqual(self.client.get(self.url(4)).status_code, 503)
        self.mock_api(session_class, {"error": True, "reason": "sensitive provider message"})
        response = self.client.get(self.url(4))
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("sensitive provider message", str(response.data))

    @patch("core.simulator_weather.requests.Session")
    def test_coordinates_permissions_and_invalid_modes(self, session_class):
        for query in ("days=5", "days=x", "days=4&refresh=yes"):
            self.assertEqual(self.client.get(self.url(4).split("?")[0] + "?" + query).status_code, 400)
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(self.url(4)).status_code, 404)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get(self.url(4)).status_code, (401, 403))
        session_class.return_value.__enter__.return_value.get.assert_not_called()
        self.parcel.latitude = 200
        with self.assertRaisesRegex(ValueError, "coordenadas válidas"):
            valid_coordinates(self.parcel)
        self.client.force_authenticate(self.owner)
        self.parcel.save()
        self.assertEqual(self.client.get(self.url(4)).status_code, 400)
        session_class.return_value.__enter__.return_value.get.assert_not_called()

    @patch("core.simulator_weather.requests.Session")
    def test_coordinate_change_does_not_reuse_old_cached_forecast(self, session_class):
        self.mock_api(session_class, self.sample(4))
        self.client.get(self.url(4))
        self.parcel.latitude = -1.7
        self.parcel.save()
        second = self.client.get(self.url(4))
        self.assertEqual(second.status_code, 200)
        self.assertFalse(second.data["cached"])
        self.assertEqual(second.data["coordinates"]["latitude"], -1.7)
        self.assertEqual(session_class.return_value.__enter__.return_value.get.call_count, 2)
