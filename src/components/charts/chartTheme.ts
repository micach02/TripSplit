/**
 * Chart tokens — the dataviz reference palette, validated for this app's white
 * card surface (scripts/validate_palette.js: slots 1–5 pass every gate; slots
 * 3–5 are below 3:1 contrast, so every chart ships a visible legend/table).
 * Categorical hues are assigned in this fixed order, never cycled or generated.
 */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'] as const

/** "Other" / de-emphasis — neutral, never a hue. */
export const NEUTRAL = '#898781'

export const SURFACE = '#ffffff'
export const GRID = '#e8e7e1'
export const BASELINE = '#c3c2b7'
export const INK = '#0b0b0b'
export const INK_SECONDARY = '#52514e'
export const INK_MUTED = '#898781'

/** Axis tick text */
export const AXIS_TICK = { fill: INK_MUTED, fontSize: 12 } as const

/**
 * A round axis maximum and evenly spaced round ticks covering `value`:
 * 8,400 → max 10,000, ticks 0 / 2,500 / 5,000 / 7,500 / 10,000.
 */
export function niceScale(value: number): { max: number; ticks: number[] } {
  if (!(value > 0)) return { max: 1, ticks: [0, 1] }
  const base = 10 ** Math.floor(Math.log10(value))
  const fraction = value / base
  const [nice, step] =
    fraction <= 1 ? [1, 0.25] : fraction <= 2 ? [2, 0.5] : fraction <= 2.5 ? [2.5, 0.5] : fraction <= 5 ? [5, 1] : [10, 2.5]
  const max = nice * base
  const ticks: number[] = []
  for (let tick = 0; tick <= max + 1e-9; tick += step * base) ticks.push(Math.round(tick * 1e6) / 1e6)
  return { max, ticks }
}

const compactFormatters = new Map<string, Intl.NumberFormat>()

/** Axis ticks: "₱20K", "¥1.2M" — clean, comma-free and short. */
export function formatCompact(value: number, symbol: string): string {
  const key = 'compact'
  let formatter = compactFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
    compactFormatters.set(key, formatter)
  }
  return `${value < 0 ? '-' : ''}${symbol}${formatter.format(Math.abs(value))}`
}
