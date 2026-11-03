import JSZip from "jszip";

// Synthetic OOXML only; no customer documents or provider requests in fixtures.
export async function docxFixture(parts: Array<string | { image: string; external?: boolean }>): Promise<File> {
  const zip = new JSZip();
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const relationships: string[] = [];
  const body = parts.map((part, index) => {
    if (typeof part === "string") return `<w:p><w:r><w:t xml:space="preserve">${escape(part)}</w:t></w:r></w:p>`;
    const id = `rId${index}`;
    const target = part.external ? "file:///private/never-read.png" : `media/image${index}.png`;
    relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"${part.external ? ' TargetMode="External"' : ""}/>`);
    if (!part.external) zip.file(`word/${target}`, part.image);
    return `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="${index + 1}" name="Synthetic image"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip ${part.external ? "r:link" : "r:embed"}="${id}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }).join("");
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`);
  return new File([await zip.generateAsync({ type: "arraybuffer" })], "synthetic.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
