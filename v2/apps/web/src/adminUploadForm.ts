// Transport metadata only. Never renames the user's File or rewrites its bytes
// or MIME. Signature detection chooses a compatible filename, not acceptance;
// the server's existing limits, authorization and format checks remain decisive.
const extensionsByMime: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "application/pdf": "pdf",
};
function detectedExtension(bytes: Uint8Array): string | undefined {
  const starts = (...signature: number[]) => signature.every((value, index) => bytes[index] === value);
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (starts(0xff, 0xd8, 0xff)) return "jpg";
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(0, 5) === "%PDF-") return "pdf";
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return undefined; // EBML alone also identifies Matroska; retain declared MIME below.
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (brand === "qt  ") return "mov";
    if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "MSNV", "dash"].includes(brand)) return "mp4";
  }
  return undefined;
}
export async function createAdminUploadForm(file: File): Promise<FormData> {
  // Only read a small prefix. Unrecognized/truncated formats keep a declared
  // supported extension (or .bin), so renaming never becomes a new validation.
  const prefix = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const extension = detectedExtension(prefix) ?? extensionsByMime[file.type.toLowerCase()] ?? "bin";
  const body = new FormData();
  body.set("file", file, `upload-${crypto.randomUUID()}.${extension}`);
  return body;
}
