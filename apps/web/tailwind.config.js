/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd7ff',
          300: '#8ebdff',
          400: '#5a99ff',
          500: '#2f74ff',
          600: '#1656f0',
          700: '#1244cc',
          800: '#143aa4',
          900: '#163582',
        },
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          500: '#6b7688',
          700: '#3b4759',
          900: '#12213a',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        card: '0 6px 24px rgba(23, 43, 77, 0.08)',
        hover: '0 12px 36px rgba(23, 43, 77, 0.14)',
      },
      borderRadius: {
        xl2: '14px',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: true,
  },
};
