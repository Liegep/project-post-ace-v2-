import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { differenceInDays, differenceInHours, differenceInMinutes } from "date-fns";
import { CheckCircle2, Clock, FileX, Pen } from "lucide-react";
import { useAppLogo } from "@/hooks/useAppLogo";
import { ProposalLocale, getProposalT } from "@/i18n/proposalTranslations";

interface ProposalService {
  name: string;
  description: string;
  value: number;
}

interface ProposalData {
  id: string;
  client_name: string;
  scope_description: string;
  investment_description: string;
  services: ProposalService[];
  total_value: number;
  currency: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_name: string;
  created_at: string;
  locale: ProposalLocale;
  proposal_type?: string;
  plan?: string;
  pieces_quantity?: number;
}

export default function PublicProposalPage() {
  const { token } = useParams<{ token: string }>();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [acceptName, setAcceptName] = useState("");
  const [acceptSignature, setAcceptSignature] = useState("");
  const [acceptEmail, setAcceptEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const appLogo = useAppLogo();

  const loc: ProposalLocale = proposal?.locale || "pt";
  const t = getProposalT(loc);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase
        .rpc("get_proposal_by_token", { p_token: token } as any);

      const row: any = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setLoading(false);
        return;
      }

      const p: ProposalData = {
        ...row,
        services: Array.isArray(row.services) ? row.services as any : JSON.parse(row.services as string || "[]"),
        locale: ((row as any).locale || "pt") as ProposalLocale,
      };

      if (new Date(p.expires_at) < new Date()) {
        setExpired(true);
        if (p.status !== "expired") {
          await supabase.rpc("mark_proposal_expired", { p_token: token } as any);
        }
      } else if (p.status === "accepted") {
        setAccepted(true);
      } else {
        if (p.status === "sent" || p.status === "draft") {
          await supabase.rpc("mark_proposal_viewed", { p_token: token } as any);
        }
      }

      setProposal(p);
      setLoading(false);
      setTimeout(() => setAnimateIn(true), 100);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!acceptName.trim()) {
      toast({ title: t("enterFullName"), variant: "destructive" });
      return;
    }
    if (!acceptEmail.trim()) {
      toast({ title: loc === "pt" ? "Informe seu e-mail" : "Enter your email", variant: "destructive" });
      return;
    }
    setSubmitting(true);

    // Capture IP
    let clientIp = "";
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      clientIp = ipData.ip || "";
    } catch {}

    const { error } = await supabase.rpc("accept_proposal", {
      p_token: token!,
      p_name: acceptName.trim(),
      p_email: acceptEmail.trim(),
      p_signature: acceptSignature.trim(),
      p_ip: clientIp,
    } as any);
    setSubmitting(false);
    if (error) {
      toast({ title: t("errorAccepting"), variant: "destructive" });
    } else {
      setAccepted(true);
      setAcceptOpen(false);
      toast({ title: t("proposalAccepted") });
      // Notify the proposal owner via in-app bell (fire-and-forget)
      supabase.functions.invoke("notify-proposal-accepted", {
        body: { proposal_id: proposal!.id },
      }).catch(() => {});
    }
  };

  const getTimeRemaining = () => {
    if (!proposal) return "";
    const now = new Date();
    const exp = new Date(proposal.expires_at);
    const days = differenceInDays(exp, now);
    if (days > 0) return `${days} ${days > 1 ? t("days") : t("day")}`;
    const hours = differenceInHours(exp, now);
    if (hours > 0) return `${hours} ${hours > 1 ? t("hours") : t("hour")}`;
    const mins = differenceInMinutes(exp, now);
    return `${Math.max(0, mins)} ${mins !== 1 ? t("minutes") : t("minute")}`;
  };

  // Premium background shared across states
  const PremiumBg = () => (
    <>
      {/* Base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a1530_0%,_#0a0a14_55%,_#050509_100%)]" />
      {/* Aurora glows */}
      <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-indigo-500/20 blur-[140px]" />
      <div className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-fuchsia-500/15 blur-[160px]" />
      <div className="absolute bottom-0 left-1/4 h-[420px] w-[420px] rounded-full bg-amber-400/10 blur-[140px]" />
      {/* Subtle grain via SVG noise */}
      <div
        className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
        }}
      />
      {/* Gold edge vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_55%,_rgba(0,0,0,0.55)_100%)]" />
    </>
  );

  if (loading) {
    return (
      <div className="relative min-h-screen overflow-hidden flex items-center justify-center">
        <PremiumBg />
        <div className="relative h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-amber-200/80" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center text-white/70 gap-4 px-6">
        <PremiumBg />
        <FileX className="relative h-16 w-16 text-white/20" />
        <h1 className="relative text-2xl font-light tracking-wide">{t("proposalNotFound")}</h1>
        <p className="relative text-sm text-white/40">{t("notFoundMessage")}</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center text-white/70 gap-6 px-6">
        <PremiumBg />
        <div className="relative h-20 w-20 rounded-full bg-white/5 flex items-center justify-center backdrop-blur-xl border border-white/10">
          <Clock className="h-10 w-10 text-white/40" />
        </div>
        <h1 className="relative text-3xl font-extralight tracking-widest text-white/85">{t("proposalExpired")}</h1>
        <p className="relative text-sm text-white/50 max-w-md text-center leading-relaxed">
          {t("expiredMessage")}
        </p>
        {appLogo && <img src={appLogo} alt="Logo" className="relative h-8 mt-8 opacity-40" />}
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center text-white/80 gap-6 px-6">
        <PremiumBg />
        <div className="relative h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center backdrop-blur-xl border border-emerald-400/30 shadow-[0_0_60px_-10px_rgba(52,211,153,0.4)]">
          <CheckCircle2 className="h-10 w-10 text-emerald-300" />
        </div>
        <h1 className="relative text-3xl font-extralight tracking-widest">{t("acceptedTitle")}</h1>
        <p className="relative text-sm text-white/50 max-w-md text-center leading-relaxed">
          {proposal.accepted_name
            ? t("acceptedBy").replace("{name}", proposal.accepted_name)
            : t("acceptedGeneric")}
        </p>
        {appLogo && <img src={appLogo} alt="Logo" className="relative h-8 mt-8 opacity-40" />}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-white/90 selection:bg-amber-200/30">
      <PremiumBg />

      <div className="relative">
        {/* Banner */}
        <header className="border-b border-white/10 backdrop-blur-md bg-white/[0.02]">
          <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-6">
            {appLogo ? (
              <img src={appLogo} alt="Logo" className="h-8 opacity-90" />
            ) : (
              <span className="text-lg font-light tracking-[0.25em] uppercase text-white/70" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {t("proposal")}
              </span>
            )}
            <div className="flex items-center gap-2 text-xs text-amber-100/60">
              <Clock className="h-3.5 w-3.5" />
              <span>{t("expiresIn")} {getTimeRemaining()}</span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-16 space-y-14 pb-32">
          {/* Greeting */}
          <div
            className={`transition-all duration-700 ${animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          >
            <p className="text-[11px] text-amber-200/60 uppercase tracking-[0.3em] mb-3">{t("proposalFor")}</p>
            <h1
              className="text-4xl md:text-6xl font-light tracking-tight bg-gradient-to-br from-white via-white to-amber-100/70 bg-clip-text text-transparent"
              style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', serif" }}
            >
              {proposal.client_name}
            </h1>
            <div className="mt-6 h-px w-24 bg-gradient-to-r from-amber-200/60 to-transparent" />
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 backdrop-blur-xl">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{t("total")}</p>
                <p className="mt-2 text-2xl font-light text-white">{formatCurrency(proposal.total_value, proposal.currency)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 backdrop-blur-xl">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{t("expiresIn")}</p>
                <p className="mt-2 text-2xl font-light text-white">{getTimeRemaining()}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-4 backdrop-blur-xl">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{t("services")}</p>
                <p className="mt-2 text-2xl font-light text-white">{proposal.services.length}</p>
              </div>
            </div>
          </div>

          {/* Scope */}
          {proposal.scope_description && (
            <section
              className={`transition-all duration-700 delay-150 ${animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
            >
              <h2 className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60 mb-4">{t("projectScope")}</h2>
              <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl p-7 md:p-9 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
                <div
                  className="prose prose-invert prose-sm md:prose-base max-w-none text-white/80 leading-relaxed
                    [&_p]:my-3 [&_p]:leading-relaxed
                    [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:font-light [&_h1]:tracking-wide [&_h1]:text-white [&_h1]:text-2xl
                    [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:font-light [&_h2]:tracking-wide [&_h2]:text-white [&_h2]:text-xl
                    [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:font-light [&_h3]:text-white/95 [&_h3]:text-lg
                    [&_ul]:my-3 [&_ul]:pl-5 [&_ul]:list-disc [&_ul>li]:my-1
                    [&_ol]:my-3 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol>li]:my-1
                    [&_strong]:text-white [&_strong]:font-semibold
                    [&_em]:italic [&_a]:text-amber-200 [&_a]:underline [&_a]:underline-offset-2
                    [&_blockquote]:border-l-2 [&_blockquote]:border-amber-200/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/70 [&_blockquote]:my-4
                    [&_hr]:my-6 [&_hr]:border-white/10"
                  dangerouslySetInnerHTML={{ __html: proposal.scope_description }}
                />
              </div>
            </section>
          )}

          {/* Services */}
          <section
            className={`transition-all duration-700 delay-300 ${animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          >
            <h2 className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60 mb-4">{t("services")}</h2>
            <div className="space-y-3">
              {proposal.services.map((svc, i) => (
                <div
                  key={i}
                  className="group flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.05] to-white/[0.02] backdrop-blur-xl px-6 py-5 hover:border-amber-200/20 hover:from-white/[0.08] transition-all"
                >
                  <div>
                    <p className="text-sm font-medium text-white/90">{svc.name}</p>
                    {svc.description && (
                      <p className="text-xs text-white/50 mt-1">{svc.description}</p>
                    )}
                  </div>
                  <span className="text-sm font-medium text-amber-100/80 shrink-0 ml-4 tabular-nums">
                    {formatCurrency(svc.value, proposal.currency)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Investment */}
          <section
            className={`transition-all duration-700 delay-[450ms] ${animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          >
            <h2 className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60 mb-4">{t("investment")}</h2>
            <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] backdrop-blur-xl p-7 md:p-9 overflow-hidden shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
              <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl pointer-events-none" />
              <div className="relative flex items-end justify-between mb-4">
                <span className="text-xs uppercase tracking-[0.2em] text-white/50">{t("total")}</span>
                <span
                  className="text-4xl md:text-5xl font-light tracking-tight bg-gradient-to-br from-white to-amber-200/80 bg-clip-text text-transparent tabular-nums"
                  style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                  {formatCurrency(proposal.total_value, proposal.currency)}
                </span>
              </div>
              {proposal.investment_description && (
                <div
                  className="relative prose prose-invert prose-sm max-w-none text-white/70 leading-relaxed border-t border-white/10 pt-5
                    [&_p]:my-2.5 [&_p]:leading-relaxed
                    [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:font-light [&_h1]:text-white [&_h1]:text-xl
                    [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:font-light [&_h2]:text-white [&_h2]:text-lg
                    [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:font-light [&_h3]:text-white/95 [&_h3]:text-base
                    [&_ul]:my-2.5 [&_ul]:pl-5 [&_ul]:list-disc [&_ul>li]:my-1
                    [&_ol]:my-2.5 [&_ol]:pl-5 [&_ol]:list-decimal [&_ol>li]:my-1
                    [&_strong]:text-white [&_strong]:font-semibold
                    [&_em]:italic [&_a]:text-amber-200 [&_a]:underline [&_a]:underline-offset-2
                    [&_blockquote]:border-l-2 [&_blockquote]:border-amber-200/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/70 [&_blockquote]:my-3
                    [&_hr]:my-5 [&_hr]:border-white/10"
                  dangerouslySetInnerHTML={{ __html: proposal.investment_description }}
                />
              )}
            </div>
          </section>
        </main>

        {/* Floating Accept Button */}
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 px-6">
          <button
            onClick={() => setAcceptOpen(true)}
            className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-amber-100 via-white to-amber-100 text-[#0a0a14] px-9 py-4 text-sm font-medium shadow-[0_20px_60px_-10px_rgba(251,191,36,0.45)] hover:shadow-[0_25px_70px_-10px_rgba(251,191,36,0.65)] hover:scale-[1.03] transition-all duration-300"
          >
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-200/0 via-amber-200/40 to-amber-200/0 opacity-0 group-hover:opacity-100 blur-md transition-opacity" />
            <CheckCircle2 className="relative h-4 w-4" />
            <span className="relative tracking-wide">{t("acceptProposal")}</span>
          </button>
        </div>

        {/* Accept Dialog */}
        <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
          <DialogContent className="bg-[#0f0e1a] border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white font-light text-xl tracking-wide" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {t("acceptTitle")}
              </DialogTitle>
              <DialogDescription className="text-white/50">
                {t("acceptDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-white/70">{t("fullName")}</Label>
                <Input
                  value={acceptName}
                  onChange={(e) => setAcceptName(e.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  className="bg-white text-black placeholder:text-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">{loc === "pt" ? "E-mail" : "Email"}</Label>
                <Input
                  type="email"
                  value={acceptEmail}
                  onChange={(e) => setAcceptEmail(e.target.value)}
                  placeholder={loc === "pt" ? "seu@email.com" : "your@email.com"}
                  className="bg-white text-black placeholder:text-black/40 border-white/10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/70">{t("digitalSignature")}</Label>
                <div className="relative">
                  <Pen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40 z-10" />
                  <Input
                    value={acceptSignature}
                    onChange={(e) => setAcceptSignature(e.target.value)}
                    placeholder={t("signaturePlaceholder")}
                    className="bg-white text-black placeholder:text-black/40 border-white/10 pl-10 italic font-serif text-lg"
                  />
                </div>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-amber-100 via-white to-amber-100 text-[#0a0a14] hover:opacity-95 font-medium tracking-wide"
                onClick={handleAccept}
                disabled={submitting}
              >
                {submitting ? t("processing") : t("confirmAccept")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
