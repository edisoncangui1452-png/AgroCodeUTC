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

En `historical-baseline`, `rain_mm` es el producto de la tasa mensual en mm/día por días de ese mes; la clave `monthly_mean_min_below_zero_frequency_percent` cuenta meses cuya **media de las mínimas diarias** cayó por debajo de 0 °C, no meses que tuvieron una helada. Todas las frecuencias requieren ≥30 años válidos y no son probabilidades para fechas futuras. La revisión de IA se procesa exclusivamente en el Ollama configurado en loopback. Envía nombres escritos por el usuario, familias disponibles, país y textura del suelo/riego si están en el perfil; no envía coordenadas ni historial. El nombre de la estrategia no implica que las plantas sean simultáneas.

`recommend/` y `climate/` conservan `crop_windows`/`candidates` e incorporan por cultivo `id`, `primary_duration` y `rain_status` (`sin_datos`, `en_rango_historico` o `compatibilidad_parcial`). El rango completo de días y las ventanas `durations` originales permanecen. `rotations/` conserva las tres estrategias y amplía `guidance` con el cultivo anterior registrado, familias, información declarada de suelo/riego y contexto de lluvia **solo si ya existe una consulta diaria cacheada para el mismo punto**. No se realiza una nueva consulta NASA para comparar rotaciones.

El perfil de parcela admite `soil_texture` entre las 11 clases ofrecidas por la interfaz e `irrigation` con `Sí`, `No` o vacío (desconocido). `water_availability` anterior permanece en la base de datos para preservar registros históricos, pero no se ofrece como campo editable.
