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

Para habilitar la revisión opcional con **Ollama local**, instala [Ollama](https://ollama.com/download), ejecuta `ollama pull qwen3:4b` y, si no está en ejecución, `ollama serve`. Comprueba `http://127.0.0.1:11434/api/tags`; debe aparecer `qwen3:4b`. Si quieres usar otro modelo, define `OLLAMA_MODEL` en `backend/.env`. `OLLAMA_BASE_URL` admite únicamente HTTP hacia `localhost`, `127.0.0.1` o `::1`; por defecto es `http://127.0.0.1:11434`. **No se necesita API Key**. Inicia el backend y el frontend como arriba y pulsa «Comprobar de nuevo» en Cultivos y rotaciones si acabas de iniciar Ollama. Sin Ollama, el comparador de reglas sigue funcionando. La IA recibe únicamente cultivos de la estrategia seleccionada, familias de fichas disponibles y país/textura del suelo/riego del perfil cuando constan; no se envían coordenadas, notas ni historial fuera del equipo. No supongas que una lista es asociación simultánea: también puede ser una rotación. El texto generado puede equivocarse y requiere revisión profesional. Las pruebas automatizadas simulan respuestas; verifique por separado su instalación y modelo reales.

El asistente se instruye en **español de Ecuador**, trato de usted, respuestas normalmente de 60–100 palabras y sugerencias prácticas; si faltan datos solicita pruebas de suelo o verificación de campo. No se traduce ni recorta la respuesta final generada: el razonamiento interno separado por `</think>` no se muestra y, si Ollama entrega solo razonamiento, inglés o una salida incompleta, se muestra un error en vez de presentarla como consejo agrícola. Se comprobó una respuesta real en español de `qwen3:4b` con mayor presupuesto de generación; otras instalaciones pueden requerir revisar su plantilla y versión local.

### Simulador agrícola — fase 1

En el menú privado, **Simulador agrícola** permite seleccionar una parcela y preparar una configuración con cinco cultivos de inicio de ciclo corto del catálogo existente (lechuga, zanahoria, rábano, arveja y repollo), cantidad de semillas o plántulas, superficie en hectáreas y modalidades de observación de 4, 7 o 45 días. La superficie no puede superar la de la parcela. El resumen es local a la página y **no se guarda**. Diez espacios de fertilizantes están reservados visualmente, sin productos ni dosis definidos. Todavía no hay simulación, cálculos, animaciones 2D, pronósticos ni estimaciones de cosecha; las duraciones de observación no representan ciclos productivos.

En **Cultivos y rotaciones**, cada ficha aparece una sola vez, en la duración principal más próxima al centro de su rango FAO; puede expandir la tarjeta para ver otras duraciones compatibles. Arveja, por ejemplo, conserva 60–140 días y puede coincidir con ~2 y ~3 meses sin ser dos registros distintos. Si la lluvia anual solo coincide en parte con la ficha FAO, se advierte **compatibilidad parcial**; nunca se infiere agua disponible del ciclo. La comparación transparente de rotaciones considera el último cultivo registrado, familias sucesivas y datos existentes de suelo, riego y clima histórico guardado para ese punto. Sin mes de siembra, análisis de suelo y agua medidos no atribuye aptitud completa ni pronostica rendimiento.

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

La versión actual **no satisface todo el prompt inicial**: las 15 fichas Ecocrop no están verificadas para localidades concretas; el corredor andino es una **aproximación rectangular**, no una delimitación agroecológica. Tampoco hay pronósticos futuros calibrados, asistente capaz de resolver preguntas arbitrarias, geocodificación mundial robusta, catálogo dinámico de capas GIBS desde GetCapabilities, calendario de siembra completo, estimación hídrica por rotación ni resumen compartible con un profesional. No se deben presentar estas partes como implementadas. La consulta POWER requiere conexión; GIBS y OSM también. La caché NASA diaria dura 30 días y la mensual histórica 90 días en SQLite; la de geocodificación en memoria dura 24 horas.
