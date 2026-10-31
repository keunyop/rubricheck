// Use the side-effect-free entry; the package root reads a debug PDF in Next dev.
declare module "pdf-parse/lib/pdf-parse.js" {
  import type pdf from "pdf-parse";
  const parse: (data: Uint8Array, options?: pdf.Options) => Promise<pdf.Result>;
  export default parse;
}
