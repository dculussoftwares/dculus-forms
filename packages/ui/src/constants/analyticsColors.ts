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
   * Primary color palette - Used for main data series in charts
   * Vibrant, high-contrast colors suitable for categorical data
   */
  primary: [
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#06d6a0', // Teal
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#10b981', // Green
    '#f97316', // Orange
    '#8b5a2b', // Brown
  ],

  /**
   * Secondary color palette - Used for backgrounds, hover states, and secondary data
   * Lighter, softer versions of primary colors
   */
  secondary: [
    '#dbeafe', // Light Blue
    '#e7d3ff', // Light Purple
    '#ccfbf1', // Light Teal
    '#fef3c7', // Light Amber
    '#fecaca', // Light Red
    '#d1fae5', // Light Green
    '#fed7aa', // Light Orange
    '#e7e5e4', // Light Gray
  ],

  /**
   * Gradient color palette - Used for heat maps, trend lines, and visual interest
   * Creates smooth transitions between related data points
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
   * Mini chart color palette - Used for small preview charts and sparklines
   * Subset of primary colors optimized for small visualizations
   */
  mini: [
    '#3B82F6', // Blue (capitalized for consistency with legacy)
    '#8B5CF6', // Purple
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#6B7280', // Gray
  ],

  /**
   * Monochrome palette - Used for single-series charts and minimalist designs
   * Shades of blue from light to dark
   */
  monochrome: [
    '#eff6ff', // Blue-50
    '#dbeafe', // Blue-100
    '#bfdbfe', // Blue-200
    '#93c5fd', // Blue-300
    '#60a5fa', // Blue-400
    '#3b82f6', // Blue-500
    '#2563eb', // Blue-600
    '#1d4ed8', // Blue-700
  ],

  /**
   * Semantic colors - Used for status indicators and meaningful data
   */
  semantic: {
    success: '#10b981',     // Green
    warning: '#f59e0b',     // Amber
    error: '#ef4444',       // Red
    info: '#3b82f6',        // Blue
    neutral: '#6b7280',     // Gray
  },

  /**
   * Heatmap colors - Used for density visualizations and heatmaps
   * Progressive intensity from low to high
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
   * Diverging palette - Used for showing positive/negative variance
   * Useful for comparison charts and deviation analysis
   */
  diverging: {
    negative: [
      '#fecaca', // Light red
      '#f87171', // Medium red
      '#ef4444', // Red
      '#dc2626', // Dark red
    ],
    neutral: '#f3f4f6', // Gray
    positive: [
      '#d1fae5', // Light green
      '#6ee7b7', // Medium green
      '#10b981', // Green
      '#059669', // Dark green
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
