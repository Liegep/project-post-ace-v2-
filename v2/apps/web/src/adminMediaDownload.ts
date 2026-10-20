/** Prepare an administrative download without changing its stored source. */
export async function prepareAdminDownload(source: Blob, url: string, baseName: string) {
  const mime = source.type.split(";")[0].toLowerCase();
  const image = mime.startsWith("image/") ||
    ((!mime || mime === "application/octet-stream") && /\.(webp|png|jpe?g|gif|svg|avif|bmp|tiff?)(?:[?#]|$)/i.test(url));
  if (!image) return { blob: source, fileName: undefined };

  const objectUrl = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) throw new Error("Invalid image");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    // Keep original dimensions and use the browser's highest JPEG quality.
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result?.type === "image/jpeg"
        ? resolve(result) : reject(new Error("JPEG encoding failed")), "image/jpeg", 1);
    });
    return { blob, fileName: `${baseName}.jpg` };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
