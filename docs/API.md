# API v1

Base: `/api/v1/`. JSON; sesiones Django con cookie HttpOnly. Para `POST`, `PUT`, `PATCH`, `DELETE`, obtener primero `GET /auth/csrf/` y enviar `X-CSRFToken` con `withCredentials`.

| Recurso | Métodos | Notas |
|---|---|---|
| `auth/csrf/` | GET | Token CSRF; público |
| `auth/register/` | POST | `{first_name,email,password}`; crea sesión |
| `auth/login/` | POST | `{email,password}` |
| `auth/logout/` | POST | Termina sesión |
| `auth/me/` | GET, PATCH | `{first_name,email}` |
| `auth/change-password/` | POST | `{current_password,password}` |
| `auth/password-reset/` | POST | `{email}`; respuesta no revela existencia |
| `auth/password-reset/confirm/` | POST | `{uid,token,password}` |
| `geocode/?q=...` | GET | Proxy limitado a Nominatim; necesita sesión |
| `geocode/reverse/?lat=...&lon=...` | GET | Resuelve país y región de la ubicación |
| `ai/status/` | GET | Con sesión; `configured` indica si Ollama local responde y dispone de `OLLAMA_MODEL`; devuelve `model` y `detail` si no está disponible |
| `parcels/` | GET, POST | `{name,country,location,geometry}`; código ISO 2 letras |
| `parcels/{id}/` | GET, PATCH, DELETE | Solo propietario; superficie calculada en servidor |
| `parcels/{id}/profile/` | GET, PUT | Perfil opcional |
| `parcels/{id}/dashboard-metrics/` | GET | Último mes completo disponible: temperatura, lluvia, índice superficial de humedad y frecuencia observada de heladas; solo propietario |
| `parcels/{id}/historical-baseline/` | GET | Serie NASA POWER mensual 1983–2025; `period`, `months`, `cached`, `fetched_at`, `notice`; cada mes contiene medianas/P10/P90 y frecuencias históricas, no pronósticos |
| `parcels/{id}/climate/` | GET, POST | `start_year,end_year` (query o JSON); POST guarda análisis; devuelve `crop_windows` por ciclos de 2, 3 y 6 meses |
| `parcels/{id}/recommend/` | POST | Compara fichas regionales validadas; guarda resultado |
| `parcels/{id}/rotations/` | POST | `{strategies:[{name,crops:[]},...]}`; tres estrategias |
| `parcels/{id}/ai-rotation-review/` | POST | `{crops:["Papa","Haba"],strategy_name:"Estrategia A"}` (1–12 nombres; estrategia opcional A/B/C); requiere Ollama local y propietario; mantiene `review`, `model`, `notice` o devuelve 503 |
| `history/`, `history/{id}/` | GET, POST, PUT, PATCH, DELETE | Registros agrícolas; filtrar con `?parcel=ID` |
| `analyses/`, `analyses/{id}/` | GET | Análisis privados; filtrar con `?parcel=ID` |
| `crops/`, `crops/{id}/` | GET | Solo fichas validadas |
| `agronomists/`, `agronomists/{id}/` | GET | Solo profesionales publicados |

Las rutas `parcels`, `history` y `analyses` filtran por propietario incluso al solicitar un ID concreto. Una respuesta NASA puede demorar decenas de segundos; los errores del proveedor devuelven 503.

## Respuesta climática

`GET /parcels/{id}/climate/` devuelve `period` (periodo solicitado), `queried_at`, `fetched_at`, `source`, `units`, `monthly`, `scenario` y `coverage`. Para cada variable de `coverage` se informan `valid_days`, `missing_days`, `total_days`, `coverage_percent`, `complete`, `first_valid_date`, `last_valid_date` y `missing_ranges`. Las fechas observadas son el primer y último día con valor diario numérico finito por encima del umbral de relleno `-900`; si no hay valores válidos, las dos fechas son `null`. La respuesta no incluye IDs de parcela, usuario ni correo.

En `historical-baseline`, `rain_mm` es el producto de la tasa mensual en mm/día por días de ese mes; la clave `monthly_mean_min_below_zero_frequency_percent` cuenta meses cuya **media de las mínimas diarias** cayó por debajo de 0 °C, no meses que tuvieron una helada. Todas las frecuencias requieren ≥30 años válidos y no son probabilidades para fechas futuras. La revisión de IA se procesa exclusivamente en el Ollama configurado en loopback. Envía nombres escritos por el usuario, familias disponibles, país y textura del suelo/riego si están en el perfil; no envía coordenadas ni historial. El nombre de la estrategia no implica que las plantas sean simultáneas.

`recommend/` y `climate/` conservan `crop_windows`/`candidates` e incorporan por cultivo `id`, `primary_duration` y `rain_status` (`sin_datos`, `en_rango_historico` o `compatibilidad_parcial`). El rango completo de días y las ventanas `durations` originales permanecen. `rotations/` conserva las tres estrategias y amplía `guidance` con el cultivo anterior registrado, familias, información declarada de suelo/riego y contexto de lluvia **solo si ya existe una consulta diaria cacheada para el mismo punto**. No se realiza una nueva consulta NASA para comparar rotaciones.

### Meteorología del simulador (FASE 2)

