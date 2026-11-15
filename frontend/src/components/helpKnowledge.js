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

function normalize(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
const englishHelp = {
  '¿Cómo creo una parcela?': {
    question: 'How do I create a parcel?',
    words: ['create', 'parcel', 'land', 'draw'],
    answer: 'In My parcels, search for a location or country, use the map polygon tool, mark the vertices, and select Save parcel. The area is calculated on the server.',
  },
  '¿Cómo busco un país?': {
    question: 'How do I search for a country?',
    words: ['country', 'search', 'map', 'location'],
    answer: 'Search for a country or select it in Parcel details. The map will center on it and place a marker on the result. This does not restrict where you can draw.',
  },
  '¿Cómo edito o elimino una parcela?': {
    question: 'How do I edit or delete a parcel?',
    words: ['edit', 'delete', 'remove', 'vertices'],
    answer: 'In My parcels, choose a parcel and use the map editing controls. Save to keep the changes. Delete parcel asks for confirmation and also deletes its history.',
  },
  '¿Cómo importo GeoJSON?': {
    question: 'How do I import GeoJSON?',
    words: ['import', 'file', 'geojson', 'upload'],
    answer: 'Import GeoJSON opens a .geojson or .json file containing a polygon. After importing, check the country and select Save parcel. Importing alone does not save changes.',
  },
  '¿Para qué sirve Exportar?': {
    question: 'What does Export do?',
    words: ['export', 'download', 'geojson'],
    answer: 'Export downloads a copy of the current polygon as parcela.geojson. It does not send or delete information.',
  },
  '¿Cómo uso el clima?': {
    question: 'How do I use climate data?',
    words: ['climate', 'nasa', 'power', 'temperature', 'rain', 'precipitation'],
    answer: 'In Climate history, choose a parcel and select Query data to compare three years, or query the historical series for months from 1983–2025. These are regional values, not sensors on your farm.',
  },
  '¿Qué indica la humedad del suelo?': {
    question: 'What does soil moisture indicate?',
    words: ['moisture', 'soil', 'gwet'],
    answer: 'Overview shows NASA POWER’s GWETTOP surface index converted from 0–1 to a percentage. It is not a soil analysis or volumetric moisture measurement on your parcel.',
  },
  '¿Qué significan las heladas?': {
    question: 'What does the frost information mean?',
    words: ['frost', 'cold', 'risk', 'probability'],
    answer: 'Overview shows the percentage of past days with a minimum below 0 °C in the latest complete month. The long-term history compares monthly means of daily minimum temperatures; it does not count frost months. Neither value predicts frost tomorrow.',
  },
  '¿Puedo obtener un pronóstico?': {
    question: 'Can I get a forecast?',
    words: ['forecast', 'future', 'tomorrow', 'projection', 'prediction'],
    answer: 'There is no daily forecast or validated projection for future years. The 1983–2025 reference describes equivalent historical months; it does not predict future dates.',
  },
  '¿Cómo se eligen los cultivos?': {
    question: 'How are crops selected?',
    words: ['crop', 'crops', 'recommend', 'plant', 'cycle'],
    answer: 'Crops and rotations compares every month in a cycle with historical temperatures and FAO profiles. These are exploratory candidates, not locally validated recommendations. Check water, soil, and elevation with a professional.',
  },
  '¿Qué hace comparar rotaciones?': {
    question: 'What does rotation comparison do?',
    words: ['rotation', 'strategy', 'family', 'pest', 'disease', 'intercropping'],
    answer: 'Enter three strategies with crops separated by commas. The app compares family diversity and notes missing profiles. Alternating families is a general guideline; it does not guarantee pest or disease control.',
  },
  '¿Dónde veo mi historial?': {
    question: 'Where can I see my history?',
    words: ['history', 'record', 'planting', 'harvest'],
    answer: 'My history lets you select a parcel, record planting and harvest dates, edit records, and view saved analyses. Each parcel has its own timeline.',
  },
  '¿Cómo cambio mi contraseña?': {
    question: 'How do I change my password?',
    words: ['password', 'profile', 'account', 'email'],
    answer: 'In My profile, you can edit your name and email and change your password. To recover access, use the link on the sign-in screen.',
  },
  '¿Qué es GIBS?': {
    question: 'What is GIBS?',
    words: ['gibs', 'satellite', 'layer', 'modis'],
    answer: 'NASA GIBS adds a visual satellite image to the map. You can choose its date. It does not extract numeric measurements for your parcel.',
  },
}

for (const topic of helpTopics) {
  const translation = englishHelp[topic.question]
  topic.question_en = translation.question
  topic.answer_en = translation.answer
  topic.words_en = translation.words
}

export function answerHelp(question, language = 'es') {
  const words = normalize(question).match(/[a-z0-9]+/g) || []
  const scored = helpTopics.map(topic => ({
    topic, score: (topic.words || []).concat(language === 'en' ? topic.words_en || topic.words : []).reduce((score, word) => score + (words.includes(word) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score)
  if (scored[0]?.score) {
    const topic = scored[0].topic
    return language === 'en' ? { ...topic, question: topic.question_en || topic.question, answer: topic.answer_en || topic.answer } : topic
  }
  return {
    answer: language === 'en'
      ? 'I do not have a verified answer to that question. Try “parcels”, “climate”, “crops”, or “history”, or contact a professional for agronomic questions.'
      : 'No tengo una respuesta verificada para esa pregunta. Prueba con «parcelas», «clima», «cultivos» o «historial», o contacta a un profesional para dudas agronómicas.',
    path: null,
  }
}
