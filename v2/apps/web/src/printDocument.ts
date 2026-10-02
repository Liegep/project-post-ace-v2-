/** Wait for receipt images before opening the browser's PDF/print dialog. */
export async function printWhenImagesReady(target: Window) {
  if (target.document.readyState !== "complete") {
    await new Promise<void>((resolve) => target.addEventListener("load", () => resolve(), { once: true }));
  }
  await Promise.all(Array.from(target.document.images).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  }));
  if (target.closed) return;
  target.focus();
  target.print();
}
