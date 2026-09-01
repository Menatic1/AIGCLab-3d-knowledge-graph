/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: {
          50: '#fdfaf3',
          100: '#f9f2e1',
          200: '#f1e4c4',
          300: '#e6d0a0',
        },
        ink: {
          DEFAULT: '#3b332b',
          light: '#6b5e51',
          soft: '#a89880',
        },
        sketch: {
          blue: '#6ba4c9',
          blueDeep: '#3f7ba0',
          orange: '#e8a86a',
          orangeDeep: '#d18040',
          green: '#8abf8a',
          greenDeep: '#5a9b5a',
          red: '#d98787',
          pink: '#e8a4bf',
          purple: '#a68ac9',
          yellow: '#e8cf6a',
          gray: '#b8b0a0',
        },
      },
      fontFamily: {
        hand: ['"Comic Sans MS"', '"Kaiti SC"', '"KaiTi"', '"Segoe Print"', 'cursive'],
      },
      boxShadow: {
        sketch: '3px 3px 0 rgba(59,51,43,0.15)',
        'sketch-sm': '2px 2px 0 rgba(59,51,43,0.12)',
        'sketch-lg': '4px 4px 0 rgba(59,51,43,0.2)',
      },
      borderRadius: {
        sketch: '16px 20px 18px 22px / 20px 16px 22px 18px',
        'sketch-sm': '8px 12px 10px 14px / 12px 8px 14px 10px',
      },
      backgroundImage: {
        'paper-texture': "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.6) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(255,248,220,0.5) 0%, transparent 50%)",
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'wobble': 'wobble 0.6s ease-in-out',
        'pencil-in': 'pencilIn 0.5s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        wobble: {
          '0%, 100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        },
        pencilIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)', filter: 'blur(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
      },
    },
  },
  plugins: [],
}
