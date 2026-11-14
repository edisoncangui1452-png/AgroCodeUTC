# Fuentes, cálculos y límites

- **NASA POWER**, API diaria puntual: https://power.larc.nasa.gov/docs/services/api/temporal/daily/ . Parámetros comprobados en consulta real: `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `WS2M`; comunidad `AG`, tiempo `UTC`. Unidades por defecto observadas: °C, mm/día, %, **MJ/m²/día**, m/s. NASA usa `-999` como relleno. Son valores de la celda/fuente regional; no sensores de la finca.
- **Indicadores de Resumen**: el endpoint mensual usa también `GWETTOP`, verificado en respuesta real de POWER con unidad `1` (índice 0–1 de humedad superficial). Se expresa como porcentaje **del índice**, no como porcentaje volumétrico de agua del suelo. Para el último mes calendario completo con datos suficientes (retrocede como máximo tres meses): `T2M` media con ≥80 % de días, `PRECTOTCORR` suma solo con todos los días válidos, `GWETTOP` media con ≥80 % de días y porcentaje de días con `T2M_MIN < 0 °C` con ≥80 % de días válidos. Este último porcentaje es **frecuencia observada en el mes**, no pronóstico ni probabilidad futura de helada. El resultado se conserva seis horas en caché; si faltan datos se muestra «Sin datos», nunca un valor de ejemplo.
- **NASA GIBS**, capa MODIS Terra True Color sobre WMS EPSG:3857: https://nasa-gibs.github.io/gibs-api-docs/ . Es visual y no se usa para extraer valores de clima. Algunas fechas no tendrán imagen.
- **OpenStreetMap/Nominatim**: https://operations.osmfoundation.org/policies/nominatim/ . Las búsquedas pasan por Django, se guardan 24 h en caché local en memoria y se limitan a 1 solicitud por segundo por proceso. Configurar `GEOCODER_USER_AGENT` con un contacto real. Para escala de producción se necesita otro proveedor o una instancia propia.
- **Mapas**: teselas OpenStreetMap con atribución; sujeto a su política de uso. No usar como servicio de alto tráfico sin proveedor apropiado.

## Agregación

Cada mes/año usa registros diarios válidos (`> -900`). Para precipitación se exige **cobertura diaria completa** antes de sumar mm/día (una suma parcial subestimaría el mes). Con al menos 80 % de días válidos: temperatura media, humedad, radiación y viento son medias diarias; `T2M_MAX` muestra el máximo diario observado del mes y `T2M_MIN` el mínimo diario. El escenario mensual usa rango, promedio y desviación estándar poblacional de los valores mensuales disponibles, si hay por lo menos dos años. **No es un pronóstico**. La superficie se calcula con `pyproj.Geod` sobre WGS84, en hectáreas. Polígonos que cruzan el antimeridiano están explícitamente rechazados.

## Catálogo y escenarios de cultivo

Las migraciones cargan 15 fichas de **FAO Ecocrop** (https://ecocrop.apps.fao.org/ecocrop/srv/en/home): papa, quinua, cebada, haba, arveja, maíz, trigo, avena, chocho, zanahoria, cebolla, repollo, remolacha, lechuga y rábano. Cada registro enlaza directamente a su ficha `dataSheet?id=...`. Se registran **temperaturas óptimas**, **lluvia anual óptima** y **rango de días de cultivo** de la ficha consultada el 14/11/2026. Las fichas FAO son generales: `regional_validated=false` en todas las 15 iniciales, y no se presentarán como aval específico de Ecuador.

Para 2, 3 y 6 meses, solo entran fichas cuyo ciclo documentado abarca aproximadamente 60, 90 o 180 días. Para cada posible mes de inicio se revisan **todos los meses del ciclo** de cada año histórico (incluyendo el siguiente año al cruzar diciembre). Exige lluvia mensual completa y temperatura mensual con cobertura ≥80 %; se necesitan por lo menos dos ciclos históricos completos, con la temperatura media de **cada mes** dentro del rango óptimo en por lo menos dos temporadas. La suma de lluvia del ciclo se muestra como observación histórica, **no se compara contra lluvia anual como si fuera necesidad del ciclo**. La lluvia anual FAO se muestra solo como contexto separado. No se calcula probabilidad de éxito ni pronóstico.

La lista exploratoria está limitada a parcelas con país `EC` en un **rectángulo aproximado** de coordenadas latitud -4.4 a 0.5 y longitud -79.2 a -77.5. Ese rectángulo puede incluir zonas que no sean Sierra; hace falta sustituirlo por cartografía agroecológica autorizada antes de validar recomendaciones locales.

## Recomendaciones

Hay fichas FAO precargadas pero **no profesionales ficticios**. Un administrador puede ampliar y validar fichas regionales con fuentes propias. El motor es una **heurística de coincidencia climática histórica**, no una puntuación ni una probabilidad de éxito. No analiza todavía altitud, suelo, requerimiento hídrico por ciclo ni interacción de cultivos; por tanto los candidatos requieren revisión local. La comparación de rotaciones solo mide diversidad de familias documentadas, repeticiones y ausencias de fichas; no estima agua, cobertura o rentabilidad.

Hasta contar con límites geoespaciales y fichas locales validadas, los resultados son **solo orientativos**.
