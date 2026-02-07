/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#FFFAEB",
        "dark-blue": "#323245",
        "card-border": "#F5F5F5",
      },
      fontFamily: {
        "sf-regular": ["System"],
        "sf-medium": ["System"],
        "sf-semibold": ["System"],
        "sf-bold": ["System"],
        "sf-black": ["System"],
        "playfair-medium": ["PlayfairDisplay_500Medium"],
        "playfair-semibold": ["PlayfairDisplay_600SemiBold"],
      },
      letterSpacing: {
        label: "1.12px",
      },
    },
  },
  plugins: [],
};
