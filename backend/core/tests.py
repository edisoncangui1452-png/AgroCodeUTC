from unittest.mock import patch
from datetime import timedelta

import json
import requests
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import AgronomicProfile, Analysis, ClimateQuery, Crop, CropHistory, Parcel
from .ollama import OllamaUnavailable, SYSTEM_PROMPT, check_model, final_review, review_strategy
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

    @patch("core.views.check_model", side_effect=OllamaUnavailable("Ollama no está ejecutándose."))
    def test_ai_requires_local_service_and_authentication(self, check):
        url = f"/api/v1/parcels/{self.parcel.pk}/ai-rotation-review/"
        self.assertEqual(self.client.get("/api/v1/ai/status/").data["configured"], False)
        check.assert_called_once()
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get("/api/v1/ai/status/").status_code, (401, 403))
        self.assertIn(self.client.post(url, {"crops": ["Papa"]}, format="json").status_code, (401, 403))

    @override_settings(OLLAMA_MODEL="qwen3:4b")
    @patch("core.views.check_model", return_value=True)
    def test_ai_status_is_available_without_api_key(self, check):
        response = self.client.get("/api/v1/ai/status/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"configured": True, "model": "qwen3:4b"})
        check.assert_called_once()

    @override_settings(OLLAMA_MODEL="qwen3:4b")
    @patch("core.views.review_strategy", return_value="Revisa las familias con un profesional.")
    def test_ai_review_sends_only_crop_names_and_families(self, review):
        url = f"/api/v1/parcels/{self.parcel.pk}/ai-rotation-review/"
        self.assertEqual(self.client.post(url, {"crops": []}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"crops": ["  "]}, format="json").status_code, 400)
        self.assertEqual(self.client.post(url, {"crops": ["Papa"], "strategy_name": "invento"}, format="json").status_code, 400)
        AgronomicProfile.objects.create(parcel=self.parcel, soil_texture="Franco", irrigation="Sí", notes="dato privado")
        response = self.client.post(url, {"crops": ["Papa", "Haba"], "strategy_name": "Estrategia B"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(set(response.data), {"review", "model", "notice"})
        self.assertEqual(response.data["review"], "Revisa las familias con un profesional.")
        self.assertEqual(response.data["model"], "qwen3:4b")
        payload = review.call_args.args[0]
        self.assertNotIn(str(self.parcel.latitude), str(payload))
        self.assertNotIn(str(self.parcel.longitude), str(payload))
        self.assertNotIn("dato privado", str(payload))
        self.assertNotIn("Campo", str(payload))
        self.assertIn("Papa", str(payload))
        self.assertEqual(payload["strategy"], "Estrategia B")
        self.assertEqual(payload["parcel_context"]["soil_texture"], "Franco")
        self.assertEqual(payload["parcel_context"]["irrigation"], "Sí")
        self.assertEqual(payload["plants"][0]["family"], Crop.objects.get(name="Papa").family)

    @patch("core.views.review_strategy", side_effect=OllamaUnavailable("Ollama no responde."))
    def test_ai_review_fails_clearly_without_disclosing_parcel(self, review):
        response = self.client.post(f"/api/v1/parcels/{self.parcel.pk}/ai-rotation-review/", {"crops": ["Papa"]}, format="json")
        self.assertEqual(response.status_code, 503)
        self.assertIn("Ollama no responde", response.data["detail"])

    def test_rotation_guidance_flags_repeated_families(self):
        url = f"/api/v1/parcels/{self.parcel.pk}/rotations/"
        strategies = [{"crops": ["Papa", "Papa", "Haba"]}, {"crops": ["Sin ficha"]}, {"crops": []}]
        response = self.client.post(url, {"strategies": strategies}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIn("Papa y Papa", response.data["strategies"][0]["guidance"][0])
        self.assertIn("Faltan fichas", " ".join(response.data["strategies"][1]["guidance"]))

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

    def test_daily_coverage_counts_missing_ranges_and_fill_values(self):
        data = {name: {} for name in PARAMETERS}
        data["T2M"] = {"20230101": 12, "20230102": -999, "20230104": 14}
        coverage = daily_coverage(data, 2023, 2023)
        self.assertEqual(coverage["T2M"]["valid_days"], 2)
        self.assertEqual(coverage["T2M"]["missing_days"], 363)
        self.assertEqual(coverage["T2M"]["missing_ranges"][0], {
            "start": "2023-01-02", "end": "2023-01-03", "days": 2,
        })
        self.assertEqual(coverage["T2M"]["coverage_percent"], 0.55)
        self.assertFalse(coverage["T2M"]["complete"])
        self.assertEqual(coverage["T2M"]["first_valid_date"], "2023-01-01")
        self.assertEqual(coverage["T2M"]["last_valid_date"], "2023-01-04")
        self.assertEqual(coverage["PRECTOTCORR"]["total_days"], 365)

    @patch("core.views.get_climate")
    def test_climate_saves_only_own_analysis(self, get_climate):
        get_climate.return_value = ({p: {} for p in PARAMETERS}, True, "2026-01-01T00:00:00Z")
        response = self.client.post(f"/api/v1/parcels/{self.parcel.pk}/climate/", {}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(Analysis.objects.filter(owner=self.alice).count(), 1)
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get("/api/v1/analyses/").data, [])

    @patch("core.views.get_climate")
    def test_climate_report_contract_has_coverage_without_user_or_parcel_ids(self, get_climate):
        get_climate.return_value = ({p: {"20230101": 1} for p in PARAMETERS}, True, "2026-01-01T00:00:00Z")
        response = self.client.get(f"/api/v1/parcels/{self.parcel.pk}/climate/", {"start_year": 2023, "end_year": 2023})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["period"], {"start": "2023-01-01", "end": "2023-12-31"})
        self.assertTrue(response.data["queried_at"])
        self.assertEqual(response.data["coverage"]["T2M"]["valid_days"], 1)
        self.assertEqual(response.data["coverage"]["T2M"]["first_valid_date"], "2023-01-01")
        self.assertEqual(response.data["coverage"]["T2M"]["last_valid_date"], "2023-01-01")
        self.assertFalse(response.data["coverage"]["T2M"]["complete"])
        self.assertNotIn("parcel", response.data)
        self.assertNotIn("owner", response.data)
        self.assertNotIn("email", response.data)

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

    def test_arveja_has_one_record_and_one_primary_duration(self):
        self.assertEqual(Crop.objects.filter(name="Arveja").count(), 1)
        monthly = [{"year": year, "month": month, "T2M": 18, "PRECTOTCORR": 75}
                   for year in (2023, 2024, 2025) for month in range(1, 13)]
        items = recommendations(self.parcel, monthly)
        pea = next(item for item in items if item["crop"] == "Arveja")
        self.assertEqual(set(pea["durations"]), {"2", "3"})
        self.assertEqual(pea["primary_duration"], 3)
        self.assertEqual((pea["cycle_days"], pea["max_cycle_days"]), (60, 140))
        self.assertEqual(sum(item["id"] == pea["id"] for item in items), 1)

    def test_partial_annual_rain_is_not_presented_as_fully_suitable(self):
        monthly = [{"year": year, "month": month, "T2M": 18,
                    "PRECTOTCORR": 70 if year == 2023 else 40}
                   for year in (2023, 2024, 2025) for month in range(1, 13)]
        pea = next(item for item in recommendations(self.parcel, monthly) if item["crop"] == "Arveja")
        self.assertEqual(pea["rain_status"], "compatibilidad_parcial")
        self.assertEqual(pea["rain_optimal_years"], 1)
        self.assertIn("1/3 años", pea["rain_context"])

    def test_rotation_considers_previous_crop_family_and_missing_water_data(self):
        CropHistory.objects.create(parcel=self.parcel, crop_name="Arveja", planted_on="2025-02-01")
        result = self.client.post(f"/api/v1/parcels/{self.parcel.pk}/rotations/", {
            "strategies": [{"crops": ["Haba", "Papa"]}, {"crops": ["Arveja"]}, {"crops": []}],
        }, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        first = " ".join(result.data["strategies"][0]["guidance"])
        second = " ".join(result.data["strategies"][1]["guidance"])
        self.assertIn("comparte familia con el anterior", first)
        self.assertIn("mismo cultivo anterior", second)
        self.assertIn("Sin información de riego", first)
        self.assertIn("Sin análisis de fertilidad", first)
        self.assertIn("No hay clima diario histórico", first)

    def test_rotation_uses_only_cached_complete_climate_for_annual_rain(self):
        ClimateQuery.objects.create(
            parcel=self.parcel, latitude=self.parcel.latitude, longitude=self.parcel.longitude,
            start_year=2023, end_year=2023, source="NASA POWER daily point",
            payload={name: {} for name in PARAMETERS},
        )
        # An incomplete daily series cannot become an annual rainfall comparison.
        result = self.client.post(f"/api/v1/parcels/{self.parcel.pk}/rotations/", {
            "strategies": [{"crops": ["Arveja"]}, {"crops": []}, {"crops": []}],
        }, format="json")
        self.assertEqual(result.status_code, 200, result.data)
        text = " ".join(result.data["strategies"][0]["guidance"])
        self.assertIn("sin mes de siembra", text)
        self.assertIn("No hay años completos", text)

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


@override_settings(OLLAMA_BASE_URL="http://127.0.0.1:11434", OLLAMA_MODEL="qwen3:4b")
class OllamaTests(TestCase):
    @patch("core.ollama.requests.Session")
    def test_model_is_available_and_status_is_preserved(self, session_class):
        session = session_class.return_value.__enter__.return_value
        session.request.return_value.is_redirect = False
        session.request.return_value.json.return_value = {"models": [{"name": "qwen3:4b"}]}
        self.assertTrue(check_model())
        self.assertEqual(session.request.call_args.args, ("GET", "http://127.0.0.1:11434/api/tags"))
        self.assertEqual(session.request.call_args.kwargs["timeout"], (3, 5))
        self.assertFalse(session.request.call_args.kwargs["allow_redirects"])
        self.assertFalse(session.trust_env)

    @patch("core.ollama.requests.Session")
    def test_qwen_receives_structured_strategy_and_returns_text(self, session_class):
        session = session_class.return_value.__enter__.return_value
        session.request.side_effect = [
            type("Reply", (), {"is_redirect": False, "raise_for_status": lambda self: None,
                               "json": lambda self: {"models": [{"name": "qwen3:4b"}]}})(),
            type("Reply", (), {"is_redirect": False, "raise_for_status": lambda self: None,
                               "json": lambda self: {"message": {"content": "  Revisión local en español.  "}}})(),
        ]
        context = {"strategy": "Estrategia A", "plants": [{"crop": "Papa", "family": "Solanaceae"}]}
        self.assertEqual(review_strategy(context), "Revisión local en español.")
        method, url = session.request.call_args.args
        self.assertEqual((method, url), ("POST", "http://127.0.0.1:11434/api/chat"))
        payload = session.request.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "qwen3:4b")
        self.assertFalse(payload["stream"])
        self.assertFalse(payload["think"])
        self.assertEqual(session.request.call_args.kwargs["timeout"], (3, 240))
        self.assertEqual(json.loads(payload["messages"][1]["content"].split("JSON):\n")[1].split("\n/no_think")[0]), context)
        self.assertIn("español de Ecuador", payload["messages"][0]["content"])
        self.assertIn("60 a 100 palabras", payload["messages"][0]["content"])
        self.assertNotIn("Authorization", str(session.request.call_args.kwargs))

    @patch("core.ollama.requests.Session")
    def test_connection_error_and_timeout_are_clear(self, session_class):
        session = session_class.return_value.__enter__.return_value
        for error in (requests.ConnectionError("secret host"), requests.Timeout("secret host")):
            session.request.side_effect = error
            with self.assertRaisesRegex(OllamaUnavailable, "Ollama no está ejecutándose"):
                check_model()

    @patch("core.ollama.requests.Session")
    def test_missing_model_and_malformed_response_are_clear(self, session_class):
        session = session_class.return_value.__enter__.return_value
        session.request.return_value.is_redirect = False
        session.request.return_value.json.return_value = {"models": [{"name": "llama3:8b"}]}
        with self.assertRaisesRegex(OllamaUnavailable, "ollama pull qwen3:4b"):
            check_model()
        session.request.return_value.json.return_value = {"models": None}
        with self.assertRaisesRegex(OllamaUnavailable, "lista de modelos inválida"):
            check_model()

    @patch("core.ollama.requests.Session")
    def test_empty_generation_is_not_returned_as_success(self, session_class):
        session = session_class.return_value.__enter__.return_value
        session.request.side_effect = [
            type("Reply", (), {"is_redirect": False, "raise_for_status": lambda self: None,
                               "json": lambda self: {"models": [{"name": "qwen3:4b"}]}})(),
            type("Reply", (), {"is_redirect": False, "raise_for_status": lambda self: None,
                               "json": lambda self: {"message": {"content": ""}}})(),
        ]
        with self.assertRaisesRegex(OllamaUnavailable, "no devolvió texto"):
            review_strategy({"plants": []})

    @override_settings(OLLAMA_BASE_URL="https://api.example.org")
    @patch("core.ollama.requests.Session")
    def test_external_url_is_rejected_without_request(self, session_class):
        with self.assertRaisesRegex(OllamaUnavailable, "HTTP local"):
            check_model()
        session_class.return_value.__enter__.return_value.request.assert_not_called()

    @patch("core.ollama.requests.Session")
    def test_local_redirect_is_blocked(self, session_class):
        session_class.return_value.__enter__.return_value.request.return_value.is_redirect = True
        with self.assertRaisesRegex(OllamaUnavailable, "redirigir"):
            check_model()

    def test_prompt_is_clear_formal_and_accounts_for_missing_data(self):
        for term in ("de usted", "60 a 100 palabras", "término técnico", "prueba de suelo",
                     "humedad", "no es una medición", "Evaluación", "Recomendación", "Motivo",
                     "no son pronósticos"):
            self.assertIn(term, SYSTEM_PROMPT)

    def test_final_answer_does_not_display_english_thinking_or_truncate(self):
        answer = "Evaluación: Falta información sobre el riego. Recomendación: compruebe el agua disponible."
        self.assertEqual(final_review({"message": {"content": "<think>Thinking in English</think>\n" + answer}}), answer)
        with self.assertRaisesRegex(OllamaUnavailable, "español"):
            final_review({"message": {"content": "Okay, the user should check the soil and water."}})
        with self.assertRaisesRegex(OllamaUnavailable, "español"):
            final_review({"message": {"content": "El usuario quiere rotar cultivos. Debo responder en español."}})
        with self.assertRaisesRegex(OllamaUnavailable, "español"):
            final_review({"message": {"content": answer}, "done_reason": "length"})
        with self.assertRaisesRegex(OllamaUnavailable, "razonamiento"):
            final_review({"message": {"content": "<think>incomplete"}})


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
