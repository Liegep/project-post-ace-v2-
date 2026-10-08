import { useEffect, useMemo, useState } from "react";
import { listAdminClients } from "./api";

type InternalRole = "super_admin" | "admin" | "collaborator";

type StoredSession = {
  role?: string;
};

const SESSION_KEY = "designhub-v2-session";
const RETRY_WINDOW_MS = 30_000;
const RETRY_DELAY_MS = 1_800;

function readInternalRole(): InternalRole | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    return session.role === "super_admin" || session.role === "admin" || session.role === "collaborator"
      ? session.role
      : null;
  } catch {
    return null;
  }
}

export function InitialDataLoadingShield() {
  const role = useMemo(() => readInternalRole(), []);
  const [visible, setVisible] = useState(Boolean(role));
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!role) {
      setVisible(false);
      return;
    }

    let active = true;
    let timer: number | null = null;
    const startedAt = Date.now();
    let failedOnce = false;

    const check = async () => {
      try {
        await listAdminClients();
        if (!active) return;

        // If the first request failed during a deploy, other screens may have
        // already interpreted that temporary failure as an empty client list.
        // Reload once after recovery so every workspace starts from fresh data.
        if (failedOnce) {
          window.location.reload();
          return;
        }

        setVisible(false);
        setTimedOut(false);
      } catch {
        if (!active) return;
        failedOnce = true;
        setVisible(true);
        const elapsed = Date.now() - startedAt;
        if (elapsed >= RETRY_WINDOW_MS) {
          setTimedOut(true);
          return;
        }
        timer = window.setTimeout(check, RETRY_DELAY_MS);
      }
    };

    void check();

    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [role, attempt]);

  if (!visible) return null;

  return (
    <div className="initial-data-shield" role="status" aria-live="polite" aria-busy={!timedOut}>
      <style>{`
        .initial-data-shield {
          position: fixed;
          inset: 0;
          z-index: 2147483000;
          display: grid;
          place-items: center;
          background:
            radial-gradient(circle at 20% 18%, rgba(91,92,226,.18), transparent 28%),
            radial-gradient(circle at 82% 76%, rgba(236,112,173,.16), transparent 30%),
            linear-gradient(135deg, rgba(244,249,255,.98), rgba(255,247,251,.98));
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          font-family: inherit;
          color: #1d2b52;
        }
        .initial-data-shield-card {
          width: min(440px, calc(100vw - 42px));
          text-align: center;
          padding: 42px 34px 36px;
          border: 1px solid rgba(255,255,255,.9);
          border-radius: 30px;
          background: rgba(255,255,255,.72);
          box-shadow: 0 28px 80px rgba(71,75,140,.16);
        }
        .initial-data-spinner {
          width: 72px;
          height: 72px;
          margin: 0 auto 24px;
          border-radius: 50%;
          position: relative;
          background: conic-gradient(from 20deg, #5b5ce2, #8c63eb, #ec70ad, #56bff2, #5b5ce2);
          animation: initialDataSpin 1.15s linear infinite;
          box-shadow: 0 12px 30px rgba(91,92,226,.22);
        }
        .initial-data-spinner::after {
          content: "";
          position: absolute;
          inset: 9px;
          border-radius: 50%;
          background: rgba(250,252,255,.98);
        }
        .initial-data-shield h2 {
          margin: 0 0 10px;
          font-size: 24px;
          line-height: 1.15;
          letter-spacing: -.02em;
        }
        .initial-data-shield p {
          margin: 0 auto;
          max-width: 330px;
          color: #667392;
          font-size: 14px;
          line-height: 1.6;
        }
        .initial-data-shield small {
          display: block;
          margin-top: 16px;
          color: #929bb1;
          font-size: 12px;
        }
        .initial-data-retry {
          margin-top: 22px;
          border: 0;
          border-radius: 14px;
          padding: 12px 20px;
          color: white;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(135deg, #5b5ce2, #9a63ea 55%, #ec70ad);
          box-shadow: 0 10px 24px rgba(91,92,226,.22);
        }
        .initial-data-retry:hover { transform: translateY(-1px); }
        @keyframes initialDataSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .initial-data-spinner { animation-duration: 2.8s; }
        }
      `}</style>
      <div className="initial-data-shield-card">
        <div className="initial-data-spinner" aria-hidden="true" />
        <h2>{timedOut ? "A conexão está demorando um pouco" : "Carregando seu Design Hub"}</h2>
        <p>{timedOut
          ? "Seus dados continuam protegidos. A conexão com a V2 ainda não respondeu; tente novamente em instantes."
          : "Estamos reconectando seus clientes e Kanbans. Durante um deploy isso pode levar alguns segundos."}</p>
        {timedOut ? (
          <button type="button" className="initial-data-retry" onClick={() => { setTimedOut(false); setAttempt((value) => value + 1); }}>
            Tentar novamente
          </button>
        ) : <small>Não feche a página — seus dados não foram apagados.</small>}
      </div>
    </div>
  );
}
