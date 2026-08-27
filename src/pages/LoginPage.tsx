import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogIn, ArrowLeft, Mail, Globe } from "lucide-react";
import { useAppLogo } from "@/hooks/useAppLogo";
import { Locale, LOCALE_LABELS, LOCALE_FLAGS } from "@/i18n/translations";
import { loginTranslations } from "@/i18n/loginTranslations";

const LOGIN_LOCALE_KEY = "login_locale";

const LoginPage = () => {
  const appLogo = useAppLogo();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [successMessage, setSuccessMessage] = useState("");
  const [animDone, setAnimDone] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => {
    // 1) Respeita a escolha manual do usuário (salva em visitas anteriores)
    const saved = localStorage.getItem(LOGIN_LOCALE_KEY);
    if (saved && saved in loginTranslations) return saved as Locale;
    // 2) Primeira visita: detecta o idioma do navegador
    if (typeof navigator !== "undefined") {
      const browserLang = (navigator.language || "").toLowerCase();
      if (browserLang.startsWith("pt")) return "pt";
    }
    // 3) Fallback: Inglês
    return "en";
  });

  const t = loginTranslations[locale];

  useEffect(() => {
    const timer = setTimeout(() => setAnimDone(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleLocaleChange = (loc: Locale) => {
    setLocale(loc);
    localStorage.setItem(LOGIN_LOCALE_KEY, loc);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.user) {
        setError(t.errorInvalidCredentials);
        return;
      }

      const userId = data.user.id;
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      const roles = new Set((roleRows || []).map((row: any) => row.role as string));
      const canAccessDashboard = roles.has("super_admin") || roles.has("admin") || roles.has("colaborador");
      const isClient = roles.has("client");

      // Keep the login routing aligned with the dashboard's AuthGuard roles.
      if (canAccessDashboard) {
        navigate("/admin", { replace: true });
        return;
      }

      if (isClient) {
        const { data: assignments } = await supabase
          .from("user_client_assignments")
          .select("client_id")
          .eq("user_id", userId)
          .limit(1);

        if (assignments && assignments.length > 0) {
          const { data: clientData } = await supabase
            .from("clients")
            .select("slug")
            .eq("id", assignments[0].client_id)
            .single();

          if (clientData) {
            navigate(`/client/${clientData.slug}`, { replace: true });
            return;
          }
        }

        setError(t.errorNoClientLinked);
        await supabase.auth.signOut();
        return;
      }

      setError(t.errorNoAccess);
      await supabase.auth.signOut();
    } catch {
      setError(t.errorLogin);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(t.errorReset);
        return;
      }

      setSuccessMessage(t.successResetSent);
    } catch {
      setError(t.errorReset);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Language selector — top right */}
      <div
        className={`absolute top-4 right-4 transition-opacity duration-500 ${
          animDone ? "opacity-100" : "opacity-0"
        }`}
      >
        <Select value={locale} onValueChange={(v) => handleLocaleChange(v as Locale)}>
          <SelectTrigger className="h-9 w-[150px] text-xs bg-card">
            <Globe className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(loginTranslations) as Locale[]).map((loc) => (
              <SelectItem key={loc} value={loc}>
                {LOCALE_FLAGS[loc]} {LOCALE_LABELS[loc]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Login content — fades in */}
      <div
        className={`w-full max-w-sm space-y-6 transition-all duration-700 ${
          animDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <div className="text-center">
          {appLogo && (
            <img
              src={appLogo}
              alt="Logo"
              className={`h-14 w-14 rounded-xl object-contain mx-auto mb-3 transition-all duration-500 delay-200 ${
                animDone ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
            />
          )}
          <h1
            className={`type-heading text-foreground transition-all duration-500 delay-300 ${
              animDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {t.appName}
          </h1>
          <p
            className={`text-sm text-muted-foreground mt-1 transition-all duration-500 delay-400 ${
              animDone ? "opacity-100" : "opacity-0"
            }`}
          >
            {mode === "login" ? t.loginSubtitle : t.forgotSubtitle}
          </p>
        </div>

        {mode === "login" ? (
          <form
            onSubmit={handleLogin}
            className={`space-y-4 rounded-xl border bg-card p-6 transition-all duration-500 delay-500 ${
              animDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? t.signingIn : t.signIn}
            </Button>

            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); setSuccessMessage(""); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t.forgotPassword}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleForgotPassword}
            className={`space-y-4 rounded-xl border bg-card p-6 transition-all duration-500 delay-500 ${
              animDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {successMessage && <p className="text-sm text-primary">{successMessage}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              <Mail className="mr-2 h-4 w-4" />
              {loading ? t.sending : t.sendResetLink}
            </Button>

            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setSuccessMessage(""); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              <ArrowLeft className="h-3 w-3 text-primary-foreground" />
              {t.backToLogin}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
