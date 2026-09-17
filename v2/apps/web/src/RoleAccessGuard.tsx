import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type StoredSession = {
  role?: "super_admin" | "admin" | "collaborator" | "client";
};

const SESSION_KEY = "designhub-v2-session";

const PRIVATE_PATHS = [
  "/agenda",
  "/area/relatorios",
  "/area/faturamento",
  "/area/propostas",
  "/area/contratos",
  "/area/briefs-design",
  "/area/equipe",
];

function readRole(): StoredSession["role"] | undefined {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    return (JSON.parse(raw) as StoredSession).role;
  } catch {
    return undefined;
  }
}

function isRestrictedRole(role: StoredSession["role"]) {
  return role === "admin" || role === "collaborator";
}

export function RoleAccessGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const role = readRole();
    if (!isRestrictedRole(role)) return;

    if (PRIVATE_PATHS.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))) {
      navigate("/dashboard", { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const applyVisibility = () => {
      const role = readRole();
      const restricted = isRestrictedRole(role);

      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
        const href = anchor.getAttribute("href") ?? "";
        const shouldHide = restricted && PRIVATE_PATHS.some((path) => href.includes(path));
        if (shouldHide) {
          anchor.dataset.roleHidden = "true";
          anchor.style.display = "none";
        } else if (anchor.dataset.roleHidden === "true") {
          delete anchor.dataset.roleHidden;
          anchor.style.removeProperty("display");
        }
      });

      document.querySelectorAll<HTMLElement>(".dashboard-agenda-widget").forEach((widget) => {
        if (restricted) {
          widget.dataset.roleHidden = "true";
          widget.style.display = "none";
        } else if (widget.dataset.roleHidden === "true") {
          delete widget.dataset.roleHidden;
          widget.style.removeProperty("display");
        }
      });
    };

    applyVisibility();
    const observer = new MutationObserver(applyVisibility);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);

  return null;
}
