// Keys match the independent, sourced phase-3 backend crop profiles.
export const shortCycleCrops = [
  { id: 'cilantro', name: 'Cilantro' },
  { id: 'rabano', name: 'Rábano' },
  { id: 'rucula', name: 'Rúcula' },
  { id: 'lechuga_hoja', name: 'Lechuga de hoja tierna' },
  { id: 'espinaca', name: 'Espinaca' },
]
export const observationDays = [4, 7, 45]
// No fertilizer products or application rates are defined in phase 1.
export const fertilizerSlots = Array.from({ length: 10 }, (_, index) => index + 1)
