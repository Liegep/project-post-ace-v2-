import { useEffect } from "react";

export function PortalTextTagHider() {
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.portalTextTagHider = "true";
    style.textContent = ".portal-text-tag-editor{display:none!important;}";
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
