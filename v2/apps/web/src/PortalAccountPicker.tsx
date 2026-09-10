import { Navigate, NavLink } from "react-router-dom";
import type { SessionUser } from "./types";
import "./PortalAccountPicker.css";

const messages = {
  pt: ["Escolha sua conta", "Qual área de cliente você quer acessar?", "Entrar", "Sair", "Seu acesso ainda não tem uma conta vinculada. Entre em contato com o estúdio."],
  en: ["Choose your account", "Which client area would you like to open?", "Enter", "Sign out", "Your login has no linked account yet. Please contact the studio."],
  it: ["Scegli il tuo account", "A quale area cliente vuoi accedere?", "Entra", "Esci", "Il tuo accesso non ha ancora un account associato. Contatta lo studio."],
  es: ["Elige tu cuenta", "¿A qué área de cliente quieres acceder?", "Entrar", "Salir", "Tu acceso aún no tiene una cuenta vinculada. Contacta con el estudio."],
  sv: ["Välj ditt konto", "Vilken kundportal vill du öppna?", "Öppna", "Logga ut", "Din inloggning har inget kopplat konto ännu. Kontakta studion."],
};

export function PortalAccountPicker({ session, onLogout }: { session: SessionUser | null; onLogout: () => void }) {
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== "client") return <Navigate to="/dashboard" replace />;
  const slugs = [...new Set(session.assignedPortalSlugs)];
  if (slugs.length === 1) return <Navigate to={`/portal/${encodeURIComponent(slugs[0])}`} replace />;
  const copy = messages[session.locale.slice(0, 2).toLowerCase() as keyof typeof messages] || messages.pt;
  return <main className="center-shell account-picker-shell">
    <section className="glass account-picker" aria-labelledby="account-picker-title">
      <p className="eyebrow">DESIGN HUB</p>
      <h1 id="account-picker-title">{copy[0]}</h1>
      <p className="hero-copy">{slugs.length ? copy[1] : copy[4]}</p>
      <nav className="account-picker-list" aria-label={copy[0]}>
        {slugs.map((slug) => {
          const name = session.portalAccounts?.find((account) => account.slug === slug)?.name || slug.replace(/-/g, " ");
          return <NavLink className="account-picker-choice" key={slug} to={`/portal/${encodeURIComponent(slug)}`}>
            <span className="account-picker-avatar" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
            <strong>{name}</strong><span className="account-picker-enter">{copy[2]} <span aria-hidden="true">→</span></span>
          </NavLink>;
        })}
      </nav>
      <footer><span>{session.email}</span><button className="ghost-button" onClick={onLogout}>{copy[3]}</button></footer>
    </section>
  </main>;
}
