// Los tokens de globals.css como variables CSS: recharts las pasa a fill/stroke del SVG y siguen el tema claro/oscuro.
export const CHART = {
  forest: "var(--forest)",
  leaf: "var(--leaf)",
  mint: "var(--mint)",
  amber: "var(--amber)",
  danger: "var(--danger)",
  info: "var(--info)",
  line: "var(--line)",
  muted: "var(--ink-muted)",
  canvas: "var(--canvas)",
};

export const AXIS_TICK = { fontSize: 12, fill: CHART.muted, fontFamily: "inherit" };

export const TOOLTIP_STYLE = {
  contentStyle: { borderRadius: 10, border: `1px solid ${CHART.line}`, background: "var(--surface)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" },
  labelStyle: { color: "var(--ink)", fontWeight: 600 },
  cursor: { fill: "var(--line)", fillOpacity: 0.4 },
};
