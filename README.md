# AgrocodeUTC

Prototipo web para consultar el clima histórico de una parcela con NASA POWER y conservar decisiones agrícolas. Interfaz en español con identidad visual de campo y temas claro y oscuro. **No está desplegado y no se debe usar como asesoría agronómica profesional.**

## Estructura

- `frontend/`: React, Vite, Tailwind, Leaflet y Recharts.
- `backend/`: Django REST, sesiones, SQLite, cálculo geodésico, POWER y administración.
- `docs/`: contrato de API, fuentes, límites y geometría de ejemplo.

## Iniciar en Windows / VS Code

Abre esta carpeta en VS Code y usa dos terminales PowerShell.

**Terminal 1 — backend:**

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edita .env y reemplaza DJANGO_SECRET_KEY por una clave larga aleatoria.
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

**Terminal 2 — frontend:**

```powershell
cd frontend
npm install
npm run dev
```

Abre **http://127.0.0.1:5173/**. Usa siempre `127.0.0.1` en las instrucciones para que el origen CSRF coincida. Admin: **http://127.0.0.1:8000/admin/**. Python 3.12+ y Node.js moderno. SQLite se inicializa mediante migraciones; `db.sqlite3` no se versiona.

## Recorrido verificado / modo de demostración

Registra una cuenta, entra en **Mis parcelas**, importa `docs/parcela-demo.geojson`, escribe un nombre, país `EC` y región `Sierra ecuatoriana`, guarda y abre **Historial climático** para consultar NASA. La geometría es **ilustrativa**, no una finca real. NASA devuelve datos reales de su celda regional. Puedes registrar cultivos anteriores y guardar análisis. Para que aparezcan candidatos, un administrador debe introducir y validar fichas técnicas en Django Admin; no se inventaron fichas ni profesionales.

La búsqueda geográfica envía el texto consultado a Nominatim; la consulta climática envía a NASA el punto representativo del polígono. No se publican parcelas por la API. La recuperación de contraseña imprime el enlace en la consola del backend en desarrollo; para envío real configura SMTP en `.env`.

## Comprobaciones

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test
cd ..\frontend
npm run build
```

La suite usa dobles para respuestas NASA; las pruebas de integración externas se realizan por separado. Se comprobó manualmente desde la aplicación la consulta POWER de los tres años completos 2023–2025 y se verificó el WMS GetCapabilities de NASA GIBS. Más detalles: [`docs/FUENTES_Y_LIMITACIONES.md`](docs/FUENTES_Y_LIMITACIONES.md) y [`docs/API.md`](docs/API.md).

## Funciones aún limitadas

La versión actual **no satisface todo el prompt inicial**: no hay catálogo agronómico verificado precargado, geocodificación mundial robusta, catálogo de capas GIBS desde GetCapabilities, calendario de siembra completo, estimación hídrica por rotación ni resumen compartible con un profesional. No se deben presentar estas partes como implementadas. La consulta POWER requiere conexión; GIBS y OSM también. La caché NASA dura 30 días en SQLite; la de geocodificación en memoria dura 24 horas.

## Ficha climática imprimible

La pantalla de historial climático genera una ficha con datos NASA POWER ya consultados, cobertura diaria por variable, fechas faltantes y avisos en español e inglés. Incluye un resumen visual de valores mensuales. Desde el panel principal se abre el calendario lunar independiente de 2026, calculado con SunCalc 2.1.4. La ficha se puede guardar como PDF desde la impresión del navegador. El rediseño, el modo avanzado, el idioma/tema y las limitaciones del asistente local están descritos en [docs/FICHA_CLIMATICA.md](docs/FICHA_CLIMATICA.md).

El renombre global a AgrocodeUTC se verificó con una búsqueda final sin distinguir mayúsculas y minúsculas; el resultado fue de cero coincidencias del nombre anterior.

## Ajustes de UI y UX

Las preferencias de apariencia, el selector de país ISO, la medición de superficie, el perfil visual y el calendario lunar 2026 están descritos en [`docs/AJUSTES_UI_UX.md`](docs/AJUSTES_UI_UX.md). El calendario agrícola usa SunCalc 2.1.4 a las 12:00 hora local y reglas tradicionales centralizadas; no es dato de NASA ni asesoría agronómica personalizada.
