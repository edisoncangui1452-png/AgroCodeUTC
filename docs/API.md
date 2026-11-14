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
| `parcels/` | GET, POST | `{name,country,location,geometry}`; código ISO 2 letras |
| `parcels/{id}/` | GET, PATCH, DELETE | Solo propietario; superficie calculada en servidor |
| `parcels/{id}/profile/` | GET, PUT | Perfil opcional |
| `parcels/{id}/climate/` | GET, POST | `start_year,end_year` (query o JSON); POST guarda análisis |
| `parcels/{id}/recommend/` | POST | Compara fichas regionales validadas; guarda resultado |
| `parcels/{id}/rotations/` | POST | `{strategies:[{name,crops:[]},...]}`; tres estrategias |
| `history/`, `history/{id}/` | GET, POST, PUT, PATCH, DELETE | Registros agrícolas del usuario |
| `analyses/`, `analyses/{id}/` | GET | Análisis guardados privados |
| `crops/`, `crops/{id}/` | GET | Solo fichas validadas |
| `agronomists/`, `agronomists/{id}/` | GET | Solo profesionales publicados |

Las rutas `parcels`, `history` y `analyses` filtran por propietario incluso al solicitar un ID concreto. Una respuesta NASA puede demorar decenas de segundos; los errores del proveedor devuelven 503.
