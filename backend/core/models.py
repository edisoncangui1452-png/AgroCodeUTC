from django.conf import settings
from django.db import models


class Parcel(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="parcels")
    name = models.CharField(max_length=140)
    country = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=180, blank=True)
    geometry = models.JSONField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    area_ha = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class AgronomicProfile(models.Model):
    parcel = models.OneToOneField(Parcel, on_delete=models.CASCADE, related_name="profile")
    current_crop = models.CharField(max_length=120, blank=True)
    soil_texture = models.CharField(max_length=100, blank=True)
    organic_matter = models.FloatField(null=True, blank=True)
    water_availability = models.CharField(max_length=80, blank=True)
    irrigation = models.CharField(max_length=100, blank=True)
    cultivated_area_ha = models.FloatField(null=True, blank=True)
    constraints = models.TextField(blank=True)
    objectives = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)


class CropHistory(models.Model):
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name="crop_history")
    crop_name = models.CharField(max_length=120)
    planted_on = models.DateField()
    harvested_on = models.DateField(null=True, blank=True)
    yield_notes = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-planted_on"]


class Crop(models.Model):
    name = models.CharField(max_length=120)
    scientific_name = models.CharField(max_length=180, blank=True)
    family = models.CharField(max_length=120)
    region = models.CharField(max_length=160, help_text="Región respaldada, p. ej. Sierra ecuatoriana")
    country_code = models.CharField(max_length=2, help_text="Código ISO 3166-1 alpha-2")
    min_temp_c = models.FloatField()
    max_temp_c = models.FloatField()
    min_rain_mm = models.FloatField(null=True, blank=True, help_text="Lluvia mensual orientativa")
    max_rain_mm = models.FloatField(null=True, blank=True)
    cycle_days = models.PositiveIntegerField()
    soil_notes = models.TextField(blank=True)
    rotation_notes = models.TextField(blank=True)
    source = models.URLField(blank=True)
    validated = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} — {self.region}"


class ClimateQuery(models.Model):
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name="climate_queries")
    latitude = models.FloatField()
    longitude = models.FloatField()
    start_year = models.PositiveIntegerField()
    end_year = models.PositiveIntegerField()
    payload = models.JSONField()
    source = models.CharField(max_length=100, default="NASA POWER daily point")
    parameters = models.JSONField(default=list)
    units = models.JSONField(default=dict)
    metadata = models.JSONField(default=dict)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["parcel", "start_year", "end_year", "fetched_at"])]


class Analysis(models.Model):
    parcel = models.ForeignKey(Parcel, on_delete=models.CASCADE, related_name="analyses")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    kind = models.CharField(max_length=30, choices=[("climate", "Clima"), ("recommendation", "Recomendación"), ("rotation", "Rotación")])
    title = models.CharField(max_length=180)
    result = models.JSONField()
    algorithm_version = models.CharField(max_length=20, default="1.0")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Agronomist(models.Model):
    name = models.CharField(max_length=160)
    specialty = models.CharField(max_length=160)
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=160, blank=True)
    email = models.EmailField(blank=True)
    whatsapp = models.CharField(max_length=40, blank=True)
    credentials = models.TextField()
    published = models.BooleanField(default=False)

    def __str__(self):
        return self.name
