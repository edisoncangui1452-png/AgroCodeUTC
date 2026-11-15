/** Traditional practice mapping requested for this calendar; it is not agronomic evidence. */
export const LUNAR_AGRICULTURAL_RULES = Object.freeze({
  phases: {
    new: {
      title: 'Luna Nueva',
      principalPhaseKey: 'new',
      recommendation: 'No sembrar / Descanso y preparación',
      guide: 'No sembrar / Descanso y preparación',
      activityKeys: [],
      intermediateSupportIconKey: 'watering',
    },
    waxing: {
      title: 'Creciente',
      principalPhaseKey: 'first-quarter',
      recommendation: 'Siembra de hojas / Siembra de flores',
      guide: 'Siembra de hojas / Siembra de flores',
      activityKeys: ['leaves', 'flowers'],
      intermediateSupportIconKey: 'roots',
    },
    full: {
      title: 'Luna Llena',
      principalPhaseKey: 'full',
      recommendation: 'Cosecha general / Recolección',
      guide: 'Cosecha general / Recolección',
      activityKeys: ['harvest'],
      intermediateSupportIconKey: 'watering',
    },
    waning: {
      title: 'Cuarto Menguante',
      principalPhaseKey: 'last-quarter',
      recommendation: 'Poda de formación / Control de plagas',
      guide: 'Poda de formación / Control de plagas',
      activityKeys: ['pruning', 'pests'],
      intermediateSupportIconKey: 'roots',
    },
  },
  principalPhaseToRule: {
    new: 'new',
    'first-quarter': 'waxing',
    full: 'full',
    'last-quarter': 'waning',
  },
  activityLegend: [
    { key: 'pruning', label: 'Poda', icon: 'scissors' },
    { key: 'roots', label: 'Siembra de Raíces', icon: 'carrot' },
    { key: 'leaves', label: 'Siembra de Hojas', icon: 'leaf' },
    { key: 'flowers', label: 'Siembra de Flores', icon: 'flower' },
    { key: 'harvest', label: 'Recolección', icon: 'apple' },
    { key: 'watering', label: 'Riego/Abonado', icon: 'droplets' },
    { key: 'pests', label: 'Control de Plagas', icon: 'bug' },
  ],
})

const PHASE_TARGET_RULES = ['new', 'waxing', 'full', 'waning']

/** Intermediate dates inherit the next principal phase and one direction-based support icon. */
export function getLunarAgriculturalRule(lunarDay) {
  if (!lunarDay) return { title: 'Dato no disponible', recommendation: 'Dato no disponible', guide: 'Dato no disponible', activityKeys: [], supportIconKey: null, intermediate: false }

  const isPrincipal = Boolean(lunarDay.principalPhase)
  let ruleKey
  if (isPrincipal) {
    ruleKey = LUNAR_AGRICULTURAL_RULES.principalPhaseToRule[lunarDay.principalPhase]
  } else {
    const nextPhaseStep = (Math.floor(lunarDay.phase * 4 + 1e-9) + 1) % 4
    ruleKey = PHASE_TARGET_RULES[nextPhaseStep]
  }

  const phaseRule = LUNAR_AGRICULTURAL_RULES.phases[ruleKey]
  if (!phaseRule) return { title: 'Dato no disponible', recommendation: 'Dato no disponible', guide: 'Dato no disponible', activityKeys: [], supportIconKey: null, intermediate: false }

  const supportIconKey = isPrincipal
    ? null
    : phaseRule.intermediateSupportIconKey
  return {
    ...phaseRule,
    activityKeys: [...phaseRule.activityKeys, ...(supportIconKey ? [supportIconKey] : [])],
    supportIconKey,
    intermediate: !isPrincipal,
  }
}
