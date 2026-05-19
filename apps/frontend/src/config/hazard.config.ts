/** Per-hazard-type scenario presets. null = no scenario applies (faultline). */
export const HAZARD_SCENARIO_PRESETS: Record<string, string[] | null> = {
  flood:       ['5yr', '25yr', '100yr'],
  landslide:   ['5yr', '25yr', '100yr'],
  storm_surge: ['ssa1', 'ssa2', 'ssa3', 'ssa4'],
  debris_flow: ['5yr', '25yr', '100yr'],
  faultline:   null,
}

export const HAZARD_DEFAULT_SCENARIOS: Record<string, string | null> = {
  flood:       '100yr',
  landslide:   '100yr',
  storm_surge: 'ssa1',
  debris_flow: '100yr',
  faultline:   null,
}

export const SCENARIO_LABELS: Record<string, string> = {
  '5yr':   '5-Year Return Period',
  '25yr':  '25-Year Return Period',
  '100yr': '100-Year Return Period',
  'ssa1':  'Storm Surge Level 1 (≤1 m)',
  'ssa2':  'Storm Surge Level 2 (1–3 m)',
  'ssa3':  'Storm Surge Level 3 (3–5 m)',
  'ssa4':  'Storm Surge Level 4 (>5 m)',
}

export const HAZARD_TYPE_LABELS: Record<string, string> = {
  flood:       'Flood',
  landslide:   'Landslide',
  storm_surge: 'Storm Surge',
  debris_flow: 'Debris Flow',
  faultline:   'Faultline',
}

export const ZONE_TYPE_LABELS: Record<string, string> = {
  residential: 'Residential',
  commercial:  'Commercial',
  industrial:  'Industrial',
  agriculture: 'Agriculture',
}

export function getDefaultScenario(hazardType: string): string | null {
  return HAZARD_DEFAULT_SCENARIOS[hazardType] ?? null
}
