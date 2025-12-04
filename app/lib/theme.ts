/**
 * Color Theme System
 * Based on Refactoring UI principles (Pages 119, 123, 129, 133, 139, 142)
 * 
 * All colors use HSL for better relationships and easier shade generation.
 * Login gradient colors (#667eea → #764ba2) are the foundation.
 */

export const themeColors = {
  // Primary: Indigo-Purple (from login gradient)
  // Base: hsl(252, 70%, 60%) ≈ #667eea
  primary: {
    50: 'hsl(252, 70%, 98%)',
    100: 'hsl(252, 70%, 95%)',
    200: 'hsl(252, 70%, 90%)',
    300: 'hsl(252, 70%, 80%)',
    400: 'hsl(252, 70%, 70%)',
    500: 'hsl(252, 70%, 60%)', // Base - login gradient start
    600: 'hsl(252, 70%, 50%)',
    700: 'hsl(252, 70%, 40%)',
    800: 'hsl(252, 70%, 30%)',
    900: 'hsl(252, 70%, 20%)',
  },

  // Purple (from login gradient end)
  // Base: hsl(270, 50%, 60%) ≈ #764ba2
  purple: {
    50: 'hsl(270, 50%, 98%)',
    100: 'hsl(270, 50%, 95%)',
    200: 'hsl(270, 50%, 90%)',
    300: 'hsl(270, 50%, 80%)',
    400: 'hsl(270, 50%, 70%)',
    500: 'hsl(270, 50%, 60%)', // Base - login gradient end
    600: 'hsl(270, 50%, 50%)',
    700: 'hsl(270, 50%, 40%)',
    800: 'hsl(270, 50%, 30%)',
    900: 'hsl(270, 50%, 20%)',
  },

  // Success: Green (for completed, success states)
  // Base: hsl(142, 70%, 45%)
  success: {
    50: 'hsl(142, 70%, 98%)',
    100: 'hsl(142, 70%, 95%)',
    200: 'hsl(142, 70%, 90%)',
    300: 'hsl(142, 70%, 80%)',
    400: 'hsl(142, 70%, 70%)',
    500: 'hsl(142, 70%, 45%)',
    600: 'hsl(142, 70%, 40%)',
    700: 'hsl(142, 70%, 35%)',
    800: 'hsl(142, 70%, 25%)',
    900: 'hsl(142, 70%, 20%)',
  },

  // Warning: Amber (for pending, warnings, DirectProd)
  // Base: hsl(43, 96%, 56%)
  warning: {
    50: 'hsl(43, 96%, 98%)',
    100: 'hsl(43, 96%, 95%)',
    200: 'hsl(43, 96%, 90%)',
    300: 'hsl(43, 96%, 80%)',
    400: 'hsl(43, 96%, 70%)',
    500: 'hsl(43, 96%, 56%)',
    600: 'hsl(43, 96%, 50%)',
    700: 'hsl(43, 96%, 40%)',
    800: 'hsl(43, 96%, 30%)',
    900: 'hsl(43, 96%, 25%)',
  },

  // Error: Red (for errors, production database, danger)
  // Base: hsl(0, 84%, 60%)
  error: {
    50: 'hsl(0, 84%, 98%)',
    100: 'hsl(0, 84%, 95%)',
    200: 'hsl(0, 84%, 90%)',
    300: 'hsl(0, 84%, 80%)',
    400: 'hsl(0, 84%, 70%)',
    500: 'hsl(0, 84%, 60%)',
    600: 'hsl(0, 84%, 50%)',
    700: 'hsl(0, 84%, 40%)',
    800: 'hsl(0, 84%, 30%)',
    900: 'hsl(0, 84%, 25%)',
  },

  // Info: Blue (for staging, ready for prod, info states)
  // Base: hsl(217, 91%, 60%)
  info: {
    50: 'hsl(217, 91%, 98%)',
    100: 'hsl(217, 91%, 95%)',
    200: 'hsl(217, 91%, 90%)',
    300: 'hsl(217, 91%, 80%)',
    400: 'hsl(217, 91%, 70%)',
    500: 'hsl(217, 91%, 60%)',
    600: 'hsl(217, 91%, 50%)',
    700: 'hsl(217, 91%, 40%)',
    800: 'hsl(217, 91%, 30%)',
    900: 'hsl(217, 91%, 25%)',
  },

  // Neutral: Tinted Gray (blue-purple tint for brand consistency)
  // Base: hsl(220, 15%, 50%) - slightly tinted toward brand colors
  neutral: {
    50: 'hsl(220, 15%, 98%)',
    100: 'hsl(220, 15%, 95%)',
    200: 'hsl(220, 15%, 90%)',
    300: 'hsl(220, 15%, 85%)',
    400: 'hsl(220, 15%, 70%)',
    500: 'hsl(220, 15%, 50%)',
    600: 'hsl(220, 15%, 40%)',
    700: 'hsl(220, 15%, 30%)',
    800: 'hsl(220, 15%, 20%)',
    900: 'hsl(220, 15%, 15%)',
  },
};

/**
 * Background colors for page and components
 */
export const backgrounds = {
  // Body gradient: subtle purple-tinted
  bodyStart: 'hsl(250, 30%, 98%)',
  bodyMid: 'hsl(250, 20%, 99%)',
  bodyEnd: 'hsl(250, 30%, 98%)',
  
  // Kanban columns: slightly darker than body, same tint
  kanban: 'hsl(250, 25%, 97%)',
  
  // Cards: pure white
  card: 'hsl(0, 0%, 100%)',
};

/**
 * Helper to convert HSL object to CSS string
 */
export function hslToCss(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

