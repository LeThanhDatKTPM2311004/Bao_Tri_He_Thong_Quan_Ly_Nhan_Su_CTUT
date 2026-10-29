/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: '#ffffff',
        canvas: '#f1f5f9',
        border: '#e2e8f0',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
