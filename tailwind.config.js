/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#BFDE30',
        'primary-dark': '#8FA800',
        'primary-light': '#EEF5C0',
        surface: '#F5F5F0',
        'text-primary': '#111111',
        'text-secondary': '#888888',
        destructive: '#E53935',
        'destructive-light': '#FDECEA',
      },
    },
  },
  plugins: [],
};