`GET /api/v1/parcels/{id}/simulator-weather/?days=4|7|45&refresh=0|1` requiere sesión y propiedad de la parcela; `refresh=1` intenta una nueva consulta. HTTP 400 para modalidad/coordenadas inválidas, 404 para parcela ajena, 503 si no hay fuente disponible. Respuesta privada sin caché de navegador:

```json
{
  "parcel": 1, "coordinates": {"latitude": -1.66, "longitude": -78.64},
  "days": 4, "information_type": "forecast", "measurement_type": "model_forecast",
  "demonstration_scenario": false, "source": "Open-Meteo",
  "model": "ECMWF IFS (Open-Meteo)", "queried_at": "2026-11-15T12:00:00+00:00",
  "issued_at": null, "fetched_at": "2026-11-15T12:00:00+00:00",
  "valid_from": "2026-11-15", "valid_to": "2026-11-18",
  "timezone": "UTC", "resolution": "daily", "cached": false, "stale": false,
  "age_seconds": 0, "units": {"temperature_mean_c": "°C", "precipitation_mm": "mm"},
  "rows": [{"period_start": "2026-11-15", "period_end": "2026-11-15",
    "values": {"temperature_mean_c": 15.5, "precipitation_mm": null},
    "missing": ["precipitation_mm"], "uncertainty": null}]
}
```

Los campos `units` y `values` reales incluyen también temperatura mínima/máxima (`°C`), humedad relativa del aire (`%`), radiación solar (`MJ/m²`) y humedad volumétrica superficial del suelo convertida de `m³/m³` a `% volumétrico` si existe. `variable_origin` distingue pronóstico meteorológico de estimación modelada de humedad de suelo; no se presentan observaciones locales ni escenarios demostrativos (`demonstration_scenario=false`). Los valores ausentes son `null`, nunca cero ficticio; `missing` contiene las claves faltantes por fila. En 4/7 días cada fila es diaria. En 45 días `information_type=subseasonal_forecast`, `resolution=weekly`: cada valor con miembros se resume como media de sus agregados semanales, `basis` especifica `ensemble_mean`, `control_run` o `missing` por variable y `uncertainty` contiene los extremos de miembros EC46 para temperatura media semanal y precipitación acumulada semanal (no intervalos de confianza). Si no hay EC46 ni caché anterior, `information_type=historical`, `source=NASA POWER`, `resolution=historical_month`, `historical_period=[1983,2025]`, fechas `valid_from/valid_to` y `period_start/period_end` nulas, `reference_month` y percentiles históricos `p10/p90`: **no son pronósticos**. `issued_at` es `null` si Open-Meteo no publica la emisión en la respuesta; jamás se deduce de `fetched_at`.

El perfil de parcela admite `soil_texture` entre las 11 clases ofrecidas por la interfaz e `irrigation` con `Sí`, `No` o vacío (desconocido). `water_availability` anterior permanece en la base de datos para preservar registros históricos, pero no se ofrece como campo editable.

### Evaluación agronómica parcial (FASE 3)

- `POST /api/v1/simulations/` crea configuración propia: `{ "parcel": 1, "crop": "cilantro", "planted_on": "2026-11-12", "quantity": 100, "quantity_type": "seeds", "area_m2": 25, "days": 4 }`. Cultivos: `cilantro`, `rabano`, `rucula`, `lechuga_hoja`, `espinaca`; tipos de cantidad: `seeds` o `established_plants`; horizonte: 4, 7 o 45. Área positiva y ≤ área registrada (ha × 10000); siembra no futura.
- `GET /api/v1/simulations/?parcel=1` y `GET /api/v1/simulations/{id}/` recuperan configuraciones propias.
- `PATCH /api/v1/simulations/{id}/` admite únicamente `observed_stage` (siembra, germinación, emergencia, crecimiento inicial, desarrollo vegetativo, desarrollo avanzado, posible cosecha), `observed_soil_condition` (`seco`, `humedo`, `encharcado`), `observed_plants` y `observed_on`. Cada observación requiere fecha entre siembra y hoy; no altera configuración. Para otra fecha de siembra se crea otro registro.
- `GET /api/v1/simulations/{id}/evaluate/?refresh=0|1` evalúa meteorología **servidor** de fase 2, nunca un JSON meteorológico enviado por el cliente. Respuesta con `simulation_id`, `crop` (ficha y fuentes), `planted_on`, `simulated_at`, `horizon_days`, `weather` (tipo, resolución, caché), `quantity` (densidad, conteo observado, `potentially_harvestable: null`), `initial_state`, `stage`, `qualitative_assessment`, `indicative_harvest_window` (solo si hay rango externo; estado `referencia_externa_no_confirmada`), `uncertainty` separada para clima y modelo agrícola, `missing`, `warnings` y `results`. Cada resultado diario o semanal incluye `period_start/end`, `days_since_sowing`, `stage` y `stage_source`, `thermal`, `water`, `humidity`, `radiation`, `risks`, `missing`, `meteorological_uncertainty`, `basis` y `visual_state` (`rendering: not_implemented`). Si hay solo NASA POWER histórico, `results=[]`: no se proyecta crecimiento. No hay mortalidad, porcentaje de fertilidad ni estimación de rendimiento. Parcela ajena/registro ajeno: no accesible; entrada inválida: 400; proveedor sin datos: 503.
