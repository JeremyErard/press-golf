/**
 * Press Golf App - Lux-Utility Design System
 * "Augusta National meets Robinhood"
 *
 * Design Philosophy:
 * - Luxury: Generous padding, subtle gradients, rich colors
 * - Utility: High contrast, massive touch targets, sunlight-readable
 */

export const colors = {
  // Backgrounds (Rich Dark Theme)
  background: {
    primary: '#0F172A',      // Deep Slate - Main background
    surface: '#1E293B',       // Slightly lighter for cards/modals
    elevated: '#334155',      // Even lighter for hover states
  },

  // Brand & Action
  brand: {
    primary: '#10B981',       // Emerald - Primary actions, money won
    primaryDark: '#059669',   // Darker emerald for pressed states
    accent: '#D97706',        // Augusta Gold - Betting highlights, premium
    accentLight: '#F59E0B',   // Lighter gold for badges
  },

  // Text
  text: {
    primary: '#FFFFFF',       // Pure white - Maximum contrast
    secondary: '#94A3B8',     // Muted blue-gray for labels
    tertiary: '#64748B',      // Even more muted for hints
    inverse: '#0F172A',       // Dark text on light backgrounds
  },

  // Functional
  functional: {
    success: '#10B981',       // Emerald - Money won, positive
    error: '#EF4444',         // Soft red - Money owed, negative
    warning: '#F59E0B',       // Amber - Warnings, attention
    info: '#3B82F6',          // Blue - Information
  },

  // Borders & Dividers
  border: {
    default: '#334155',       // Subtle border for cards
    focus: '#10B981',         // Emerald for focus states
    active: '#10B981',        // Green border for active items
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  // Hero Stats (Career Earnings)
  hero: {
    fontSize: 48,
    fontWeight: '800' as const,
    lineHeight: 56,
  },
  // Large Numbers (Scores)
  score: {
    fontSize: 36,
    fontWeight: '700' as const,
    lineHeight: 44,
  },
  // Section Headers
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h3: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  // Body Text
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  // Small Text
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  captionBold: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  // Labels
  label: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
} as const;

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

// Component-specific styles
export const components = {
  // Buttons
  button: {
    height: 56,           // Tall for easy tapping
    paddingHorizontal: 24,
    borderRadius: borderRadius.md,
  },

  // Cards
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.surface,
    padding: spacing.lg,
  },

  // Active Round Card (with green border)
  activeCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    backgroundColor: colors.background.surface,
    padding: spacing.lg,
  },

  // Score Input Row
  scoreRow: {
    height: 72,           // Min 72px for thumb-friendly input
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  // Score Button (Plus/Minus)
  scoreButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.primary,
  },

  // Tab Bar
  tabBar: {
    height: 84,
    paddingBottom: 20,    // For home indicator
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },

  // Hole Selector
  holeSelector: {
    itemSize: 36,
    activeItemSize: 40,
    gap: spacing.sm,
  },
} as const;

// Betting Status Banner Gradient
export const gradients = {
  heroCard: ['#0F172A', '#1E293B'],           // Subtle dark gradient
  goldBanner: ['#D97706', '#F59E0B'],         // Gold gradient for betting status
  greenButton: ['#10B981', '#059669'],        // Emerald gradient for buttons
} as const;

// Export theme object
export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  components,
  gradients,
} as const;

export type Theme = typeof theme;
export default theme;
