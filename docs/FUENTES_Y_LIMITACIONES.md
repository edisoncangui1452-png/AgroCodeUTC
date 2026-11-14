# Fuentes, cálculos y límites

- **NASA POWER**, API diaria puntual: https://power.larc.nasa.gov/docs/services/api/temporal/daily/ . Parámetros comprobados en consulta real: `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `WS2M`; comunidad `AG`, tiempo `UTC`. Unidades por defecto observadas: °C, mm/día, %, **MJ/m²/día**, m/s. NASA usa `-999` como relleno. Son valores de la celda/fuente regional; no sensores de la finca.
- **NASA GIBS**, capa MODIS Terra True Color sobre WMS EPSG:3857: https://nasa-gibs.github.io/gibs-api-docs/ . Es visual y no se usa para extraer valores de clima. Algunas fechas no tendrán imagen.
- **OpenStreetMap/Nominatim**: https://operations.osmfoundation.org/policies/nominatim/ . Las búsquedas pasan por Django, se guardan 24 h en caché local en memoria y se limitan a 1 solicitud por segundo por proceso. Configurar `GEOCODER_USER_AGENT` con un contacto real. Para escala de producción se necesita otro proveedor o una instancia propia.
- **Mapas**: teselas OpenStreetMap con atribución; sujeto a su política de uso. No usar como servicio de alto tráfico sin proveedor apropiado.

## Agregación

Cada mes/año usa registros diarios válidos (`> -900`). Para precipitación se exige **cobertura diaria completa** antes de sumar mm/día (una suma parcial subestimaría el mes). Con al menos 80 % de días válidos: temperatura media, humedad, radiación y viento son medias diarias; `T2M_MAX` muestra el máximo diario observado del mes y `T2M_MIN` el mínimo diario. El escenario mensual usa rango, promedio y desviación estándar poblacional de los valores mensuales disponibles, si hay por lo menos dos años. **No es un pronóstico**. La superficie se calcula con `pyproj.Geod` sobre WGS84, en hectáreas. Polígonos que cruzan el antimeridiano están explícitamente rechazados.

## Recomendaciones

No hay fichas de cultivos precargadas ni profesionales inventados. Un administrador debe documentar una ficha y marcarla como validada tras verificar sus rangos y región. El motor requiere coincidencia de código de país y nombre de región, al menos dos meses-año con datos válidos para el mes, y media mensual de temperatura y precipitación dentro de los rangos de la ficha. Es una **heurística simple, no una puntuación ni una probabilidad de éxito**. No analiza todavía altitud, suelo, requerimiento hídrico por ciclo ni interacción de cultivos; por tanto las propuestas requieren revisión local. La comparación de rotaciones solo mide diversidad de familias documentadas, repeticiones y ausencias de fichas; no estima agua, cobertura o rentabilidad.

La coincidencia de región se basa actualmente en texto escrito por el usuario, no en una delimitación agroecológica oficial. Hasta contar con límites geoespaciales validados, los resultados son **solo orientativos**.
