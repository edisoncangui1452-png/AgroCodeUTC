# Ajustes de interfaz y accesibilidad

## Preferencias de apariencia

Los controles de idioma y tema están en el encabezado, junto al logo, en las vistas pública, de acceso y de trabajo. En pantallas pequeñas se muestran como botones de icono con etiquetas accesibles. Las preferencias siguen guardándose en localStorage con las claves agrocode-language y agrocode-theme.

## País ISO en parcelas

El formulario usa un selector nativo con nombre y código, y guarda únicamente el código alpha-2. Los códigos incluidos son los asignados por ISO 3166-1 alpha-2; la fuente del estándar es la [página ISO 3166 de ISO](https://www.iso.org/iso-3166-country-codes.html). Intl.DisplayNames del navegador localiza los nombres al español o al inglés. El repositorio no tenía una lista de países. La validación actual del backend solo verifica que el valor tenga dos letras; el selector limita las opciones nuevas a códigos ISO asignados y no cambia el contrato ni el modelo.

## Área de parcela

La pantalla de parcelas presenta el área de la parcela guardada seleccionada usando area_ha, devuelta por el backend. Django la calcula con pyproj.Geod sobre WGS84 a partir del polígono. La interfaz convierte hectáreas a metros cuadrados con 1 ha = 10.000 m² y muestra ambas unidades con hasta dos decimales. Al cambiar el polígono sin guardar o cuando falta geometría/superficie, muestra «Área no disponible»; no calcula otra superficie en el navegador.

## Mi perfil

El avatar es una inicial derivada del nombre; no hay carga de imágenes. El resumen muestra solo nombre, correo y el conteo real de parcelas obtenido de la API. La fecha de registro y el país no se muestran porque el perfil/API no los exponen como datos de la cuenta. El estado de carga, el error con reintento y la cuenta sin parcelas están contemplados.

## Calendario lunar 2026

El botón **Calendario lunar** está en el panel principal. Abre un diálogo modal con un mes a la vez, restringido a enero–diciembre de 2026. Las flechas de enero y diciembre se deshabilitan en los límites; **Hoy** devuelve al mes/día actual cuando la fecha local está dentro de 2026. El día seleccionado tiene borde azul sólido y el día actual, si es distinto, borde azul discontinuo. Se cierra con el botón visible, Escape o clic en el fondo. Las flechas del teclado mueven la selección por día o semana sin salir del año.

Los cálculos usan **SunCalc 2.1.4**, dependencia JavaScript ligera elegida para obtener la fracción iluminada y fase lunar con getMoonIllumination. El README oficial indica que sus fórmulas se basan en Astronomical Algorithms, de Jean Meeus. Cada fecha se consulta a las **12:00 hora local del navegador**; todos los días de 2026 usan la misma hora de referencia. La fracción iluminada procede de la librería y se redondea al porcentaje entero mostrado. Se muestra el nombre de fase principal cuando la fase calculada está a no más de **0,5 días** de Luna nueva, cuarto creciente, Luna llena o cuarto menguante; ese umbral se mide en el ciclo de fase de SunCalc usando el mes sinódico de 29,530588853 días.

La imagen de cada luna se dibuja como SVG local usando la fracción iluminada y la dirección creciente/menguante de SunCalc, con una esfera oscura circular como fondo; no hay imágenes externas. La primera columna usa el número de semana **ISO 8601**, calculado con la semana que contiene el jueves (lunes como inicio de semana). El calendario presenta datos de fase, no recomendaciones agronómicas. El pie visible dice: «Fases calculadas con SunCalc 2.1.4. No son datos de NASA POWER ni de NASA GIBS.»

Referencia de cálculo y API: [README oficial de SunCalc](https://github.com/mourner/suncalc/blob/master/README.md).

## Comprobaciones

Las pruebas enfocadas del frontend y la compilación se ejecutan desde frontend/ con:

    npm.cmd test
    npm.cmd run build

Las pruebas backend se ejecutan desde backend/ con .\.venv\Scripts\python.exe manage.py test (o con el intérprete del entorno virtual configurado).