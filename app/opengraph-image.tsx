import { ImageResponse } from "next/og";

export const alt = "RubriCheck — AI rubric checker for essays and assignments";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "64px 72px", background: "linear-gradient(135deg, #f8fafc, #e0e7ff)", color: "#0f172a" }}>
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#4338ca" }}>RubriCheck</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>Check your draft against your rubric.</div>
          <div style={{ display: "flex", fontSize: 30, color: "#475569" }}>Estimated scores. Clear revision priorities.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#475569" }}>
          <span>Essays, reports, and assignments</span>
          <span>rubricheck.com</span>
        </div>
      </div>
    ),
    size,
  );
}
