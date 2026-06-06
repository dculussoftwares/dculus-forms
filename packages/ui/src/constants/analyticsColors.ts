/**
 * Analytics Colors
 *
 * Centralized color palettes for analytics charts and visualizations.
 * This module provides consistent color schemes across all analytics components.
 *
 * Usage:
 * ```typescript
 * import { ANALYTICS_COLORS, useAnalyticsColors } from '@dculus/ui';
 *
 * const colors = useAnalyticsColors('primary');
 * const miniColors = ANALYTICS_COLORS.mini;
 * ```
 */

/**
 * Color palette for analytics charts
 * Provides multiple color schemes for different visualization contexts
 */
export const ANALYTICS_COLORS = {
  /**
   * Primary color palette - Typeform design system aligned, vivid and chart-readable.
   * Hue angles match --chart-1…5 CSS variables, boosted saturation for legibility.
   */
  primary: [
    '#7C3AAE', // Violet  (matches --chart-1 hue)
    '#0E8C70', // Emerald (matches --chart-2 hue)
    '#2563EB', // Blue    (matches --chart-3 hue)
    '#D97706', // Amber
    '#E85D4A', // Coral   (matches --chart-5 hue)
    '#9B5CB5', // Soft violet (6th+ series)
    '#1D7A64', // Deep emerald
    '#1E50C8', // Deep blue
  ],

  /**
   * Secondary color palette - Light tints of primary colors for backgrounds/hover states.
   */
  secondary: [
    '#f0ebff', // Light violet
    '#e6f7f4', // Light emerald
    '#e8f0fe', // Light blue
    '#fef3e2', // Light amber
    '#fdecea', // Light coral
    '#ede9fe', // Soft violet
    '#d1fae5', // Soft emerald
    '#dbeafe', // Soft blue
  ],

  /**
   * Gradient color palette - Used for heat maps, trend lines, and visual interest.
   */
  gradient: [
    '#667eea', // Blue-purple start
    '#764ba2', // Purple
    '#f093fb', // Pink-purple
    '#f5576c', // Pink-red
    '#4facfe', // Sky blue
    '#00f2fe', // Cyan
    '#43e97b', // Lime green
    '#38f9d7', // Aqua
  ],

  /**
   * Mini chart color palette - Subset of primary palette for small preview charts.
   */
  mini: [
    '#7C3AAE', // Violet
    '#0E8C70', // Emerald
    '#2563EB', // Blue
    '#D97706', // Amber
    '#E85D4A', // Coral
    '#9B5CB5', // Soft violet
  ],

  /**
   * Monochrome palette - Aubergine tonal ramp derived from --primary for single-series charts.
   */
  monochrome: [
    '#f7f4f8', // aubergine-50
    '#ebe7ec', // aubergine-100
    '#c9c0cc', // aubergine-200
    '#a99aad', // aubergine-300
    '#7d6a82', // aubergine-400
    '#5c4d60', // aubergine-500
    '#3c323e', // aubergine-600 (--primary)
    '#2a2230', // aubergine-700
  ],

  /**
   * Semantic colors - Status indicators aligned to the Typeform design system.
   */
  semantic: {
    success: '#0E8C70', // Emerald
    warning: '#D97706', // Amber
    error:   '#E85D4A', // Coral
    info:    '#2563EB', // Blue
    neutral: '#a09aa2', // Muted foreground
  },

  /**
   * Heatmap colors - Used for density visualizations and heatmaps.
   */
  heatmap: [
    '#f0fdf4', // Very low
    '#bbf7d0', // Low
    '#86efac', // Medium-low
    '#4ade80', // Medium
    '#22c55e', // Medium-high
    '#16a34a', // High
    '#15803d', // Very high
    '#14532d', // Extreme
  ],

  /**
   * Diverging palette - Aligned to Typeform semantic colors for variance charts.
   */
  diverging: {
    negative: [
      '#fdecea', // Light coral
      '#f4a79e', // Medium coral
      '#E85D4A', // Coral
      '#c0392b', // Dark red
    ],
    neutral: '#f3f4f6',
    positive: [
      '#e6f7f4', // Light emerald
      '#6ee7b7', // Medium emerald
      '#0E8C70', // Emerald
      '#065f46', // Dark emerald
    ],
  },
} as const;

