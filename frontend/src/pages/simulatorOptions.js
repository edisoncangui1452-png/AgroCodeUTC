// UI-only options. These five names match the existing FAO reference catalog.
// Durations below are observation modes, not crop-cycle or harvest forecasts.
export const shortCycleCrops = ['Lechuga', 'Zanahoria', 'Rábano', 'Arveja', 'Repollo']
export const observationDays = [4, 7, 45]
// No fertilizer products or application rates are defined in phase 1.
export const fertilizerSlots = Array.from({ length: 10 }, (_, index) => index + 1)
