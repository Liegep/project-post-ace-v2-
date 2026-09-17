import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listManagedUsers, resetManagedUserPassword, type ManagedUser } from "./api";

const SESSION_KEY = "designhub-v2-session";

function isSuperAdminSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as { role?: string }).role === "super_admin";
  } catch {
    return false;
  }
}

export function TeamPasswordReset() {
  const [target, setTarget] = useState<ManagedUser | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isSuperAdminSession()) return;

    let disposed = false;

    const injectButtons = () => {
      if (disposed || !window.location.hash.includes("/area/equipe")) return;

      document.querySelectorAll<HTMLElement>(".team-member-card").forEach((card) => {
        const actions = card.querySelector<HTMLElement>(".team-member-actions");
        if (!actions || actions.querySelector(".team-password-reset-action")) return;

        const email = card.querySelector<HTMLElement>(".team-member-summary p")?.textContent?.trim();
        if (!email) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "team-password-reset-action";
        button.textContent = "Redefinir senha";
        button.addEventListener("click", async () => {
          setMessage("");
          try {
            const response = await listManagedUsers();
            const member = response.items.find((item) => item.email.toLowerCase() === email.toLowerCase());
            if (!member) {
              setMessage("Não foi possível localizar este usuário.");
              return;
            }
            setPassword("");
            setConfirmPassword("");
            setTarget(member);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Não foi possível carregar este usuário.");
          }
        });
        actions.insertBefore(button, actions.lastElementChild);
      });
    };

    injectButtons();
    const observer = new MutationObserver(injectButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    const onHashChange = () => window.setTimeout(injectButtons, 0);
    window.addEventListener("hashchange", onHashChange);

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener("hashchange", onHashChange);
      document.querySelectorAll(".team-password-reset-action").forEach((button) => button.remove());
    };
  }, []);

  const close = () => {
    if (saving) return;
    setTarget(null);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
  };

  const save = async () => {
    if (!target || saving) return;
    if (password.length < 8) {
      setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("As duas senhas não são iguais.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      await resetManagedUserPassword(target.id, password);
      window.dispatchEvent(new CustomEvent("design-hub:success", {
        detail: {
          id: crypto.randomUUID(),
          title: "Senha redefinida",
          detail: `A nova senha de ${target.fullName} já está ativa.`,
        },
      }));
      setTarget(null);
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível redefinir a senha.");
    } finally {
      setSaving(false);
    }
  };

  if (!target) return message ? createPortal(<div className="global-success-notice is-neutral" role="status"><div><strong>Atenção</strong><small>{message}</small></div></div>, document.body) : null;

  return createPortal(
    <div className="modal-backdrop team-modal-backdrop" onMouseDown={close}>
      <section className="team-modal" role="dialog" aria-modal="true" aria-labelledby="team-password-reset-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p className="eyebrow">Segurança do acesso</p><h2 id="team-password-reset-title">Redefinir senha</h2><small>{target.fullName} · {target.email}</small></div>
          <button type="button" onClick={close} aria-label="Fechar">×</button>
        </header>
        <div className="team-form-fields">
          <label>Nova senha<input autoFocus type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" /></label>
          <label>Confirmar nova senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Digite novamente" /></label>
        </div>
        {message ? <p className="team-feedback error-text">{message}</p> : null}
        <footer>
          <button type="button" className="team-cancel" disabled={saving} onClick={close}>Cancelar</button>
          <button type="button" className="gradient-button" disabled={saving} onClick={() => void save()}>{saving ? "Redefinindo..." : "Redefinir senha"}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
