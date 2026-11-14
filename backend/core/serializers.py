from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import AgronomicProfile, Agronomist, Analysis, Crop, CropHistory, Parcel
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


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgronomicProfile
        exclude = ["parcel"]


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
