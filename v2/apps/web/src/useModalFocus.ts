import { useEffect, useRef } from "react";

/** Keep a modal's keyboard focus inside it and return it to its opener. */
export function useModalFocus<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!open || !root) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>('a[href],button,input,textarea,select,summary,[tabindex="0"]'))
      .filter(element => !element.matches(':disabled,[hidden]') && element.getClientRects().length > 0);
    (controls()[0] ?? root).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = controls(), first = items[0], last = items[items.length - 1];
      if (!first) { event.preventDefault(); root.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    root.addEventListener("keydown", trap);
    return () => { root.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return ref;
}
