import { DARK_CHART_COLORS, LIGHT_CHART_COLORS, type ChartColors } from '@/components/charts/chartTheme'
import { useTheme } from '@/hooks/useTheme'

/** Chart colours for the current light/dark mode; charts repaint when it changes. */
export function useChartColors(): ChartColors {
  return useTheme().resolved === 'dark' ? DARK_CHART_COLORS : LIGHT_CHART_COLORS
}
