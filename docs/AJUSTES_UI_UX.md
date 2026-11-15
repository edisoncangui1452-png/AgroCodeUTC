# Ajustes de interfaz y accesibilidad

## Preferencias de apariencia

Los controles de idioma y tema están en el encabezado, junto al logo, en las vistas pública, de acceso y de trabajo. En pantallas pequeñas se muestran como botones de icono con etiquetas accesibles. Las preferencias siguen guardándose en localStorage con las claves agrocode-language y agrocode-theme.

## País ISO en parcelas

El formulario usa un selector nativo con nombre y código, y guarda únicamente el código alpha-2. Los códigos incluidos son los asignados por ISO 3166-1 alpha-2; la fuente del estándar es la [página ISO 3166 de ISO](https://www.iso.org/iso-3166-country-codes.html). Intl.DisplayNames del navegador localiza los nombres al español o al inglés. El repositorio no tenía una lista de países. La validación actual del backend solo verifica que el valor tenga dos letras; el selector limita las opciones nuevas a códigos ISO asignados y no cambia el contrato ni el modelo.

## Área de parcela

La pantalla de parcelas presenta el área de la parcela guardada seleccionada usando area_ha, devuelta por el backend. Django la calcula con pyproj.Geod sobre WGS84 a partir del polígono. La interfaz convierte hectáreas a metros cuadrados con 1 ha = 10.000 m² y muestra ambas unidades con hasta dos decimales. Al cambiar el polígono sin guardar o cuando falta geometría/superficie, muestra «Área no disponible»; no calcula otra superficie en el navegador.

## Mi perfil

El avatar es una inicial derivada del nombre; no hay carga de imágenes. El resumen muestra solo nombre, correo y el conteo real de parcelas obtenido de la API. La fecha de registro y el país no se muestran porque el perfil/API no los exponen como datos de la cuenta. El estado de carga, el error con reintento y la cuenta sin parcelas están contemplados.

## Calendario lunar agrícola 2026

El botón **Calendario lunar** del panel principal abre un modal con una ilustración SVG local de una granja y una persona agricultora. El título muestra el mes y el año, junto con el texto «Observa la Luna, trabaja la tierra y cosecha abundancia». La cuadrícula usa siete columnas de domingo a sábado. Muestra fechas vecinas del mismo año con abreviatura del mes; las celdas fuera de 2026 quedan vacías. Las flechas se limitan a enero–diciembre y **Hoy** selecciona el día actual cuando corresponde. Se conserva el cierre por botón, Escape y clic fuera del modal.

Las fases, iluminación y dirección creciente/menguante se calculan con **SunCalc 2.1.4**. La iluminación diaria se consulta a las **12:00 hora local del navegador** y se redondea al porcentaje entero mostrado. Los instantes de Luna nueva, cuarto creciente, Luna llena y cuarto menguante se obtienen resolviendo los cruces de fase 0, 0,25, 0,5 y 0,75 de SunCalc: se explora en intervalos de seis horas y se refina cada cruce mediante bisección. El evento se muestra si ocurre en la fecha local de la celda y a no más de **13 horas** de la muestra del mediodía. La hora local se presenta al minuto. SunCalc calcula una fase astronómica; no es una observación en la parcela ni un dato NASA.

La luna de cada celda y de la guía se dibuja en SVG usando la fracción iluminada y la dirección de iluminación proporcionadas por SunCalc. No se usan imágenes externas. Un solo módulo, frontend/src/lunarAgriculturalRules.js, centraliza las cuatro reglas tradicionales y la leyenda. Las fases principales muestran exactamente: Luna Nueva → «No sembrar / Descanso y preparación»; Creciente → «Siembra de hojas / Siembra de flores»; Luna Llena → «Cosecha general / Recolección»; Cuarto Menguante → «Poda de formación / Control de plagas». Los días intermedios aplican la regla de la próxima fase principal. El apoyo es Riego/Abonado si se avanza hacia Luna Nueva o Luna Llena y Siembra de Raíces si se avanza hacia Creciente o Cuarto Menguante. La guía de cuatro fases y los siete iconos se generan desde esa misma tabla.

El pie visible dice: «Fases calculadas con SunCalc 2.1.4. Las recomendaciones son prácticas tradicionales según la fase lunar, no son datos de NASA POWER ni de NASA GIBS y no sustituyen asesoría agronómica.» Las recomendaciones no son una predicción de rendimiento ni asesoría personalizada. Al ser un cálculo local sin servicio remoto, no hay estados de carga o reintento aplicables.

## Comprobaciones

Las pruebas enfocadas del frontend y la compilación se ejecutan desde frontend/ con:

    npm.cmd test
    npm.cmd run build

Las pruebas backend se ejecutan desde backend/ con .\.venv\Scripts\python.exe manage.py test (o con el intérprete del entorno virtual configurado).
