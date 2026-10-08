/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: '#D9653D',
        ink: '#1C1A18',
        muted: '#756F68',
        surface: '#F7F3EC',
        night: '#141312',
        positive: '#2FA66A',
        caution: '#E2A33C',
        negative: '#DB4B4B',
        info: '#5478D4',
      },
    },
  },
  plugins: [],
};
