import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, CheckCircle } from "lucide-react";
import { useAppLogo } from "@/hooks/useAppLogo";

const AcceptInvitePage = () => {
  const appLogo = useAppLogo();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "accept-admin-invite",
        { body: { token, password } }
      );

      if (fnError) {
        setError("Erro ao aceitar convite");
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      setSuccess(true);

      // Auto-login
      if (data?.email) {
        await supabase.auth.signInWithPassword({
          email: data.email,
          password,
        });
        setTimeout(() => navigate("/"), 2000);
      }
    } catch {
      setError("Erro ao aceitar convite");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="type-heading text-foreground">Link inválido</h1>
          <p className="text-sm text-muted-foreground">
            Este link de convite é inválido ou expirou.
          </p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-success mx-auto" />
          <h1 className="type-heading text-foreground">Conta criada!</h1>
          <p className="text-sm text-muted-foreground">
            Redirecionando para o painel...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          {appLogo && <img src={appLogo} alt="Logo" className="h-14 w-14 rounded-xl object-contain mx-auto mb-3" />}
          <h1 className="type-heading text-foreground">Design Hub</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure sua senha para acessar o painel
          </p>
        </div>

        <form onSubmit={handleAccept} className="space-y-4 rounded-xl border bg-card p-6">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            <UserPlus className="mr-2 h-4 w-4" />
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvitePage;
