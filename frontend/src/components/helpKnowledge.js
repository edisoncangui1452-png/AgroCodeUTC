// Answers are intentionally limited to verified app behavior, not agronomic advice.
export const helpTopics = [
  { question: '¿Cómo creo una parcela?', words: ['crear', 'parcela', 'parcelas', 'terreno', 'dibujar', 'poligono'], answer: 'En Mis parcelas, busca una localidad o país, usa el botón de polígono del mapa, marca los vértices y pulsa Guardar parcela. El área se calcula en el servidor.', path: '/parcelas' },
  { question: '¿Cómo busco un país?', words: ['pais', 'buscar', 'mapa', 'canada', 'ubicacion'], answer: 'Busca un país o selecciónalo en Datos de parcela. El mapa se centrará en él y colocará una chincheta en el resultado. No restringe dónde puedes dibujar.', path: '/parcelas' },
  { question: '¿Cómo edito o elimino una parcela?', words: ['editar', 'eliminar', 'borrar', 'vertices'], answer: 'En Mis parcelas, elige una parcela y usa los controles de edición del mapa. Guarda para conservar los cambios. El botón Eliminar parcela pide confirmación y borra también su historial.', path: '/parcelas' },
  { question: '¿Cómo importo GeoJSON?', words: ['importar', 'archivo', 'geojson', 'subir'], answer: 'Importar GeoJSON abre un archivo .geojson o .json con un polígono. Tras importarlo, verifica el país y pulsa Guardar parcela. La importación por sí sola no guarda cambios.', path: '/parcelas' },
  { question: '¿Para qué sirve Exportar?', words: ['exportar', 'descargar', 'geojson'], answer: 'Exportar descarga una copia del polígono actual como parcela.geojson. No envía ni elimina información.', path: '/parcelas' },
  { question: '¿Cómo uso el clima?', words: ['clima', 'nasa', 'power', 'temperatura', 'precipitacion', 'lluvia'], answer: 'En Historial climático elige una parcela y pulsa Consultar datos para comparar tres años, o Consulta serie histórica para ver meses de 1983–2025. Son valores regionales, no sensores en tu finca.', path: '/clima' },
  { question: '¿Qué indica la humedad del suelo?', words: ['humedad', 'suelo', 'gwet'], answer: 'En Resumen se muestra el índice superficial GWETTOP de NASA POWER convertido de 0–1 a porcentaje del índice. No es un análisis de suelo ni humedad volumétrica medida en tu parcela.', path: '/panel' },
  { question: '¿Qué significan las heladas?', words: ['helada', 'heladas', 'frio', 'riesgo', 'probabilidad'], answer: 'Resumen muestra el porcentaje de días pasados con mínima inferior a 0 °C en el último mes completo. El historial largo compara medias mensuales de mínimas diarias; no cuenta meses con helada. Ninguna cifra predice que helará mañana.', path: '/clima' },
  { question: '¿Puedo obtener un pronóstico?', words: ['pronostico', 'futuro', 'mañana', 'proyeccion', 'prediccion'], answer: 'No hay pronóstico diario ni proyección validada para años futuros. La referencia de 1983–2025 permite describir meses históricos equivalentes, no predecir fechas futuras.', path: '/clima' },
  { question: '¿Cómo se eligen los cultivos?', words: ['cultivo', 'cultivos', 'recomienda', 'sembrar', 'ciclo'], answer: 'Cultivos y rotaciones compara todos los meses del ciclo con temperaturas históricas y fichas FAO. Son candidatos exploratorios, no recetas validadas localmente. Verifica agua, suelo y altitud con un profesional.', path: '/agricultura' },
  { question: '¿Qué hace comparar rotaciones?', words: ['rotacion', 'rotaciones', 'estrategia', 'familia', 'familias', 'plaga', 'enfermedad', 'asociacion'], answer: 'Introduce tres estrategias con cultivos separados por comas. Se compara la diversidad de familias y se señala si faltan fichas. Alternar familias es una pauta general; no garantiza controlar plagas o enfermedades.', path: '/agricultura' },
  { question: '¿Dónde veo mi historial?', words: ['historial', 'registro', 'siembra', 'cosecha'], answer: 'Mi historial permite seleccionar una parcela, registrar siembras y cosechas, editar registros y ver sus análisis guardados. Cada parcela tiene su propia línea de tiempo.', path: '/historial' },
  { question: '¿Cómo cambio mi contraseña?', words: ['contraseña', 'perfil', 'cuenta', 'correo'], answer: 'En Mi perfil puedes editar tu nombre y correo y cambiar la contraseña. Para recuperar el acceso, usa el enlace de la pantalla de inicio de sesión.', path: '/perfil' },
  { question: '¿Qué es GIBS?', words: ['gibs', 'satelite', 'capa', 'modis'], answer: 'NASA GIBS agrega una imagen satelital visual al mapa. Puedes elegir su fecha. No se extraen de esa imagen valores numéricos de tu parcela.', path: '/parcelas' },
]

const englishWords = [
  ['create', 'plot', 'draw', 'polygon'], ['country', 'search', 'map'], ['edit', 'delete', 'plot'],
  ['import', 'geojson', 'file'], ['export', 'download'], ['climate', 'weather', 'nasa'],
  ['soil', 'moisture'], ['frost', 'cold'], ['forecast', 'prediction'],
  ['crops', 'crop', 'select'], ['rotation', 'rotations', 'family', 'pest'],
  ['history', 'record', 'harvest'], ['password', 'account', 'profile'], ['gibs', 'satellite'],
]

function normalize(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
export function answerHelp(question) {
  const words = normalize(question).match(/[a-z0-9]+/g) || []
  const scored = helpTopics.map((topic, index) => ({
    topic, score: [...topic.words, ...englishWords[index]].reduce((score, word) => score + (words.includes(word) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score)
  return scored[0]?.score ? scored[0].topic : {
    answer: 'No tengo una respuesta verificada para esa pregunta. Prueba con «parcelas», «clima», «cultivos» o «historial», o contacta a un profesional para dudas agronómicas.',
    path: null,
  }
}
