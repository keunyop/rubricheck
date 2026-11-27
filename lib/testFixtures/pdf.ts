// Synthetic PDFs only: no customer documents are checked into the test suite.
export function makePdf(pageTexts: string[]): File {
  return makePdfFromStreams(pageTexts.map(text => `BT /F1 12 Tf 50 700 Td (${escapeText(text)}) Tj ET`));
}

function escapeText(text: string) {
  return text.replace(/[\\()]/g, "\\$&");
}

export function makePositionedPdf(items: {text:string; x:number; y:number}[]): File {
  return makePdfFromStreams([items.map(({text,x,y}) =>
    `BT /F1 12 Tf ${x} ${y} Td (${escapeText(text)}) Tj ET`
  ).join("\n")]);
}

function makePdfFromStreams(pageStreams: string[]): File {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageStreams.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pageStreams.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  for (const stream of pageStreams) {
    const contentId = objects.length + 2;
    objects.push("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents " + contentId + " 0 R >>");
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new File([pdf], "synthetic.pdf", { type: "application/pdf" });
}
