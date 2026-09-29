// Mismos valores que los tokens provisionales de globals.css (recharts no lee variables CSS en SVG con fiabilidad).
export const CHART = {
  forest: "#0e4632",
  leaf: "#1e8a57",
  mint: "#ddf2e6",
  amber: "#b7791f",
  danger: "#b93a32",
  info: "#2c5fa8",
  line: "#d8e4dc",
  muted: "#5d6d63",
  canvas: "#f5f8f6",
};

export const AXIS_TICK = { fontSize: 12, fill: CHART.muted, fontFamily: "inherit" };

export const TOOLTIP_STYLE = {
  contentStyle: { borderRadius: 10, border: `1px solid ${CHART.line}`, fontSize: 12, fontFamily: "inherit", boxShadow: "0 4px 16px rgba(24,32,28,0.08)" },
  labelStyle: { color: "#152019", fontWeight: 600 },
  cursor: { fill: "rgba(14,70,50,0.06)" },
};
