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

export function normalizePrintableText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  for (const node of textNodes) {
    if (node.nodeValue?.includes("\u00a0")) node.nodeValue = node.nodeValue.replace(/\u00a0/g, " ");
  }

  root.style.maxWidth = "100%";
  root.style.overflow = "visible";
  root.style.overflowWrap = "anywhere";
  root.style.wordBreak = "normal";

  for (const element of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    element.style.maxWidth = "100%";
    element.style.boxSizing = "border-box";
    element.style.overflowWrap = "anywhere";
    element.style.wordBreak = "normal";
    if (element.tagName === "PRE") {
      element.style.whiteSpace = "pre-wrap";
    } else if (!["IMG", "VIDEO"].includes(element.tagName)) {
      element.style.whiteSpace = "normal";
    }
    if (element.tagName === "TABLE") {
      element.style.width = "100%";
      element.style.tableLayout = "fixed";
    }
  }
}

export async function waitForElementImages(root: HTMLElement) {
  await Promise.all(Array.from(root.querySelectorAll("img")).map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
  }));
}

export function createPrintableTextFrame({
  title,
  bodyHtml,
  coverImage,
}: {
  title: string;
  bodyHtml: string;
  coverImage?: string | null;
}) {
  const frame = document.createElement("iframe");
  frame.title = "Prévia para salvar PDF";
  frame.style.cssText = "position:fixed;left:0;top:0;width:900px;height:1000px;z-index:-2147483647;border:0;pointer-events:none;background:#fff;";
  document.body.appendChild(frame);
  const target = frame.contentWindow;
  if (!target) {
    frame.remove();
    return null;
  }

  const safeTitle = title.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);

  target.document.open();
  target.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <base href="${document.baseURI}" />
  <title>${safeTitle}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #192342; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.55; }
    main { width: 100%; max-width: 174mm; margin: 0 auto; }
    h1 { margin: 0 0 20px; font-size: 30px; line-height: 1.15; }
    h2, h3 { break-after: avoid; }
    article, article * { max-width: 100%; box-sizing: border-box; overflow-wrap: anywhere; word-break: normal; }
    article p, article div, article span, article li, article h2, article h3, article blockquote { white-space: normal !important; }
    pre { white-space: pre-wrap !important; }
    p, ul, ol, blockquote { break-inside: avoid-page; }
    img { max-width: 100%; height: auto; break-inside: avoid; }
    .cover { display: block; width: 100%; height: 180px; object-fit: cover; border-radius: 12px; margin: 0 0 22px; }
    blockquote { margin: 16px 0; padding: 10px 16px; border-left: 3px solid #8a78e8; background: #f6f4ff; }
    a { color: #405fd1; }
  </style>
</head>
<body>
  <main>
    ${coverImage ? `<img class="cover" src="${coverImage}" alt="" />` : ""}
    <h1>${safeTitle}</h1>
    <article>${bodyHtml}</article>
  </main>
</body>
</html>`);
  target.document.close();

  return {
    target,
    cleanup: () => frame.remove(),
  };
}
