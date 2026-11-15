import requests
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.utils.encoding import force_str
from django.utils import timezone
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.conf import settings
from django.core.cache import cache
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.views.decorators.csrf import csrf_protect
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import AgronomicProfile, Agronomist, Analysis, Crop, CropHistory, CropSimulation, Parcel
from .agronomy import cached_rotation_months, rotation_guidance
from .ollama import OllamaUnavailable, check_model, review_strategy
from .simulator_weather import WeatherUnavailable, get_simulator_weather
from .simulator_engine import evaluate
from django.utils import timezone
from .serializers import (
    AgronomistSerializer, AnalysisSerializer, CropSerializer, HistorySerializer,
    ParcelSerializer, ProfileSerializer, RegisterSerializer, SimulationSerializer, UserSerializer,
)
from .services import UNITS, available_years, daily_coverage, get_climate, historical_scenario, monthly_summary, recommendations

User = get_user_model()


class SimulationViewSet(viewsets.ModelViewSet):
    serializer_class = SimulationSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        queryset = CropSimulation.objects.filter(owner=self.request.user).select_related("parcel")
        parcel_id = self.request.query_params.get("parcel")
        if parcel_id:
            if not parcel_id.isdecimal():
                raise ValidationError({"parcel": "Identificador inválido."})
            queryset = queryset.filter(parcel_id=parcel_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"])
    def evaluate(self, request, pk=None):
        simulation = self.get_object()
        refresh = request.query_params.get("refresh", "0")
        if refresh not in ("0", "1"):
            raise ValidationError({"refresh": "Use 0 o 1."})
        try:
            weather = get_simulator_weather(simulation.parcel, simulation.days, refresh=refresh == "1")
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        except WeatherUnavailable as exc:
            return Response({"detail": str(exc)}, status=503, headers={"Cache-Control": "private, no-store"})
        return Response(evaluate(simulation, weather, timezone.now()),
                        headers={"Cache-Control": "private, no-store"})


@api_view(["GET"])
@permission_classes([AllowAny])
def csrf(request):
    return Response({"csrfToken": get_token(request)})


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def sign_in(request):
    user = authenticate(request, username=str(request.data.get("email", "")).lower(), password=request.data.get("password", ""))
    if user is None:
        return Response({"detail": "Credenciales incorrectas."}, status=400)
    login(request, user)
    return Response(UserSerializer(user).data)


@api_view(["POST"])
def sign_out(request):
    logout(request)
    return Response({"detail": "Sesión cerrada."})


@api_view(["GET", "PATCH"])
def me(request):
    if request.method == "PATCH":
        if "first_name" in request.data:
            request.user.first_name = str(request.data["first_name"]).strip()[:150]
        if "email" in request.data:
            email = str(request.data["email"]).strip().lower()
            try:
                validate_email(email)
            except DjangoValidationError:
                raise ValidationError({"email": "Introduce un correo válido."})
            if User.objects.filter(email__iexact=email).exclude(pk=request.user.pk).exists():
                raise ValidationError({"email": "El correo ya está registrado."})
            request.user.email = email
            request.user.username = email
        request.user.save()
    return Response(UserSerializer(request.user).data)


@api_view(["POST"])
def change_password(request):
    if not request.user.check_password(request.data.get("current_password", "")):
        raise ValidationError({"current_password": "Contraseña actual incorrecta."})
    from django.contrib.auth.password_validation import validate_password
    password = request.data.get("password", "")
    validate_password(password, request.user)
    request.user.set_password(password)
    request.user.save()
    from django.contrib.auth import update_session_auth_hash
    update_session_auth_hash(request, request.user)
    return Response({"detail": "Contraseña actualizada."})


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def password_reset(request):
    email = str(request.data.get("email", "")).strip()
    user = User.objects.filter(email__iexact=email).first()
    if user:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f"{settings.FRONTEND_ORIGIN}/restablecer/{uid}/{token}"
        send_mail("Restablecer acceso a AgrocodeUTC", f"Abre este enlace para cambiar tu contraseña:\n{link}", settings.DEFAULT_FROM_EMAIL, [user.email])
    return Response({"detail": "Si el correo existe, recibirás instrucciones."})


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def password_reset_confirm(request):
    try:
        pk = force_str(urlsafe_base64_decode(request.data.get("uid", "")))
        user = User.objects.get(pk=pk)
    except (ValueError, TypeError, User.DoesNotExist):
        raise ValidationError("Enlace inválido.")
    if not default_token_generator.check_token(user, request.data.get("token", "")):
        raise ValidationError("El enlace ha expirado o no es válido.")
    from django.contrib.auth.password_validation import validate_password
    password = request.data.get("password", "")
    validate_password(password, user)
    user.set_password(password)
    user.save()
    return Response({"detail": "Contraseña actualizada."})


@api_view(["GET"])
def geocode(request):
    query = request.query_params.get("q", "").strip()
    if len(query) < 3 or len(query) > 160:
        raise ValidationError("Escribe entre 3 y 160 caracteres.")
    key = f"geocode:{query.lower()}"
    result = cache.get(key)
    if result is not None:
        return Response(result)
    if not cache.add("geocoder_lock", True, timeout=1):
        return Response({"detail": "Espera un segundo antes de buscar otro lugar."}, status=429)
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": settings.GEOCODER_USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()
        result = [{
            "lat": item["lat"], "lon": item["lon"], "display_name": item["display_name"],
            "boundingbox": item.get("boundingbox"), "type": item.get("type"),
            "country_code": item.get("address", {}).get("country_code", "").upper(),
            "region": next((item.get("address", {}).get(key) for key in ("state", "region", "county", "city") if item.get("address", {}).get(key)), ""),
        } for item in response.json()[:1]]
        cache.set(key, result, timeout=86400)
        return Response(result)
    except requests.RequestException:
        return Response({"detail": "El servicio de búsqueda no está disponible."}, status=503)


@api_view(["GET"])
def reverse_geocode(request):
    try:
        latitude = float(request.query_params["lat"])
        longitude = float(request.query_params["lon"])
    except (KeyError, ValueError):
        raise ValidationError("Proporciona latitud y longitud válidas.")
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValidationError("Coordenadas fuera de rango.")
    key = f"reverse:{latitude:.3f}:{longitude:.3f}"
    result = cache.get(key)
    if result is not None:
        return Response(result)
    if not cache.add("geocoder_lock", True, timeout=1):
        return Response({"detail": "Espera un segundo antes de buscar otro lugar."}, status=429)
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": latitude, "lon": longitude, "format": "json", "zoom": 8, "addressdetails": 1},
            headers={"User-Agent": settings.GEOCODER_USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()
        address = response.json().get("address", {})
        result = {
            "country_code": address.get("country_code", "").upper(),
            "region": next((address[key] for key in ("state", "region", "county") if address.get(key)), ""),
        }
        cache.set(key, result, timeout=86400)
        return Response(result)
    except requests.RequestException:
        return Response({"detail": "No fue posible identificar el país de esta ubicación."}, status=503)


@api_view(["GET"])
def ai_status(request):
    try:
        check_model()
        return Response({"configured": True, "model": settings.OLLAMA_MODEL})
    except OllamaUnavailable as exc:
        return Response({"configured": False, "model": settings.OLLAMA_MODEL, "detail": str(exc)})


class ParcelViewSet(viewsets.ModelViewSet):
    serializer_class = ParcelSerializer

    def get_queryset(self):
        return Parcel.objects.filter(owner=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["get"], url_path="simulator-weather")
    def simulator_weather(self, request, pk=None):
        parcel = self.get_object()
        try:
            days = int(request.query_params.get("days", "4"))
            refresh = request.query_params.get("refresh", "0")
            if refresh not in ("0", "1"):
                raise ValueError("El parámetro refresh debe ser 0 o 1.")
            result = get_simulator_weather(parcel, days, refresh=refresh == "1")
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)}) from exc
        except WeatherUnavailable as exc:
            return Response({"detail": str(exc)}, status=503, headers={"Cache-Control": "private, no-store"})
        return Response(result, headers={"Cache-Control": "private, no-store"})

    @action(detail=True, methods=["get"], url_path="dashboard-metrics")
    def dashboard_metrics(self, request, pk=None):
        parcel = self.get_object()
        try:
            return Response(get_dashboard_metrics(parcel))
        except (ValueError, requests.RequestException) as exc:
            return Response({"detail": f"No fue posible obtener indicadores NASA: {exc}"}, status=503)

    @action(detail=True, methods=["get"], url_path="historical-baseline")
    def baseline(self, request, pk=None):
        parcel = self.get_object()
        try:
            return Response(get_historical_baseline(parcel))
        except (ValueError, requests.RequestException) as exc:
            return Response({"detail": f"No fue posible consultar el historial NASA: {exc}"}, status=503)

    @action(detail=True, methods=["get", "put"], url_path="profile")
    def profile(self, request, pk=None):
        parcel = self.get_object()
        profile, _ = AgronomicProfile.objects.get_or_create(parcel=parcel)
        if request.method == "PUT":
            serializer = ProfileSerializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        return Response(ProfileSerializer(profile).data)

    @action(detail=True, methods=["get", "post"], url_path="climate")
    def climate(self, request, pk=None):
        parcel = self.get_object()
        start_default, end_default = available_years()
        try:
            start = int(request.data.get("start_year", request.query_params.get("start_year", start_default)))
            end = int(request.data.get("end_year", request.query_params.get("end_year", end_default)))
            values, cached, fetched_at = get_climate(parcel, start, end)
            monthly = monthly_summary(values, start, end)
        except (ValueError, requests.RequestException) as exc:
            return Response({"detail": f"No fue posible consultar NASA POWER: {exc}"}, status=503)
        result = {
            "years": [start, end], "period": {"start": f"{start}-01-01", "end": f"{end}-12-31"},
            "coverage": daily_coverage(values, start, end), "monthly": monthly,
            "scenario": historical_scenario(monthly), "units": UNITS, "cached": cached,
            "queried_at": timezone.now().isoformat(), "fetched_at": fetched_at,
            "source": "NASA POWER — daily point, comunidad AG",
            "notice": "Estimaciones regionales, no mediciones dentro de la parcela. Tres años no permiten pronosticar.",
        }
        if request.method == "POST":
            Analysis.objects.create(owner=request.user, parcel=parcel, kind="climate", title=f"Clima {start}–{end}", result=result)
        return Response(result)

    @action(detail=True, methods=["post"])
    def recommend(self, request, pk=None):
        parcel = self.get_object()
        start, end = available_years()
        try:
            values, _, _ = get_climate(parcel, start, end)
        except (ValueError, requests.RequestException) as exc:
            return Response({"detail": f"No fue posible consultar NASA POWER: {exc}"}, status=503)
        result = recommendations(parcel, monthly_summary(values, start, end))
        output = {
            "candidates": result,
            "notice": "No hay datos suficientes para recomendar un cultivo con confianza." if not result
            else "Candidatos exploratorios con fichas FAO globales; aún no son recomendaciones validadas para tu localidad.",
        }
        Analysis.objects.create(owner=request.user, parcel=parcel, kind="recommendation", title="Cultivos orientativos", result=output)
        return Response(output)

    @action(detail=True, methods=["post"])
    def rotations(self, request, pk=None):
        parcel = self.get_object()
        strategies = request.data.get("strategies")
        if not isinstance(strategies, list) or len(strategies) != 3 or any(not isinstance(s, dict) or not isinstance(s.get("crops"), list) or len(s["crops"]) > 12 for s in strategies):
            raise ValidationError("Proporciona tres estrategias con listas de cultivos.")
        in_demo_region = parcel.country.upper() == "EC" and -4.4 <= parcel.latitude <= 0.5 and -79.2 <= parcel.longitude <= -77.5
        crops = Crop.objects.filter(validated=True, country_code="EC", region="Sierra ecuatoriana") if in_demo_region else []
        catalog = {c.name.lower(): c for c in crops}
        monthly = cached_rotation_months(parcel)
        result = []
        for index, strategy in enumerate(strategies):
            names = [str(n)[:120].strip() for n in strategy["crops"]]
            matched = [catalog.get(n.lower()) for n in names]
            families = [c.family for c in matched if c]
            repeated_neighbors = [
                f"{names[i]} y {names[i + 1]} pertenecen a {matched[i].family}; consulta si conviene alternar familias."
                for i in range(len(matched) - 1)
                if matched[i] and matched[i + 1] and matched[i].family == matched[i + 1].family
            ]
            guidance = repeated_neighbors or ["No se detectaron familias consecutivas repetidas entre las fichas disponibles. La diversidad no garantiza evitar plagas."]
            if any(not c for c in matched):
                guidance.append("Faltan fichas para parte de la secuencia; no se puede evaluar la rotación completa.")
            guidance.extend(rotation_guidance(parcel, names, matched, catalog, monthly))
            result.append({
                "name": strategy.get("name", f"Estrategia {index + 1}")[:100],
                "crops": names, "documented": [c.name for c in matched if c],
                "unknown": [name for name, c in zip(names, matched) if not c],
                "families": len(set(families)), "repeated_families": len(families) - len(set(families)),
                "guidance": guidance,
                "notice": "Comparación exploratoria de familias FAO; no implica validación regional ni predice rendimiento o demanda de agua.",
            })
        output = {"strategies": result}
        Analysis.objects.create(owner=request.user, parcel=parcel, kind="rotation", title="Comparación de rotaciones", result=output)
        return Response(output)

    @action(detail=True, methods=["post"], url_path="ai-rotation-review")
    def ai_rotation_review(self, request, pk=None):
        parcel = self.get_object()
        strategy = request.data.get("crops")
        if not isinstance(strategy, list) or not 1 <= len(strategy) <= 12 or any(
            not isinstance(name, str) or not name.strip() or len(name) > 120 for name in strategy
        ):
            raise ValidationError({"crops": "Envía entre 1 y 12 nombres de cultivos."})
        strategy_name = request.data.get("strategy_name", "Estrategia A")
        if strategy_name not in ("Estrategia A", "Estrategia B", "Estrategia C"):
            raise ValidationError({"strategy_name": "Selecciona la estrategia A, B o C."})
        # Keep this context on loopback. Never include coordinates, history, free-text notes or parcel name.
        in_demo_region = parcel.country.upper() == "EC" and -4.4 <= parcel.latitude <= 0.5 and -79.2 <= parcel.longitude <= -77.5
        crops = Crop.objects.filter(validated=True, country_code="EC", region="Sierra ecuatoriana") if in_demo_region else []
        catalog = {c.name.lower(): c.family for c in crops}
        plants = [{"crop": name.strip(), "family": catalog.get(name.strip().lower(), "sin ficha")}
                  for name in strategy]
        profile = AgronomicProfile.objects.filter(parcel=parcel).first()
        context = {
            "strategy": strategy_name,
            "plants": plants,
            "association_type": "no especificado (asociación simultánea o rotación secuencial)",
            "parcel_context": {
                "country": parcel.country,
                "soil_texture": profile.soil_texture if profile and profile.soil_texture else "sin datos",
                "irrigation": profile.irrigation if profile and profile.irrigation else "sin datos",
            },
            "family_source": "Fichas generales FAO solo en corredor demo de Sierra ecuatoriana; sin ficha en otros casos.",
        }
        try:
            text = review_strategy(context)
        except OllamaUnavailable as exc:
            return Response({"detail": str(exc)}, status=503)
        return Response({
            "review": text, "model": settings.OLLAMA_MODEL,
            "notice": "Texto generado por IA local sin validación agronómica. No se enviaron coordenadas ni historial. Consulta un profesional antes de actuar.",
        })


class HistoryViewSet(viewsets.ModelViewSet):
    serializer_class = HistorySerializer

    def get_queryset(self):
        queryset = CropHistory.objects.filter(parcel__owner=self.request.user)
        parcel_id = self.request.query_params.get("parcel")
        if parcel_id is not None:
            if not parcel_id.isdecimal():
                raise ValidationError({"parcel": "Selecciona una parcela válida."})
            queryset = queryset.filter(parcel_id=int(parcel_id))
        return queryset


class AnalysisViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AnalysisSerializer

    def get_queryset(self):
        queryset = Analysis.objects.filter(owner=self.request.user)
        parcel_id = self.request.query_params.get("parcel")
        if parcel_id is not None:
            if not parcel_id.isdecimal():
                raise ValidationError({"parcel": "Selecciona una parcela válida."})
            queryset = queryset.filter(parcel_id=int(parcel_id))
        return queryset


class CropViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CropSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Crop.objects.filter(validated=True)


class AgronomistViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AgronomistSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return Agronomist.objects.filter(published=True)
