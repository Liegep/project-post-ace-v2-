import { useMemo, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { completePasswordResetWithApi, requestPasswordResetWithApi } from "./authApi";
import type { SessionUser } from "./types";
import designHubV2Logo from "./assets/design-hub-v2-logo.png";
import { LOGIN_LOCALES, LOGIN_LANGUAGE_NAMES, loginCopy, publicAuthMessage, useLoginIntro, useLoginLocale, type LoginLocale } from "./loginI18n";

function LoginLanguageSwitcher({ locale, onChange, label }: { locale: LoginLocale; onChange: (locale: LoginLocale) => void; label: string }) {
  return <div className="login-language-switcher" role="group" aria-label={label}>
    {LOGIN_LOCALES.map(language => <button key={language} type="button" lang={language} aria-label={LOGIN_LANGUAGE_NAMES[language]} aria-pressed={locale === language} onClick={() => onChange(language)}>{language.toUpperCase()}</button>)}
  </div>;
}

export function LoginPage({
  session,
  onLogin,
  redirectTo,
}: {
  session: SessionUser | null;
  redirectTo: string;
  onLogin: (email: string, password: string) => Promise<boolean>;
}) {
  const { locale, chooseLocale, copy } = useLoginLocale();
  const playIntro = useLoginIntro(!session);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  if (session) {
    return <Navigate to={redirectTo} replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const ok = await onLogin(email.trim(), password);
    setSubmitting(false);
    if (!ok) {
      setError(loginCopy.pt.loginError);
      return;
    }
    setError("");
  }

  async function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setRecoveryMessage("");
    try {
      const result = await requestPasswordResetWithApi(email.trim());
      setRecoveryMessage(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : loginCopy.pt.recoveryError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="center-shell login-shell" lang={locale}>
      <section className={`login-grid login-experience${playIntro ? " login-intro" : ""}`}>
        <LoginLanguageSwitcher locale={locale} onChange={chooseLocale} label={copy.language} />
        {playIntro ? <div className="login-intro-logo" aria-hidden="true"><img src={designHubV2Logo} alt="" /></div> : null}
        <article className="glass login-panel login-primary">
          <div className="login-brand-mark" aria-label="Design Hub V2">
            <img src={designHubV2Logo} alt="Logo Design Hub V2" />
          </div>
          <div className="login-kicker"><span className="login-live-dot" />{copy.kicker}</div>
          <h1>{recovering ? copy.recoveryTitle : copy.welcome}</h1>
          <p className="hero-copy">
            {recovering ? copy.recoveryIntro : copy.intro}
          </p>

          <form id={recovering ? "designhub-recovery" : "designhub-login"} name={recovering ? "password-recovery" : "login"} className="login-form" method="post" action={recovering ? "/api/auth/forgot-password" : "/api/auth/login"} autoComplete="on" onSubmit={recovering ? requestRecovery : submit}>
            <label className="field-stack" htmlFor="login-username">
              <span>{copy.email}</span>
              <input id="login-username" name="username" type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" enterKeyHint="next" autoFocus placeholder={copy.emailPlaceholder} value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {!recovering ? <label className="field-stack" htmlFor="login-password">
              <span>{copy.password}</span>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder={copy.passwordPlaceholder}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label> : null}
            <button className="gradient-button login-submit" type="submit" disabled={submitting}>
              {submitting ? (recovering ? copy.sending : copy.signingIn) : recovering ? <>{copy.sendLink} <span aria-hidden="true">→</span></> : <>{copy.signIn} <span aria-hidden="true">→</span></>}
            </button>
            <button className="login-text-action" type="button" onClick={() => { setRecovering((current) => !current); setError(""); setRecoveryMessage(""); }}>
              {recovering ? copy.back : copy.forgot}
            </button>
            {recoveryMessage ? <p className="form-feedback success-text" role="status">{publicAuthMessage(recoveryMessage, copy)}</p> : null}
            {error ? <p className="form-feedback error-text">{publicAuthMessage(error, copy)}</p> : null}
          </form>
          <p className="login-security-note"><span aria-hidden="true">●</span>{copy.security} </p>
        </article>

        <aside className="glass login-panel login-demo-panel login-showcase-panel" aria-label={copy.overview}>
          <span className="login-orb orb-a" /><span className="login-orb orb-b" /><span className="login-orb orb-c" />
          <div className="login-showcase-copy">
            <p className="eyebrow">{copy.vision}</p>
            <h2>{copy.allInOne}</h2>
            <p>{copy.showcase}</p>
          </div>
          <div className="login-product-preview" aria-hidden="true">
            <div className="login-preview-topbar"><span /><span /><span /><b>Design Hub</b><em>•••</em></div>
            <div className="login-preview-greeting"><small>{copy.today}</small><strong>{copy.greeting}</strong><span>{copy.happening}</span></div>
            <div className="login-preview-metrics">
              <div><span className="blue">12</span><small>{copy.creation}</small></div>
              <div><span className="violet">5</span><small>{copy.approvals}</small></div>
              <div><span className="green">8</span><small>{copy.scheduled}</small></div>
            </div>
            <div className="login-preview-activity">
              <header><strong>{copy.activity}</strong><small>{copy.live}</small></header>
              <div><i className="violet" /><span><b>{copy.approved}</b><small>{copy.newClient}</small></span><em>✓</em></div>
              <div><i className="blue" /><span><b>{copy.newIdea}</b><small>{copy.team}</small></span><em>→</em></div>
              <div><i className="orange" /><span><b>{copy.changed}</b><small>{copy.campaign}</small></span><em>↗</em></div>
            </div>
          </div>
          <div className="login-showcase-status"><span><i />{copy.operational} </span><small>Design Hub 2.0</small></div>
        </aside>
      </section>
    </main>
  );
}

export function PasswordResetPage() {
  const { locale, chooseLocale, copy } = useLoginLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => new URLSearchParams(location.search).get("token")?.trim() ?? "", [location.search]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError(loginCopy.pt.invalidToken);
      return;
    }
    if (newPassword.length < 8) {
      setError(loginCopy.pt.shortPassword);
      return;
    }
    if (newPassword !== confirmation) {
      setError(loginCopy.pt.mismatch);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await completePasswordResetWithApi(token, newPassword);
      setCompleted(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : loginCopy.pt.resetError);
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="center-shell password-reset-shell" lang={locale}>
    <section className="glass password-reset-card">
      <LoginLanguageSwitcher locale={locale} onChange={chooseLocale} label={copy.language} />
      <div className="login-brand-mark" aria-label="Design Hub V2"><img src={designHubV2Logo} alt="Logo Design Hub V2" /></div>
      <div className="login-kicker"><span className="login-live-dot" />{copy.secureKicker}</div>
      {completed ? <>
        <h1>{copy.resetSuccess}</h1>
        <p className="hero-copy">{copy.resetSuccessIntro}</p>
        <button className="gradient-button login-submit" type="button" onClick={() => navigate("/login", { replace: true })}>{copy.goLogin} <span aria-hidden="true">→</span></button>
      </> : <>
        <h1>{copy.resetTitle}</h1>
        <p className="hero-copy">{copy.resetIntro}</p>
        <form className="login-form" autoComplete="on" onSubmit={submit}>
          <label className="field-stack" htmlFor="reset-new-password"><span>{copy.newPassword}</span><input id="reset-new-password" name="new-password" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoFocus /></label>
          <label className="field-stack" htmlFor="reset-confirm-password"><span>{copy.confirmPassword}</span><input id="reset-confirm-password" name="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          <button className="gradient-button login-submit" type="submit" disabled={submitting}>{submitting ? copy.saving : <>{copy.savePassword} <span aria-hidden="true">→</span></>}</button>
          {error ? <p className="form-feedback error-text" role="alert">{publicAuthMessage(error, copy)}</p> : null}
        </form>
      </>}
    </section>
  </main>;
}

