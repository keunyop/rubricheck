import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif"]);

export async function GET() {
  try {
    const comparisonDir = path.join(process.cwd(), "public", "comparison");
    const entries = await readdir(comparisonDir, { withFileTypes: true });

    const images = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }))
      .map((name) => ({
        name,
        src: `/comparison/${encodeURIComponent(name)}`,
      }));

    return NextResponse.json({ images });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT") {
      return NextResponse.json({ images: [] });
    }

    return NextResponse.json({ error: "COMPARISON_IMAGE_LIST_FAILED" }, { status: 500 });
  }
}
