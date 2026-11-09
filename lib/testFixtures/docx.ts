import JSZip from "jszip";

// Synthetic OOXML only; no customer documents or provider requests in fixtures.
export async function docxFixture(parts: Array<string | {
  image: string;
  external?: boolean;
  extension?: string;
  contentType?: string;
}>): Promise<File> {
  const zip = new JSZip();
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const relationships: string[] = [];
  const contentTypes = new Map<string, string>([["xml", "application/xml"]]);
  const body = parts.map((part, index) => {
    if (typeof part === "string") return `<w:p><w:r><w:t xml:space="preserve">${escape(part)}</w:t></w:r></w:p>`;
    const extension = (part.extension ?? "png").replace(/^\./, "").toLowerCase();
    contentTypes.set(extension, part.contentType ?? (extension === "emf" ? "image/x-emf" : `image/${extension}`));
    const id = `rId${index}`;
    const target = part.external ? `file:///private/never-read.${extension}` : `media/image${index}.${extension}`;
    relationships.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"${part.external ? ' TargetMode="External"' : ""}/>`);
    if (!part.external) zip.file(`word/${target}`, part.image);
    return `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="${index + 1}" name="Synthetic image"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip ${part.external ? "r:link" : "r:embed"}="${id}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }).join("");
  const defaults = [...contentTypes].map(([extension, contentType]) => `<Default Extension="${escape(extension)}" ContentType="${escape(contentType)}"/>`).join("");
  zip.file("[Content_Types].xml", `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`);
  return new File([await zip.generateAsync({ type: "arraybuffer" })], "synthetic.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
