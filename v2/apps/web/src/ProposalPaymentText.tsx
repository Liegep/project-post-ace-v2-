import React from "react";

// Only paragraphs, lists and bold text; user content is always escaped by React.
export function ProposalPaymentText({ value }: { value?: string }) {
  if (!value?.trim()) return null;
  const blocks: Array<{
    type: "paragraph" | "list" | "heading";
    lines: string[];
  }> = [];
  let current: (typeof blocks)[number] | undefined;
  for (const line of value.split(/\r?\n/)) {
    if (!line.trim()) {
      current = undefined;
      continue;
    }
    const heading = /^\s*\*\*(.+)\*\*\s*$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", lines: [heading[1]] });
      current = undefined;
      continue;
    }
    const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
    const type = bullet ? "list" : "paragraph";
    if (!current || current.type !== type) {
      current = { type, lines: [] };
      blocks.push(current);
    }
    current.lines.push(bullet ? bullet[1] : line);
  }
  const inline = (text: string) =>
    text
      .split(/(\*\*[^*]+\*\*)/g)
      .map((part, index) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      );
  return (
    <div className="proposal-payment-text">
      {blocks.map((block, index) =>
        block.type === "heading" ? (
          <h4 key={index}>{block.lines[0]}</h4>
        ) : block.type === "list" ? (
          <ul key={index}>
            {block.lines.map((line, i) => (
              <li key={i}>{inline(line)}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{inline(block.lines.join("\n"))}</p>
        ),
      )}
    </div>
  );
}
