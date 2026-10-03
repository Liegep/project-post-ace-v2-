import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function BillingSettingsDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  useEffect(() => {
    if (!open || !mounted) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const focusable = Array.from(panel.current?.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], summary, [tabindex='0']") ?? [])
        .filter((element) => !element.matches(":disabled") && element.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, mounted, onClose]);
  if (!mounted) return null;
  // Keep forms mounted after first opening so closing the drawer preserves their state.
  return createPortal(<div className="billing-settings-backdrop" hidden={!open} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside id="billing-settings-drawer" className="billing-settings-drawer" role="dialog" aria-modal="true" aria-labelledby="billing-settings-title" ref={panel}>
      <header><div><p className="eyebrow">Faturamento</p><h2 id="billing-settings-title">Ajustes do faturamento</h2></div><button ref={closeButton} type="button" className="icon-close" aria-label="Fechar ajustes do faturamento" onClick={onClose}>×</button></header>
      <div className="billing-settings-content">{children}</div>
    </aside>
  </div>, document.body);
}
