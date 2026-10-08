import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { AgendaEvent } from "./api";
import { agendaTextColor, agendaVisualState } from "./agendaFoundation";
export function AgendaDayDialog({
  day,
  items,
  time,
  onSelect,
  onClose,
}: {
  day: string;
  items: AgendaEvent[];
  time: (value: string) => string;
  onSelect: (event: AgendaEvent) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(
    <div className="modal-backdrop agenda-modal-backdrop" onMouseDown={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Compromissos de ${day}`}
        className="agenda-detail-modal agenda-foundation-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = [
              ...ref.current!.querySelectorAll<HTMLElement>(
                "button,a,input,select",
              ),
            ];
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === ref.current)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <h3>{day}</h3>
          <button
            type="button"
            className="icon-close"
            aria-label="Fechar lista do dia"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="agenda-day-items">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`agenda-event-pill${agendaVisualState(item).className}`}
              onClick={() => onSelect(item)}
              style={{
                backgroundColor: item.color,
                color: agendaTextColor(item.color),
                whiteSpace: "normal",
                textAlign: "left",
                width: "100%",
              }}
            >
              <span>{time(item.startsAt)}</span> {item.title}
              <small>
                {" "}
                · {item.clientName || item.labelName || "Compromisso"} ·{" "}
                {agendaVisualState(item).label}
              </small>
            </button>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