/**
 * Type for color palette variants
 */
export type AnalyticsColorVariant = keyof typeof ANALYTICS_COLORS;

/**
 * Type for semantic color keys
 */
export type SemanticColorKey = keyof typeof ANALYTICS_COLORS.semantic;

/**
 * Hook to get analytics colors for a specific variant
 *
 * @param variant - The color palette variant to retrieve
 * @returns Array of color hex codes
 *
 * @example
 * ```typescript
 * const MyChart = () => {
 *   const colors = useAnalyticsColors('primary');
 *   return <BarChart colors={colors} ... />;
 * };
 * ```
 */
export const useAnalyticsColors = (
  variant: Exclude<AnalyticsColorVariant, 'semantic' | 'diverging'> = 'primary'
): readonly string[] => {
  return ANALYTICS_COLORS[variant];
};

/**
 * Get a color by index from a specific palette
 * Cycles through colors if index exceeds palette length
 *
 * @param variant - The color palette variant
 * @param index - Index of the color to retrieve
 * @returns Hex color code
 *
 * @example
 * ```typescript
 * const color = getAnalyticsColor('primary', 0); // '#3b82f6'
 * const color2 = getAnalyticsColor('primary', 10); // Cycles back to '#3b82f6'
 * ```
 */
export const getAnalyticsColor = (
  variant: Exclude<AnalyticsColorVariant, 'semantic' | 'diverging'>,
  index: number
): string => {
  const colors = ANALYTICS_COLORS[variant];
  return colors[index % colors.length];
};

/**
 * Get a semantic color by key
 *
 * @param key - Semantic color key (success, warning, error, info, neutral)
 * @returns Hex color code
 *
 * @example
 * ```typescript
 * const successColor = getSemanticColor('success'); // '#10b981'
 * const errorColor = getSemanticColor('error'); // '#ef4444'
 * ```
 */
export const getSemanticColor = (key: SemanticColorKey): string => {
  return ANALYTICS_COLORS.semantic[key];
};

/**
 * Generate a color scale for a given number of data points
 * Interpolates colors from a palette to match the number of items
 *
 * @param count - Number of colors needed
 * @param variant - Color palette variant to use
 * @returns Array of color hex codes
 *
 * @example
 * ```typescript
 * const colors = generateColorScale(15, 'primary'); // Returns 15 colors
 * ```
 */
export const generateColorScale = (
  count: number,
  variant: Exclude<AnalyticsColorVariant, 'semantic' | 'diverging'> = 'primary'
): string[] => {
  const colors = ANALYTICS_COLORS[variant];
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    result.push(colors[i % colors.length]);
  }

  return result;
};

/**
 * Get opacity-adjusted color
 * Useful for creating hover states and overlays
 *
 * @param colorHex - Hex color code
 * @param opacity - Opacity value (0-1)
 * @returns RGBA color string
 *
 * @example
 * ```typescript
 * const semiTransparent = getColorWithOpacity('#3b82f6', 0.5);
 * // Returns: 'rgba(59, 130, 246, 0.5)'
 * ```
 */
export const getColorWithOpacity = (
  colorHex: string,
  opacity: number
): string => {
  // Remove # if present
  const hex = colorHex.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Return RGBA string
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Get contrasting text color (black or white) for a given background color
 * Uses relative luminance calculation for accessibility
 *
 * @param backgroundHex - Hex color code of background
 * @returns '#000000' or '#ffffff' depending on contrast
 *
 * @example
 * ```typescript
 * const textColor = getContrastingTextColor('#3b82f6'); // '#ffffff'
 * const textColor2 = getContrastingTextColor('#fef3c7'); // '#000000'
 * ```
 */
export const getContrastingTextColor = (backgroundHex: string): string => {
  // Remove # if present
  const hex = backgroundHex.replace('#', '');

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance threshold
  return luminance > 0.5 ? '#000000' : '#ffffff';
};
