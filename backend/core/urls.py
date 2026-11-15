from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register("parcels", views.ParcelViewSet, basename="parcel")
router.register("simulations", views.SimulationViewSet, basename="simulation")
router.register("history", views.HistoryViewSet, basename="history")
router.register("analyses", views.AnalysisViewSet, basename="analysis")
router.register("crops", views.CropViewSet, basename="crop")
router.register("agronomists", views.AgronomistViewSet, basename="agronomist")

urlpatterns = [
    path("auth/csrf/", views.csrf),
    path("auth/register/", views.register),
    path("auth/login/", views.sign_in),
    path("auth/logout/", views.sign_out),
    path("auth/me/", views.me),
    path("auth/change-password/", views.change_password),
    path("auth/password-reset/", views.password_reset),
    path("auth/password-reset/confirm/", views.password_reset_confirm),
    path("geocode/", views.geocode),
    path("geocode/reverse/", views.reverse_geocode),
    path("ai/status/", views.ai_status),
    path("", include(router.urls)),
]
