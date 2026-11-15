# Rediseño e historial climático

## Identidad visual y preferencias

La paleta agrícola se define en un solo lugar: `frontend/src/styles.css`, en `:root` (tema claro) y `:root[data-theme="dark"]` (tema oscuro). Ahí viven los tonos de bosque, hoja, tierra, cielo, superficies, bordes, alertas, foco, mapa, gráficos y la textura ligera del encabezado. Los componentes usan esas variables y las clases semánticas configuradas en `frontend/tailwind.config.js`; para cambiar la identidad, se editan esos tokens y no colores aislados en cada pantalla.

El tema oscuro mantiene la paleta verde y tierra. El selector global aparece también en inicio, acceso y registro; guarda la elección en `localStorage` y, sin elección previa, toma `prefers-color-scheme`. El selector ES/EN también está disponible en todas las rutas, cambia el contenido sin recargar y guarda la preferencia en `localStorage`. El modo avanzado solo conserva su estado en la pantalla actual.

Las pantallas principales usan texto base de 16 px, foco visible, controles de al menos 44 px, tarjetas adaptables y una ilustración de surcos hecha con CSS. La textura puede prescindirse respetando `prefers-reduced-motion`; la hoja de estilos elimina animaciones cuando el sistema solicita movimiento reducido. En impresión, la ficha usa tinta negra y fondo blanco para seguir siendo legible en escala de grises.

La traducción al inglés está completa en la ficha, el historial climático, el modo avanzado, el resumen visual, el calendario lunar, sus estados y el asistente. Varias pantallas heredadas (por ejemplo, parcelas, historial agrícola y perfil) continúan en español. Al elegir inglés se muestra un aviso persistente de que quedan secciones en español; las cadenas que pasan por el helper de traducción tienen un marcador `[ES]` si falta una traducción.

## Consulta, ficha y cobertura

En **Historial climático**, elige una parcela y el último año calendario completo y pulsa **Consultar y generar ficha**. La consulta abarca tres años completos. La pantalla muestra carga con skeleton, error comprensible con reintento, estado vacío y cobertura insuficiente con fechas faltantes. No presenta trazas técnicas en la interfaz.

La ficha usa `GET /api/v1/parcels/{id}/climate/` y se genera en el navegador. Muestra ubicación y superficie registradas, punto representativo, periodo consultado, variables y unidades devueltas, cobertura, resumen mensual, fuente, fecha de consulta y advertencias. No expone nombre completo, correo, teléfono ni identificadores de usuario o parcela. El backend no requiere modelo ni migración nuevos para esta respuesta.

Un valor diario cuenta como válido si es un número finito mayor que `-900`. `coverage` entrega días válidos, faltantes, total esperado, porcentaje, cobertura completa, primera y última fecha válida y rangos inclusivos de fechas faltantes. Si no hay días válidos, las fechas observadas son `null`. El servicio no interpola, rellena ni estima los días faltantes. El resumen mensual existente exige todos los días para sumar lluvia; para las demás variables existentes requiere al menos 80 % de los días del mes. Si no alcanza la cobertura requerida, el valor mensual es `null`.

Para imprimir, pulsa **Imprimir / guardar PDF** y selecciona **Guardar como PDF** en el navegador. No se incorpora una biblioteca de PDF.

## Modo avanzado

El botón **Modo avanzado** abre o cierra una sección opcional; el estado no se persiste. Presenta seis secciones, todas con fuente NASA POWER y una nota de cobertura:

1. **Rango histórico observado:** la primera y última fecha válida entre las variables recibidas; no es el periodo pedido.
2. **Tabla comparativa:** solo variables/unidades que devuelve la respuesta, valores mensuales existentes y días válidos por variable.
3. **Comparación mensual:** reutiliza el gráfico y las agregaciones mensuales que ya existían. Solo grafica meses con valores disponibles en dos o más años. El backend ya omite agregaciones mensuales que no cumplen su umbral de cobertura; la nota detalla los días válidos de cada punto dibujado.
4. **Resumen climático por mes:** valores centrales, rangos y observaciones de `scenario`, que ya devuelve la aplicación.
5. **Resumen mensual disponible:** valores mensuales y cobertura de las variables/unidades recibidas.
6. **Periodo consultado:** fechas solicitadas a NASA POWER, diferenciadas del rango observado.

El modo avanzado no calcula tendencias, pronósticos, nuevos promedios ni recomendaciones. Si faltan fechas, variables, filas o valores suficientes, lo indica en lugar de sustituirlos.

## Resumen visual y calendario lunar

El **Resumen visual por mes** toma los valores y unidades mensuales que ya vienen en la respuesta. Presenta iconos con etiqueta, valor, unidad y cobertura diaria solo donde existe un valor; las variables faltantes aparecen en una línea separada como **Dato no disponible**.

El calendario lunar es una vista separada, fija para 2026, y no depende del periodo de la ficha. Usa SunCalc 2.1.4: para cada día consulta la fracción iluminada y fase a las 12:00 hora local del navegador, redondea la fracción al porcentaje entero mostrado y enseña el nombre de fase principal cuando está a 0,5 días o menos de esa fase. La luna se dibuja en SVG local desde los datos de SunCalc. Las semanas siguen ISO 8601, con lunes como primer día. No presenta consejos de siembra, riego ni cosecha. El pie indica: **Fases calculadas con SunCalc 2.1.4. No son datos de NASA POWER ni de NASA GIBS.**

## Asistente lateral

El panel **Asistente** es un mock de plantillas en el navegador; no hay endpoint de chat ni backend LLM. Sus respuestas solo citan datos disponibles de la ficha visible: periodo, variables, cobertura, fuente o parcela seleccionada. Para otras preguntas responde literalmente **“No tengo suficiente información en tu ficha para responder eso.”** El panel conserva las preguntas mientras permanece montado, se puede cerrar con Escape y muestra en todo momento que no sustituye asesoría agronómica. No consulta ni muestra otras parcelas.

## Fuentes y límites

- **NASA POWER:** estimaciones regionales para el punto representativo, no mediciones dentro de la parcela.
- **NASA GIBS:** solo capa visual; no es fuente de análisis climático.
- **Historial:** los años consultados no son un pronóstico.
- **Asistente:** mock local; no genera respuestas reales con un modelo.
- **Calendario lunar:** vista fija de 2026 calculada con SunCalc 2.1.4 a las 12:00 hora local; no representa datos de NASA ni ofrece precisión de efeméride observada.
- **PDF:** se obtiene con la impresión del navegador.
- **Idioma:** la experiencia climática está en español e inglés; ciertas pantallas heredadas siguen en español y muestran un aviso al usar inglés.

## Renombre

El repositorio usa AgrocodeUTC en textos, metadatos, paquetes, backend y documentación. La búsqueda final sin distinguir mayúsculas y minúsculas no encontró coincidencias del nombre anterior; la prueba automatizada revisa nombres de archivos y contenido de texto del repositorio.

## Pruebas

Desde `frontend/`, ejecuta `npm.cmd test` y `npm.cmd run build`. Desde `backend/`, ejecuta `.\.venv\Scripts\python.exe manage.py test` (o el Python del entorno virtual configurado). Las pruebas cubren ficha completa y parcial, estados de carga/error/vacío, asistente, preferencias, resumen visual, calendario y sus fallback, las seis secciones avanzadas y el renombre.
