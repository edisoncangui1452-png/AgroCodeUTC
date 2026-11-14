from unittest.mock import patch
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Analysis, ClimateQuery, Crop, CropHistory, Parcel
from .services import PARAMETERS, get_dashboard_metrics, get_historical_baseline, historical_baseline, monthly_summary, recommendations, summarize_dashboard_month, validate_geometry

POLYGON = {"type": "Polygon", "coordinates": [[[-78.65, -1.67], [-78.64, -1.67], [-78.64, -1.66], [-78.65, -1.66], [-78.65, -1.67]]]}


class ParcelTests(TestCase):
    def setUp(self):
        self.alice = get_user_model().objects.create_user("alice", "alice@example.com", "a-very-good-password")
        self.bob = get_user_model().objects.create_user("bob", "bob@example.com", "a-very-good-password")
        self.client = APIClient()
        self.client.force_authenticate(self.alice)
        self.parcel = Parcel.objects.create(
            owner=self.alice, name="Campo", country="EC", location="Sierra ecuatoriana",
            geometry=POLYGON, latitude=-1.665, longitude=-78.645, area_ha=100,
        )

    def test_polygon_area_and_internal_point(self):
        lat, lon, area = validate_geometry(POLYGON)
        self.assertGreater(area, 100)
        self.assertLess(area, 150)
        self.assertTrue(-1.67 < lat < -1.66)
        self.assertTrue(-78.65 < lon < -78.64)

    def test_self_intersection_rejected(self):
        polygon = {"type": "Polygon", "coordinates": [[[0, 0], [1, 1], [0, 1], [1, 0], [0, 0]]]}
        with self.assertRaises(ValueError):
            validate_geometry(polygon)

    def test_private_parcel_not_accessible(self):
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get(f"/api/v1/parcels/{self.parcel.pk}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/v1/parcels/{self.parcel.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/parcels/{self.parcel.pk}/climate/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/parcels/{self.parcel.pk}/dashboard-metrics/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/v1/parcels/{self.parcel.pk}/historical-baseline/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/v1/parcels/{self.parcel.pk}/ai-rotation-review/", {"crops": ["Papa"]}, format="json").status_code, 404)

    def test_monthly_baseline_uses_calendar_days_and_excludes_annual_aggregate(self):
        values = {
            "T2M": {}, "PRECTOTCORR": {}, "T2M_MIN": {},
        }
        for year in range(1983, 2026):
            for month in range(1, 13):
                key = f"{year}{month:02}"
                values["T2M"][key] = 10
                values["PRECTOTCORR"][key] = 2
                values["T2M_MIN"][key] = -1 if year < 2003 else 2
            values["T2M"][f"{year}13"] = 999
        result = historical_baseline(values)
        self.assertEqual(len(result), 12)
        self.assertEqual(result[0]["temperature_c"]["median"], 10)
        self.assertEqual(result[0]["rain_mm"]["median"], 62)
        self.assertEqual(result[1]["rain_mm"]["p10"], 56)
        self.assertEqual(result[1]["rain_mm"]["p90"], 58)
        self.assertEqual(result[0]["monthly_mean_min_below_zero_frequency_percent"], 47)
        values["PRECTOTCORR"] = {"198301": -999}
        self.assertIsNone(historical_baseline(values)[0]["rain_mm"])
        self.assertIsNone(historical_baseline({"T2M": {}, "PRECTOTCORR": {}, "T2M_MIN": {}})[0]["temperature_c"])

    @patch("core.services.requests.Session")
    def test_historical_baseline_endpoint_caches_by_location_and_protects_owner(self, session_class):
        values = {p: {f"{year}{month:02}": 1 for year in range(1983, 2026) for month in range(1, 13)}
                  for p in ("T2M", "PRECTOTCORR", "T2M_MIN")}
        session_class.return_value.__enter__.return_value.get.return_value.json.return_value = {
            "properties": {"parameter": values},
        }
        url = f"/api/v1/parcels/{self.parcel.pk}/historical-baseline/"
        first = self.client.get(url)
        second = self.client.get(url)
        self.assertEqual(first.status_code, 200, first.data)
        self.assertFalse(first.data["cached"])
        self.assertTrue(second.data["cached"])
        self.assertEqual(first.data["months"][0]["rain_mm"]["median"], 31)
        self.assertEqual(ClimateQuery.objects.filter(source="NASA POWER monthly point").count(), 1)
        session_class.return_value.__enter__.return_value.get.assert_called_once()
        self.parcel.latitude += 1
        self.parcel.save()
        self.assertFalse(self.client.get(url).data["cached"])
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_ai_requires_configuration_and_authentication(self):
        url = f"/api/v1/parcels/{self.parcel.pk}/ai-rotation-review/"
        self.assertEqual(self.client.post(url, {"crops": ["Papa"]}, format="json").status_code, 503)
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/v1/ai/status/").status_code, (401, 403))

    @override_settings(AGRO_AI_API_KEY="test-key", AGRO_AI_URL="https://example.org/v1/chat/completions", AGRO_AI_MODEL="test-model")
    @patch("core.views.requests.post")
    def test_ai_review_sends_only_crop_names_and_families(self, send):
        send.return_value.json.return_value = {"choices": [{"message": {"content": "Revisa las familias con un profesional."}}]}
        url = f"/api/v1/parcels/{self.parcel.pk}/ai-rotation-review/"
        self.assertEqual(self.client.post(url, {"crops": []}, format="json").status_code, 400)
        response = self.client.post(url, {"crops": ["Papa", "Haba"]}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        payload = send.call_args.kwargs["json"]
        self.assertNotIn(str(self.parcel.latitude), str(payload))
        self.assertNotIn(str(self.parcel.longitude), str(payload))
        self.assertIn("Papa", str(payload))
        self.assertEqual(send.call_args.kwargs["timeout"], (5, 25))

    def test_rotation_guidance_flags_repeated_families(self):
        url = f"/api/v1/parcels/{self.parcel.pk}/rotations/"
        strategies = [{"crops": ["Papa", "Papa", "Haba"]}, {"crops": ["Sin ficha"]}, {"crops": []}]
        response = self.client.post(url, {"strategies": strategies}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("Papa y Papa", response.data["strategies"][0]["guidance"][0])
        self.assertIn("Faltan fichas", response.data["strategies"][1]["guidance"][-1])

    def test_create_and_update_uses_server_area(self):
        payload = {"name": "Nueva", "country": "EC", "location": "Sierra ecuatoriana", "geometry": POLYGON, "area_ha": 999}
        response = self.client.post("/api/v1/parcels/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotEqual(response.data["area_ha"], 999)
        response = self.client.patch(f"/api/v1/parcels/{response.data['id']}/", {"name": "Otra"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)

    def test_history_cannot_link_foreign_parcel(self):
        self.client.force_authenticate(self.bob)
        response = self.client.post("/api/v1/history/", {"parcel": self.parcel.pk, "crop_name": "haba", "planted_on": "2025-03-01"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_monthly_missing_values_and_precipitation_sum(self):
        data = {name: {"20230101": 10, "20230102": -999} for name in PARAMETERS}
        monthly = monthly_summary(data, 2023, 2023)
        self.assertIsNone(monthly[0]["T2M"])
        data = {name: {f"202301{day:02}": 2 for day in range(1, 32)} for name in PARAMETERS}
        data["T2M_MAX"]["20230131"] = 9
        data["T2M_MIN"]["20230131"] = -4
        monthly = monthly_summary(data, 2023, 2023)
        self.assertEqual(monthly[0]["PRECTOTCORR"], 62)
        self.assertEqual(monthly[0]["T2M"], 2)
        self.assertEqual(monthly[0]["T2M_MAX"], 9)
        self.assertEqual(monthly[0]["T2M_MIN"], -4)
        del data["PRECTOTCORR"]["20230131"]
        self.assertIsNone(monthly_summary(data, 2023, 2023)[0]["PRECTOTCORR"])

    def test_dashboard_indicators_use_same_complete_month_and_distinct_sources(self):
        days = [f"202502{day:02}" for day in range(1, 29)]
        values = {
            "T2M": {key: 17.3 for key in days},
            "PRECTOTCORR": {key: 2 for key in days},
            "GWETTOP": {key: 0.38 for key in days},
            "T2M_MIN": {key: -1 if day < 4 else 2 for day, key in enumerate(days)},
        }
        result = summarize_dashboard_month(values, 2025, 2)
        self.assertEqual(result["temperature_c"], 17.3)
        self.assertEqual(result["precipitation_mm"], 56)
        self.assertEqual(result["soil_wetness_index_percent"], 38)
        self.assertEqual(result["observed_frost_percent"], 14)
        del values["PRECTOTCORR"][days[0]]
        values["GWETTOP"][days[1]] = -999
        result = summarize_dashboard_month(values, 2025, 2)
        self.assertIsNone(result["precipitation_mm"])
        self.assertEqual(result["soil_wetness_index_percent"], 38)
        values["GWETTOP"] = {}
        self.assertIsNone(summarize_dashboard_month(values, 2025, 2)["soil_wetness_index_percent"])

    @patch("core.views.get_dashboard_metrics")
    def test_dashboard_metrics_only_for_owned_parcel(self, metrics):
        metrics.return_value = {"period": "2025-02", "temperature_c": 17.3}
        response = self.client.get(f"/api/v1/parcels/{self.parcel.pk}/dashboard-metrics/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["period"], "2025-02")
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get(f"/api/v1/parcels/{self.parcel.pk}/dashboard-metrics/").status_code, 404)

    @patch("core.services.requests.Session")
    def test_dashboard_metrics_are_cached_without_inventing_values(self, session_class):
        last_day = timezone.now().date().replace(day=1) - timedelta(days=1)
        readings = {
            f"{last_day.year}{last_day.month:02}{day:02}": 0.4
            for day in range(1, last_day.day + 1)
        }
        session_class.return_value.__enter__.return_value.get.return_value.json.return_value = {
            "properties": {"parameter": {
                "GWETTOP": readings,
                "T2M": {key: 15 for key in readings},
                "T2M_MIN": {key: 2 for key in readings},
                "PRECTOTCORR": {key: 1 for key in readings},
            }},
        }
        first = get_dashboard_metrics(self.parcel)
        second = get_dashboard_metrics(self.parcel)
        self.assertFalse(first["cached"])
        self.assertTrue(second["cached"])
        self.assertEqual(first["soil_wetness_index_percent"], 40)
        self.assertEqual(first["precipitation_mm"], last_day.day)
        session_class.return_value.__enter__.return_value.get.assert_called_once()

    @patch("core.views.get_climate")
    def test_climate_saves_only_own_analysis(self, get_climate):
        get_climate.return_value = ({p: {} for p in PARAMETERS}, True, "2026-01-01T00:00:00Z")
        response = self.client.post(f"/api/v1/parcels/{self.parcel.pk}/climate/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Analysis.objects.filter(owner=self.alice).count(), 1)
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get("/api/v1/analyses/").data, [])

    def test_unsupported_region_not_recommended(self):
        self.parcel.longitude = -80.0
        months = [{"year": year, "month": n, "T2M": 15, "PRECTOTCORR": 50} for year in range(2023, 2026) for n in range(1, 13)]
        self.assertEqual(recommendations(self.parcel, months), [])

    def test_recommendations_check_all_months_of_growth(self):
        self.assertEqual(Crop.objects.filter(source__contains="ecocrop.apps.fao.org").count(), 15)
        months = [{"year": year, "month": n, "T2M": 18, "PRECTOTCORR": 50} for year in range(2023, 2026) for n in range(1, 13)]
        candidates = recommendations(self.parcel, months)
        lettuce = next(c for c in candidates if c["crop"] == "Lechuga")
        self.assertIn("2", lettuce["durations"])
        self.assertFalse(lettuce["regional_validated"])
        for row in months:
            if row["month"] == 2:
                row["T2M"] = 35
        lettuce = next(c for c in recommendations(self.parcel, months) if c["crop"] == "Lechuga")
        self.assertNotIn(1, [w["start_month"] for w in lettuce["durations"]["2"]])
        self.assertNotIn(2, [w["start_month"] for w in lettuce["durations"]["2"]])

    def test_history_and_analyses_filter_by_owned_parcel(self):
        other = Parcel.objects.create(owner=self.alice, name="Otra", country="EC", location="Sierra",
                                      geometry=POLYGON, latitude=-1.6, longitude=-78.6, area_ha=100)
        CropHistory.objects.create(parcel=self.parcel, crop_name="Papa", planted_on="2024-01-01")
        CropHistory.objects.create(parcel=other, crop_name="Haba", planted_on="2025-01-01")
        Analysis.objects.create(owner=self.alice, parcel=self.parcel, kind="climate", title="Clima", result={})
        Analysis.objects.create(owner=self.alice, parcel=other, kind="climate", title="Otro", result={})
        self.assertEqual(len(self.client.get(f"/api/v1/history/?parcel={self.parcel.pk}").data), 1)
        self.assertEqual(len(self.client.get(f"/api/v1/analyses/?parcel={self.parcel.pk}").data), 1)
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get(f"/api/v1/history/?parcel={self.parcel.pk}").data, [])

    def test_agronomic_profile_accepts_soil_choices_and_binary_irrigation(self):
        response = self.client.put(f"/api/v1/parcels/{self.parcel.pk}/profile/", {
            "soil_texture": "Franco arcillo-limoso", "irrigation": "Sí",
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotIn("water_availability", response.data)
        invalid = self.client.put(f"/api/v1/parcels/{self.parcel.pk}/profile/", {
            "soil_texture": "desconocido", "irrigation": "Tal vez",
        }, format="json")
        self.assertEqual(invalid.status_code, 400)


class AuthTests(TestCase):
    def test_registration_login_and_logout(self):
        client = APIClient(enforce_csrf_checks=True)
        token = client.get("/api/v1/auth/csrf/").data["csrfToken"]
        registration = client.post("/api/v1/auth/register/", {
            "first_name": "Ana", "email": "ana@example.com", "password": "strong-Sample-98"
        }, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(registration.status_code, 201, registration.data)
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 200)
        token = client.get("/api/v1/auth/csrf/").data["csrfToken"]
        self.assertEqual(client.post("/api/v1/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=token).status_code, 200)
        token = client.get("/api/v1/auth/csrf/").data["csrfToken"]
        self.assertEqual(client.post("/api/v1/auth/login/", {
            "email": "ana@example.com", "password": "strong-Sample-98"
        }, format="json", HTTP_X_CSRFTOKEN=token).status_code, 200)

    def test_registration_rejects_missing_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.get("/api/v1/auth/csrf/")
        response = client.post("/api/v1/auth/register/", {
            "first_name": "Ana", "email": "ana@example.com", "password": "strong-Sample-98"
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_changed_email_can_be_used_for_login(self):
        client = APIClient()
        client.post("/api/v1/auth/register/", {
            "first_name": "Ana", "email": "ana@example.com", "password": "strong-Sample-98"
        }, format="json")
        response = client.patch("/api/v1/auth/me/", {"email": "nueva@example.com"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        client.post("/api/v1/auth/logout/")
        self.assertEqual(client.post("/api/v1/auth/login/", {
            "email": "nueva@example.com", "password": "strong-Sample-98"
        }, format="json").status_code, 200)
