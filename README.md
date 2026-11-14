# AgroFísica

Prototipo web para consultar el clima histórico de una parcela con NASA POWER y conservar decisiones agrícolas. Interfaz en español, visual verde claro/blanco. **No está desplegado y no se debe usar como asesoría agronómica profesional.**

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

Registra una cuenta, entra en **Mis parcelas**, importa `docs/parcela-demo.geojson`, escribe un nombre y selecciona **Ecuador**. También puedes buscar país/sector o usar geolocalización para centrar el mapa y completar el país. Guarda y abre **Historial climático** para consultar NASA. La geometría es **ilustrativa**, no una finca real. NASA devuelve datos reales de su celda regional. Puedes registrar cultivos anteriores, consultar ventanas de crecimiento de 2, 3 y 6 meses y guardar análisis. **Resumen** y **Mi historial** tienen selector de parcela.

Las migraciones cargan **15 fichas de FAO Ecocrop** con rangos generales documentados. Los resultados son *candidatos exploratorios*, **no recomendaciones locales validadas**. Cada ficha enlaza a su fuente; no se inventaron profesionales.

En **Resumen**, el selector está dentro de la tarjeta del terreno. Cuatro indicadores compactos muestran el último mes completo disponible en NASA POWER: temperatura media, lluvia acumulada, índice superficial de humedad y frecuencia observada de heladas. No se interpretan como sensores de la finca ni como pronóstico.

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

La versión actual **no satisface todo el prompt inicial**: las 15 fichas Ecocrop no están verificadas para localidades concretas; el corredor andino es una **aproximación rectangular**, no una delimitación agroecológica. Tampoco hay geocodificación mundial robusta, catálogo dinámico de capas GIBS desde GetCapabilities, calendario de siembra completo, estimación hídrica por rotación ni resumen compartible con un profesional. No se deben presentar estas partes como implementadas. La consulta POWER requiere conexión; GIBS y OSM también. La caché NASA dura 30 días en SQLite; la de geocodificación en memoria dura 24 horas.
