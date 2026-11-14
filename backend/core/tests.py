from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Analysis, Crop, CropHistory, Parcel
from .services import PARAMETERS, monthly_summary, recommendations, validate_geometry

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
