export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  plugins: [require('tailwind-scrollbar-hide')],
  theme: {
    extend: {
    fontFamily: {
      sans: ['Poppins', 'sans-serif'],
    }
    },
  },
  
}
