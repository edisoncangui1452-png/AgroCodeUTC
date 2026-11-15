from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import AgronomicProfile, Agronomist, Analysis, Crop, CropHistory, CropSimulation, Parcel
from .simulator_crops import CROPS
from .simulator_engine import STAGES
from django.utils import timezone
import math
from .services import validate_geometry

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "first_name", "email"]


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        email = validated_data["email"]
        return User.objects.create_user(username=email, email=email, password=validated_data["password"], first_name=validated_data["first_name"])


class ParcelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parcel
        fields = ["id", "name", "country", "location", "geometry", "latitude", "longitude", "area_ha", "created_at"]
        read_only_fields = ["latitude", "longitude", "area_ha", "created_at"]

    def validate_geometry(self, value):
        try:
            validate_geometry(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return value

    def validate_country(self, value):
        if value and (len(value) != 2 or not value.isalpha()):
            raise serializers.ValidationError("Usa el código ISO de dos letras, por ejemplo EC.")
        return value.upper()

    def save(self, **kwargs):
        self.validated_data["latitude"], self.validated_data["longitude"], self.validated_data["area_ha"] = validate_geometry(
            self.validated_data.get("geometry", self.instance.geometry if self.instance else None)
        )
        return super().save(**kwargs)


class SimulationSerializer(serializers.ModelSerializer):
    crop = serializers.ChoiceField(choices=list(CROPS))
    quantity_type = serializers.ChoiceField(choices=["seeds", "established_plants"])
    observed_stage = serializers.ChoiceField(choices=["", *STAGES], required=False)
    observed_soil_condition = serializers.ChoiceField(choices=["", "seco", "encharcado", "humedo"], required=False)
    observed_plants = serializers.IntegerField(min_value=0, required=False, allow_null=True)

    class Meta:
        model = CropSimulation
        fields = ["id", "parcel", "crop", "planted_on", "quantity", "quantity_type", "area_m2",
                  "days", "observed_stage", "observed_soil_condition", "observed_plants",
                  "observed_on", "updated_at"]
        read_only_fields = ["id", "updated_at"]
        extra_kwargs = {"quantity": {"min_value": 1}, "area_m2": {"min_value": 0.000001}}

    def validate_parcel(self, parcel):
        if parcel.owner_id != self.context["request"].user.pk:
            raise serializers.ValidationError("Esta parcela no te pertenece.")
        return parcel

    def validate_days(self, value):
        if value not in (4, 7, 45):
            raise serializers.ValidationError("Modalidad inválida.")
        return value

    def validate(self, attrs):
        instance = self.instance
        parcel = attrs.get("parcel", getattr(instance, "parcel", None))
        planted = attrs.get("planted_on", getattr(instance, "planted_on", None))
        area = attrs.get("area_m2", getattr(instance, "area_m2", None))
        observed_on = attrs.get("observed_on", getattr(instance, "observed_on", None))
        observed_plants = attrs.get("observed_plants", getattr(instance, "observed_plants", None))
        quantity = attrs.get("quantity", getattr(instance, "quantity", None))
        quantity_type = attrs.get("quantity_type", getattr(instance, "quantity_type", None))
        stage = attrs.get("observed_stage", getattr(instance, "observed_stage", ""))
        soil = attrs.get("observed_soil_condition", getattr(instance, "observed_soil_condition", ""))
        if parcel and area is not None and (not math.isfinite(area) or area > parcel.area_ha * 10000):
            raise serializers.ValidationError({"area_m2": "Superficie inválida o superior a la parcela."})
        if planted and planted > timezone.localdate():
            raise serializers.ValidationError({"planted_on": "La fecha de siembra no puede ser futura."})
        if observed_on and (observed_on < planted or observed_on > timezone.localdate()):
            raise serializers.ValidationError({"observed_on": "La observación debe estar entre siembra y hoy."})
        if (stage or soil or observed_plants is not None) and observed_on is None:
            raise serializers.ValidationError({"observed_on": "Indique fecha para datos observados."})
        if observed_plants is not None and quantity is not None and observed_plants > quantity:
            raise serializers.ValidationError({"observed_plants": "No puede exceder la cantidad inicial sin registrar nuevas siembras."})
        if observed_plants is not None and quantity_type == "established_plants" and observed_plants > quantity:
            raise serializers.ValidationError({"observed_plants": "Cantidad observada inconsistente."})
        if instance and any(key in attrs for key in ("parcel", "crop", "planted_on", "quantity",
                                                     "quantity_type", "area_m2", "days")):
            raise serializers.ValidationError("La configuración no se modifica: cree otra simulación.")
        return attrs


class ProfileSerializer(serializers.ModelSerializer):
    SOIL_TEXTURES = {
        "Arenoso", "Arenoso franco", "Franco arenoso", "Franco", "Franco limoso", "Limoso",
        "Franco arcillo-arenoso", "Franco arcilloso", "Franco arcillo-limoso", "Arcillo-arenoso",
        "Arcillo-limoso",
    }

    class Meta:
        model = AgronomicProfile
        fields = [
            "id", "current_crop", "soil_texture", "organic_matter", "irrigation",
            "cultivated_area_ha", "constraints", "objectives", "notes",
        ]

    def validate_soil_texture(self, value):
        if value and value not in self.SOIL_TEXTURES:
            raise serializers.ValidationError("Selecciona una textura de suelo de la lista.")
        return value

    def validate_irrigation(self, value):
        if value not in ("", "Sí", "No"):
            raise serializers.ValidationError("El riego debe indicarse como Sí, No o No lo sé.")
        return value


class HistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = CropHistory
        fields = "__all__"
        read_only_fields = ["created_at"]

    def validate_parcel(self, value):
        if value.owner_id != self.context["request"].user.id:
            raise serializers.ValidationError("Esta parcela no te pertenece.")
        return value

    def validate(self, attrs):
        if attrs.get("harvested_on") and attrs["harvested_on"] < attrs.get("planted_on", getattr(self.instance, "planted_on", None)):
            raise serializers.ValidationError("La cosecha no puede preceder a la siembra.")
        return attrs


class AnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Analysis
        fields = ["id", "parcel", "kind", "title", "result", "algorithm_version", "created_at"]
        read_only_fields = ["kind", "title", "result", "algorithm_version", "created_at"]


class CropSerializer(serializers.ModelSerializer):
    class Meta:
        model = Crop
        fields = "__all__"


class AgronomistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Agronomist
        fields = ["id", "name", "specialty", "country", "region", "email", "whatsapp", "credentials"]
