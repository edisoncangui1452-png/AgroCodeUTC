from django.contrib import admin
from .models import AgronomicProfile, Agronomist, Analysis, ClimateQuery, Crop, CropHistory, Parcel

admin.site.register([Parcel, AgronomicProfile, CropHistory, ClimateQuery, Analysis])

@admin.register(Crop)
class CropAdmin(admin.ModelAdmin):
    list_display = ("name", "region", "country_code", "validated", "updated_at")
    list_filter = ("validated", "country_code")

@admin.register(Agronomist)
class AgronomistAdmin(admin.ModelAdmin):
    list_display = ("name", "specialty", "country", "published")
    list_filter = ("published", "country")
