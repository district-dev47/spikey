/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF69B4', // Hot Pink
          dark: '#FF1493', // Deep Pink
        },
        secondary: {
          DEFAULT: '#1B3B6F', // Dark Blue
          dark: '#0D1B2A',
        },
      },
    },
  },
  plugins: [],
};