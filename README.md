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

En **Resumen**, el selector está dentro de la tarjeta del terreno. Cuatro indicadores compactos muestran el último mes completo disponible en NASA POWER: temperatura media, lluvia acumulada, índice superficial de humedad y frecuencia observada de días con mínima bajo 0 °C. No se interpretan como sensores de la finca ni como pronóstico.

En **Historial climático** puedes consultar aparte la serie mensual NASA POWER **1983–2025** para la ubicación de tu parcela. Muestra medianas, rangos P10–P90 y porcentajes observados de meses con lluvia ≥100 mm, media térmica <10 °C y media mensual de mínimas diarias <0 °C. Esta última cifra **no cuenta meses con heladas**: una media mensual de mínimas no revela si heló en un día concreto. No hay pronóstico de próximos días, probabilidad predictiva mensual ni proyección validada para próximos años. La serie se conserva hasta 90 días por ubicación; requiere conexión en la primera consulta.

El botón **?** abre una guía local de preguntas frecuentes sobre navegación y datos, con una pestaña separada de profesionales publicados. No es un chatbot generativo ni ofrece asesoría agronómica. En el mapa, las búsquedas colocan una chincheta, el zoom mínimo es 3 y los botones de importación/exportación explican el formato GeoJSON. **Cultivos y rotaciones** permite agregar cultivos visualmente y comparar familias de estrategias; esto no garantiza prevenir enfermedades ni plagas.

Opcionalmente, para revisar una estrategia con un proveedor externo compatible con OpenAI Chat Completions, define `AGRO_AI_API_KEY` en `backend/.env`. Puedes ajustar `AGRO_AI_MODEL` y `AGRO_AI_URL` (solo HTTPS). Sin clave la revisión de IA permanece desactivada y la comparación de reglas sigue funcionando. Al solicitarla se envían **los nombres de cultivos escritos y familias de ficha** al proveedor, no coordenadas ni historial; evita introducir datos personales en los nombres. El texto generado puede equivocarse y requiere revisión profesional. No hay clave incluida, ni se ha verificado una respuesta real del proveedor.

La búsqueda geográfica envía el texto consultado a Nominatim; la consulta climática envía a NASA el punto representativo del polígono. No se publican parcelas por la API. La recuperación de contraseña imprime el enlace en la consola del backend en desarrollo; para envío real configura SMTP en `.env`.

## Comprobaciones

```powershell
cd backend
.\.venv\Scripts\python.exe manage.py test
cd ..\frontend
npm run build
```

La suite usa dobles para respuestas NASA; las pruebas de integración externas se realizan por separado. Se comprobó manualmente desde la aplicación la consulta POWER de los tres años completos 2023–2025 y se verificó el WMS GetCapabilities de NASA GIBS. Más detalles: [`docs/FUENTES_Y_LIMITACIONES.md`](docs/FUENTES_Y_LIMITACIONES.md) y [`docs/API.md`](docs/API.md).


