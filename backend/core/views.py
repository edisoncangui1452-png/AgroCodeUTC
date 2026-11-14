import requests
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.middleware.csrf import get_token
from django.utils.encoding import force_str
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

from .models import AgronomicProfile, Agronomist, Analysis, Crop, CropHistory, Parcel
from .serializers import (
    AgronomistSerializer, AnalysisSerializer, CropSerializer, HistorySerializer,
    ParcelSerializer, ProfileSerializer, RegisterSerializer, UserSerializer,
)
from .services import UNITS, available_years, get_climate, historical_scenario, monthly_summary, recommendations

User = get_user_model()


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
        send_mail("Restablecer acceso a AgroFísica", f"Abre este enlace para cambiar tu contraseña:\n{link}", settings.DEFAULT_FROM_EMAIL, [user.email])
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
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": settings.GEOCODER_USER_AGENT},
            timeout=10,
        )
        response.raise_for_status()
        result = [{"lat": item["lat"], "lon": item["lon"], "display_name": item["display_name"]} for item in response.json()[:1]]
        cache.set(key, result, timeout=86400)
        return Response(result)
    except requests.RequestException:
        return Response({"detail": "El servicio de búsqueda no está disponible."}, status=503)


class ParcelViewSet(viewsets.ModelViewSet):
    serializer_class = ParcelSerializer

    def get_queryset(self):
        return Parcel.objects.filter(owner=self.request.user).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

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
            "parcel": parcel.pk, "years": [start, end], "monthly": monthly,
            "scenario": historical_scenario(monthly), "units": UNITS, "cached": cached,
            "fetched_at": fetched_at, "source": "NASA POWER — daily point, comunidad AG",
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
        output = {"candidates": result, "notice": "No hay datos suficientes para recomendar un cultivo con confianza." if not result else "Compatibilidad histórica orientativa; consulta un profesional antes de sembrar."}
        Analysis.objects.create(owner=request.user, parcel=parcel, kind="recommendation", title="Cultivos orientativos", result=output)
        return Response(output)

    @action(detail=True, methods=["post"])
    def rotations(self, request, pk=None):
        parcel = self.get_object()
        strategies = request.data.get("strategies")
        if not isinstance(strategies, list) or len(strategies) != 3 or any(not isinstance(s, dict) or not isinstance(s.get("crops"), list) or len(s["crops"]) > 12 for s in strategies):
            raise ValidationError("Proporciona tres estrategias con listas de cultivos.")
        crops = Crop.objects.filter(validated=True, country_code=parcel.country.upper())
        catalog = {c.name.lower(): c for c in crops if c.region.lower() in parcel.location.lower()}
        result = []
        for index, strategy in enumerate(strategies):
            names = [str(n)[:120].strip() for n in strategy["crops"]]
            matched = [catalog.get(n.lower()) for n in names]
            families = [c.family for c in matched if c]
            result.append({
                "name": strategy.get("name", f"Estrategia {index + 1}")[:100],
                "crops": names, "documented": [c.name for c in matched if c],
                "unknown": [name for name, c in zip(names, matched) if not c],
                "families": len(set(families)), "repeated_families": len(families) - len(set(families)),
                "notice": "Comparación de diversidad documental; no predice rendimiento ni demanda de agua.",
            })
        output = {"strategies": result}
        Analysis.objects.create(owner=request.user, parcel=parcel, kind="rotation", title="Comparación de rotaciones", result=output)
        return Response(output)


class HistoryViewSet(viewsets.ModelViewSet):
    serializer_class = HistorySerializer

    def get_queryset(self):
        return CropHistory.objects.filter(parcel__owner=self.request.user)


class AnalysisViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AnalysisSerializer

    def get_queryset(self):
        return Analysis.objects.filter(owner=self.request.user)


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
