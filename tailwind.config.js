/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Spacing scale based on Refactoring UI principles (Page 60)
      // Constrained set: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
      spacing: {
        '3': '12px',  // 0.75rem - for tight spacing
        '4': '16px',  // 1rem - base unit
        '6': '24px',  // 1.5rem - medium spacing
        '8': '32px',  // 2rem - large spacing
        '12': '48px', // 3rem - extra large spacing
        '16': '64px', // 4rem - section spacing
      },
      // Color system based on Refactoring UI principles (Pages 119, 123, 129)
      // All colors use HSL for better relationships
      // Login gradient colors (#667eea → #764ba2) are the foundation
      colors: {
        primary: {
          50: 'hsl(252, 70%, 98%)',
          100: 'hsl(252, 70%, 95%)',
          200: 'hsl(252, 70%, 90%)',
          300: 'hsl(252, 70%, 80%)',
          400: 'hsl(252, 70%, 70%)',
          500: 'hsl(252, 70%, 60%)', // Base - login gradient start #667eea
          600: 'hsl(252, 70%, 50%)',
          700: 'hsl(252, 70%, 40%)',
          800: 'hsl(252, 70%, 30%)',
          900: 'hsl(252, 70%, 20%)',
        },
        purple: {
          50: 'hsl(270, 50%, 98%)',
          100: 'hsl(270, 50%, 95%)',
          200: 'hsl(270, 50%, 90%)',
          300: 'hsl(270, 50%, 80%)',
          400: 'hsl(270, 50%, 70%)',
          500: 'hsl(270, 50%, 60%)', // Base - login gradient end #764ba2
          600: 'hsl(270, 50%, 50%)',
          700: 'hsl(270, 50%, 40%)',
          800: 'hsl(270, 50%, 30%)',
          900: 'hsl(270, 50%, 20%)',
        },
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
      },
    },
  },
  plugins: [],
}

