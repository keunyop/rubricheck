import { ImageResponse } from "next/og";
export const alt = "RubriCheck AI quiz generator — quizzes from PDFs, notes and assignments";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", padding: 80, background: "#f7f9fc", color: "#0f172a", fontFamily: "sans-serif" }}><div style={{ fontSize: 30, color: "#4f46e5", marginBottom: 44 }}>RubriCheck</div><div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.15 }}>Turn your study materials into quizzes.</div><div style={{ fontSize: 28, marginTop: 36, color: "#475569" }}>PDFs · Assignments · Slides · Notes</div><div style={{ fontSize: 25, marginTop: 44, color: "#4f46e5" }}>10 free questions after sign-up · Practice at your own pace</div></div>, size);
}
