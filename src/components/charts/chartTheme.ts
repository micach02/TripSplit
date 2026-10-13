/**
 * Chart tokens — the dataviz reference palette. Categorical hues are assigned
 * in this fixed order, never cycled or generated. Read them through
 * useChartColors(), which picks the set for the current light/dark mode.
 */
export interface ChartColors {
  series: readonly string[]
  /** "Other" / de-emphasis — neutral, never a hue. */
  neutral: string
  /** The card behind the chart: gaps between slices and rings around dots */
  surface: string
  grid: string
  baseline: string
  inkSecondary: string
  /** Axis tick text */
  axisTick: { fill: string; fontSize: number }
}

/**
 * Validated against the white card (scripts/validate_palette.js: slots 1–5 pass
 * every gate; slots 3–5 are below 3:1 contrast, so every chart ships a visible
 * legend/table).
 */
export const LIGHT_CHART_COLORS: ChartColors = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  neutral: '#898781',
  surface: '#ffffff',
  grid: '#e8e7e1',
  baseline: '#c3c2b7',
  inkSecondary: '#52514e',
  axisTick: { fill: '#898781', fontSize: 12 },
}

/**
 * The same eight hues stepped for the dark card (#131822): every slot passes
 * every gate there, all at 3:1 or better.
 */
export const DARK_CHART_COLORS: ChartColors = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  neutral: '#898781',
  surface: '#131822',
  grid: '#262d39',
  baseline: '#3a4250',
  inkSecondary: '#c3c2b7',
  axisTick: { fill: '#9a9da6', fontSize: 12 },
}

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
