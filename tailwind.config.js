/** Same theme the original app configured on the Tailwind CDN. */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B1F3A",
        navyDeep: "#102A43",
        purple: "#7C3AED",
        purpleLight: "#A78BFA",
        bg: "#F8FAFC",
        ink: "#111827",
        slateText: "#64748B",
        line: "#E2E8F0",
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,31,58,0.04), 0 4px 16px rgba(11,31,58,0.05)",
        pop: "0 12px 32px rgba(11,31,58,0.16)",
      },
      borderRadius: { "2xl": "1rem", "3xl": "1.5rem" },
    },
  },
  plugins: [],
};
