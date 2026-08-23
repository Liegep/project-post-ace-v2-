import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileSignature,
  FileText,
  FolderOpen,
  Pencil,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";

import { RichTextEditor } from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useProposals, Proposal, ProposalService } from "@/hooks/useProposals";
import { useUserRole } from "@/hooks/useUserRole";
import { ProposalLocale, PROPOSAL_LOCALE_FLAGS, PROPOSAL_LOCALE_LABELS, getProposalT } from "@/i18n/proposalTranslations";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCIES, formatCurrency } from "@/lib/currency";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-white/10 text-white/80 border-white/10" },
  sent: { label: "Enviada", className: "bg-sky-400/15 text-sky-200 border-sky-300/20" },
  viewed: { label: "Visualizada", className: "bg-emerald-400/15 text-emerald-200 border-emerald-300/20" },
  accepted: { label: "Aceita", className: "bg-green-400/15 text-green-200 border-green-300/20" },
  expired: { label: "Expirada", className: "bg-rose-400/15 text-rose-200 border-rose-300/20" },
};

const STATUS_SECTIONS: Array<{
  key: Proposal["status"];
  title: string;
  description: string;
}> = [
  { key: "sent", title: "Enviadas", description: "Links ativos aguardando resposta." },
  { key: "viewed", title: "Visualizadas", description: "O cliente já abriu esta proposta." },
  { key: "accepted", title: "Aceitas", description: "Propostas aprovadas pelo cliente." },
  { key: "draft", title: "Rascunhos", description: "Ainda não enviadas." },
  { key: "expired", title: "Expiradas", description: "Validade encerrada." },
];

interface ProposalTemplate {
  id: string;
  name: string;
  scope_description: string;
  investment_description: string;
  services: ProposalService[];
  currency: string;
  locale: string;
}

const emptyService = (): ProposalService => ({ name: "", description: "", value: 0 });

function ProposalPreview({
  clientName,
  scopeDescription,
  investmentDescription,
  currency,
  deadlineDays,
  locale,
  proposalType,
  plan,
  piecesQuantity,
  services,
}: {
  clientName: string;
  scopeDescription: string;
  investmentDescription: string;
  currency: string;
  deadlineDays: number;
  locale: ProposalLocale;
  proposalType: string;
  plan: string;
  piecesQuantity: number;
  services: ProposalService[];
}) {
  const t = getProposalT(locale);
  const totalValue = services.reduce((sum, service) => sum + (service.value || 0), 0);
  const previewClientName = clientName.trim() || "Cliente em análise";
  const expiresAt = addDays(new Date(), Math.max(1, deadlineDays || 7));
  const activeServices = services.filter((service) => service.name.trim());

  return (
    <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#080912] text-white shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85)]">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.22),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.24),_transparent_32%),linear-gradient(180deg,_#12131d_0%,_#090a11_100%)]" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />

        <div className="relative space-y-10 px-6 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-sky-200/70">
                <FileSignature className="h-3.5 w-3.5" />
                Pré-visualização da proposta
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-white">Página do cliente antes do envio</h3>
              <p className="max-w-xl text-sm text-white/60">
                Esse preview usa os dados atuais do editor e já simula a validade do link por {Math.max(1, deadlineDays || 7)} dias.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[280px]">
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Expira em</p>
                <p className="mt-2 text-lg font-semibold text-white">{format(expiresAt, "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Idioma</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {PROPOSAL_LOCALE_FLAGS[locale]} {PROPOSAL_LOCALE_LABELS[locale]}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200/65">{t("proposalFor")}</p>
                <h2 className="mt-4 text-4xl font-light tracking-tight text-white sm:text-5xl">
                  {previewClientName}
                </h2>
                <div className="mt-6 h-px w-28 bg-gradient-to-r from-sky-300/80 to-transparent" />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Tipo</p>
                  <p className="mt-2 text-base font-medium text-white">
                    {proposalType === "monthly" ? "Mensal" : "Projeto"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Plano</p>
                  <p className="mt-2 text-base font-medium text-white capitalize">{plan || "Sob medida"}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Qtd. de peças</p>
                  <p className="mt-2 text-base font-medium text-white">{piecesQuantity || 0}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-sky-300/10 bg-gradient-to-br from-sky-400/10 via-white/[0.04] to-violet-400/10 p-6 backdrop-blur-xl">
              <p className="text-[11px] uppercase tracking-[0.32em] text-white/55">{t("investment")}</p>
              <p className="mt-5 text-4xl font-light tracking-tight text-white">
                {formatCurrency(totalValue, currency)}
              </p>
              <div className="mt-6 space-y-3 text-sm text-white/65">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>{t("services")}</span>
                  <span className="font-medium text-white">{activeServices.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>Moeda</span>
                  <span className="font-medium text-white">{currency}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <span>Validade do link</span>
                  <span className="font-medium text-white">{Math.max(1, deadlineDays || 7)} dias</span>
                </div>
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200/60">{t("projectScope")}</p>
            <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
              {scopeDescription ? (
                <div
                  className="prose prose-invert prose-sm md:prose-base max-w-none text-white/82
                    [&_p]:my-3 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-white [&_h2]:font-medium
                    [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-white/95 [&_ul]:my-3 [&_ul]:pl-5 [&_ul]:list-disc
                    [&_ol]:my-3 [&_ol]:pl-5 [&_ol]:list-decimal [&_blockquote]:border-l-2 [&_blockquote]:border-white/20
                    [&_blockquote]:pl-4 [&_blockquote]:italic [&_hr]:my-5 [&_hr]:border-white/10"
                  dangerouslySetInnerHTML={{ __html: scopeDescription }}
                />
              ) : (
                <p className="text-sm text-white/45">Adicione o escopo do projeto para visualizar esta seção.</p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200/60">{t("services")}</p>
            <div className="grid gap-3">
              {activeServices.length > 0 ? (
                activeServices.map((service, index) => (
                  <div
                    key={`${service.name}-${index}`}
                    className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium text-white">{service.name}</p>
                      {service.description && <p className="mt-1 text-sm text-white/55">{service.description}</p>}
                    </div>
                    <span className="shrink-0 text-lg font-medium text-sky-200">
                      {formatCurrency(service.value || 0, currency)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-black/10 px-5 py-8 text-sm text-white/45">
                  Adicione pelo menos um serviço para visualizar a composição da proposta.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <p className="text-[11px] uppercase tracking-[0.32em] text-amber-200/60">{t("investment")}</p>
            <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-6">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">{t("total")}</p>
                  <p className="mt-2 text-4xl font-light tracking-tight text-white">
                    {formatCurrency(totalValue, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/65">
                  Link temporário com validade de {Math.max(1, deadlineDays || 7)} dias.
                </div>
              </div>
              <div className="pt-5">
                {investmentDescription ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none text-white/75
                      [&_p]:my-3 [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-white [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-white/95
                      [&_ul]:my-3 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:my-3 [&_ol]:pl-5 [&_ol]:list-decimal
                      [&_blockquote]:border-l-2 [&_blockquote]:border-white/20 [&_blockquote]:pl-4 [&_blockquote]:italic"
                    dangerouslySetInnerHTML={{ __html: investmentDescription }}
                  />
                ) : (
                  <p className="text-sm text-white/45">Inclua observações, condições de pagamento ou anexos descritivos aqui.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ProposalsPage() {
  const navigate = useNavigate();
  const { userId, isSuperAdmin } = useUserRole();
  const { proposals, loading, refetch } = useProposals();

  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState("edit");
  const [saving, setSaving] = useState(false);

  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [scopeDescription, setScopeDescription] = useState("");
  const [investmentDescription, setInvestmentDescription] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [deadlineDays, setDeadlineDays] = useState(7);
  const [locale, setLocale] = useState<ProposalLocale>("pt");
  const [proposalType, setProposalType] = useState("project");
  const [plan, setPlan] = useState("");
  const [piecesQuantity, setPiecesQuantity] = useState(0);
  const [services, setServices] = useState<ProposalService[]>([emptyService()]);

  const totalValue = useMemo(
    () => services.reduce((sum, service) => sum + (service.value || 0), 0),
    [services],
  );

  const selectedProposal = useMemo(
    () => proposals.find((proposal) => proposal.id === selectedProposalId) || null,
    [proposals, selectedProposalId],
  );

  const currentToken = selectedProposal?.token || null;
  const currentPublicUrl = currentToken ? `${window.location.origin}/proposta/${currentToken}` : null;

  const fillFormFromProposal = useCallback((proposal: Proposal) => {
    setSelectedProposalId(proposal.id);
    setClientName(proposal.client_name || "");
    setClientEmail(proposal.client_email || "");
    setScopeDescription(proposal.scope_description || "");
    setInvestmentDescription(proposal.investment_description || "");
    setCurrency(proposal.currency || "BRL");
    setDeadlineDays(proposal.deadline_days || 7);
    setLocale((proposal.locale || "pt") as ProposalLocale);
    setProposalType(proposal.proposal_type || "project");
    setPlan(proposal.plan || "");
    setPiecesQuantity(proposal.pieces_quantity || 0);
    setServices(proposal.services?.length ? proposal.services : [emptyService()]);
  }, []);

  const resetForm = useCallback(() => {
    setSelectedProposalId(null);
    setClientName("");
    setClientEmail("");
    setScopeDescription("");
    setInvestmentDescription("");
    setCurrency("BRL");
    setDeadlineDays(7);
    setLocale("pt");
    setProposalType("project");
    setPlan("");
    setPiecesQuantity(0);
    setServices([emptyService()]);
    setWorkspaceTab("edit");
  }, []);

  const fetchTemplates = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("proposal_templates")
      .select("*")
      .order("name");

    if (data) {
      setTemplates(
        data.map((template: any) => ({
          ...template,
          services: Array.isArray(template.services) ? template.services : JSON.parse(template.services || "[]"),
        })),
      );
    }
  }, [userId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (loading) return;

    if (selectedProposalId) {
      const exists = proposals.some((proposal) => proposal.id === selectedProposalId);
      if (!exists) {
        if (proposals[0]) {
          fillFormFromProposal(proposals[0]);
        } else {
          resetForm();
        }
      }
      return;
    }

    if (!clientName && !scopeDescription && !investmentDescription && proposals[0]) {
      fillFormFromProposal(proposals[0]);
    }
  }, [
    clientName,
    fillFormFromProposal,
    investmentDescription,
    loading,
    proposals,
    resetForm,
    scopeDescription,
    selectedProposalId,
  ]);

  const loadTemplate = (template: ProposalTemplate) => {
    setScopeDescription(template.scope_description || "");
    setInvestmentDescription(template.investment_description || "");
    setCurrency(template.currency || "BRL");
    setLocale((template.locale || "pt") as ProposalLocale);
    setServices(template.services?.length ? template.services : [emptyService()]);
    toast({ title: `Modelo "${template.name}" carregado` });
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: "Informe o nome do modelo", variant: "destructive" });
      return;
    }

    setSavingTemplate(true);
    const { error } = await supabase.from("proposal_templates").insert({
      user_id: userId!,
      name: templateName.trim(),
      scope_description: scopeDescription.trim(),
      investment_description: investmentDescription.trim(),
      services: services.filter((service) => service.name.trim()) as any,
      currency,
      locale,
    });
    setSavingTemplate(false);

    if (error) {
      toast({ title: "Erro ao salvar modelo", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Modelo salvo com sucesso" });
    setTemplateDialogOpen(false);
    setTemplateName("");
    fetchTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase.from("proposal_templates").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir modelo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Modelo excluído" });
    fetchTemplates();
  };

  const handleSaveProposal = async () => {
    if (!clientName.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return null;
    }

    if (services.every((service) => !service.name.trim())) {
      toast({ title: "Adicione pelo menos um serviço", variant: "destructive" });
      return null;
    }

    setSaving(true);

    const payload = {
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      scope_description: scopeDescription.trim(),
      investment_description: investmentDescription.trim(),
      currency,
      deadline_days: Math.max(1, deadlineDays || 7),
      locale,
      proposal_type: proposalType,
      plan,
      pieces_quantity: Math.max(0, piecesQuantity || 0),
      services: services.filter((service) => service.name.trim()) as any,
      total_value: totalValue,
    };

    const query = selectedProposalId
      ? supabase.from("proposals").update(payload).eq("id", selectedProposalId).select("id").single()
      : supabase.from("proposals").insert({ ...payload, user_id: userId! }).select("id").single();

    const { data, error } = await query;
    setSaving(false);

    if (error) {
      toast({
        title: selectedProposalId ? "Erro ao atualizar proposta" : "Erro ao criar proposta",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    const savedId = data?.id || selectedProposalId;
    if (savedId) setSelectedProposalId(savedId);
    await refetch();

    toast({ title: selectedProposalId ? "Proposta atualizada" : "Proposta criada com sucesso" });
    return savedId || null;
  };

  const handleCopyLink = async () => {
    if (!currentPublicUrl) {
      toast({ title: "Salve a proposta antes de copiar o link", variant: "destructive" });
      return;
    }

    await navigator.clipboard.writeText(currentPublicUrl);
    toast({ title: "Link copiado" });
  };

  const handleOpenPublicPreview = () => {
    if (!currentPublicUrl) {
      toast({ title: "Salve a proposta para abrir a página do cliente", variant: "destructive" });
      return;
    }

    window.open(currentPublicUrl, "_blank", "noopener,noreferrer");
  };

  const handleSendProposal = async () => {
    let proposalId = selectedProposalId;

    if (!proposalId) {
      proposalId = await handleSaveProposal();
    }

    if (!proposalId) return;

    const { error } = await supabase.from("proposals").update({ status: "sent" as any }).eq("id", proposalId);
    if (error) {
      toast({ title: "Erro ao enviar proposta", description: error.message, variant: "destructive" });
      return;
    }

    await refetch();
    if (currentPublicUrl) {
      await navigator.clipboard.writeText(currentPublicUrl);
    }
    toast({ title: "Proposta enviada. O link foi copiado e dura 7 dias." });
  };

  const handleDeleteProposal = async () => {
    if (!selectedProposalId) {
      toast({ title: "Selecione uma proposta para excluir", variant: "destructive" });
      return;
    }

    if (!window.confirm("Deseja realmente excluir esta proposta?")) {
      return;
    }

    const { error } = await supabase.from("proposals").delete().eq("id", selectedProposalId);
    if (error) {
      toast({ title: "Erro ao excluir proposta", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Proposta excluída" });
    await refetch();
    resetForm();
  };

  const groupedProposals = useMemo(() => {
    return STATUS_SECTIONS.map((section) => ({
      ...section,
      items: proposals.filter((proposal) => proposal.status === section.key),
    }));
  }, [proposals]);

  const proposalStats = useMemo(() => {
    return {
      sent: proposals.filter((proposal) => proposal.status === "sent").length,
      viewed: proposals.filter((proposal) => proposal.status === "viewed").length,
      accepted: proposals.filter((proposal) => proposal.status === "accepted").length,
      draft: proposals.filter((proposal) => proposal.status === "draft").length,
      expired: proposals.filter((proposal) => proposal.status === "expired").length,
    };
  }, [proposals]);

  const currentStatusBadge = selectedProposal ? STATUS_BADGE[selectedProposal.status] : STATUS_BADGE.draft;
  const daysLeft = selectedProposal
    ? Math.max(0, differenceInDays(new Date(selectedProposal.expires_at), new Date()))
    : Math.max(1, deadlineDays || 7);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_22%),linear-gradient(180deg,_#191919_0%,_#111111_55%,_#0c0c0f_100%)] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0e13]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-sky-200/70">
                <FileSignature className="h-3.5 w-3.5" />
                Propostas
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-white">Central de propostas comerciais</h1>
              <p className="text-sm text-white/50">
                {isSuperAdmin ? "Biblioteca completa, editor rico e preview antes do envio." : "Gerencie e envie suas propostas."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
              onClick={() => setTemplateDialogOpen(true)}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Salvar modelo
            </Button>
            <Button
              className="bg-gradient-to-r from-sky-400 via-blue-500 to-violet-500 text-white hover:opacity-95"
              onClick={resetForm}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nova proposta
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1800px] gap-6 px-4 py-6 lg:grid-cols-[320px,minmax(0,1fr),320px] sm:px-6">
        <aside className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.85)] backdrop-blur-xl">
          <div className="mb-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Biblioteca</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Aceitas, enviadas e em andamento</h2>
            <p className="mt-2 text-sm text-white/55">
              O espaço para propostas recusadas já ficou preparado visualmente. Falta apenas o status no banco para ativar de ponta a ponta.
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Enviadas</p>
              <p className="mt-2 text-2xl font-semibold text-white">{proposalStats.sent}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Aceitas</p>
              <p className="mt-2 text-2xl font-semibold text-white">{proposalStats.accepted}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Visualizadas</p>
              <p className="mt-2 text-2xl font-semibold text-white">{proposalStats.viewed}</p>
            </div>
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Recusadas</p>
              <p className="mt-2 text-2xl font-semibold text-white/40">0</p>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-270px)] pr-3">
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-2xl bg-white/5" />
                  ))}
                </div>
              ) : proposals.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/15 bg-black/10 px-4 py-10 text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-white/25" />
                  <p className="text-sm text-white/55">Nenhuma proposta criada ainda.</p>
                  <Button className="mt-4 bg-white text-black hover:bg-white/90" onClick={resetForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar primeira proposta
                  </Button>
                </div>
              ) : (
                groupedProposals.map((section) => (
                  <section key={section.key} className="space-y-3">
                    <div className="px-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                        <span className="text-xs text-white/45">{section.items.length}</span>
                      </div>
                      <p className="mt-1 text-xs text-white/45">{section.description}</p>
                    </div>

                    {section.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-3 text-xs text-white/35">
                        Nada por aqui no momento.
                      </div>
                    ) : (
                      section.items.map((proposal) => {
                        const badge = STATUS_BADGE[proposal.status] || STATUS_BADGE.draft;
                        const isActive = proposal.id === selectedProposalId;

                        return (
                          <button
                            key={proposal.id}
                            type="button"
                            onClick={() => fillFormFromProposal(proposal)}
                            className={`w-full rounded-[24px] border p-4 text-left transition-all ${
                              isActive
                                ? "border-sky-300/40 bg-sky-300/10 shadow-[0_18px_45px_-25px_rgba(56,189,248,0.7)]"
                                : "border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">{proposal.client_name}</p>
                                <p className="mt-1 truncate text-xs text-white/45">{proposal.client_email || "Sem e-mail"}</p>
                              </div>
                              <Badge variant="outline" className={badge.className}>
                                {badge.label}
                              </Badge>
                            </div>

                            <div className="mt-4 flex items-center justify-between text-xs text-white/55">
                              <span>{formatCurrency(proposal.total_value, proposal.currency)}</span>
                              <span>{format(new Date(proposal.created_at), "dd/MM", { locale: ptBR })}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </section>
                ))
              )}
            </div>
          </ScrollArea>
        </aside>

        <section className="space-y-6">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_35px_100px_-55px_rgba(0,0,0,0.9)] backdrop-blur-xl sm:p-6">
            <div className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {selectedProposal ? selectedProposal.client_name : "Nova proposta comercial"}
                  </h2>
                  <Badge variant="outline" className={currentStatusBadge.className}>
                    {selectedProposal ? currentStatusBadge.label : "Em edição"}
                  </Badge>
                </div>
                <p className="mt-2 max-w-2xl text-sm text-white/55">
                  Monte a proposta com o mesmo editor rico do kanban, acompanhe o total em tempo real e valide a página final antes de gerar o link temporário.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Moeda</p>
                  <p className="mt-2 text-base font-medium text-white">{currency}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Validade</p>
                  <p className="mt-2 text-base font-medium text-white">{Math.max(1, deadlineDays || 7)} dias</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Serviços</p>
                  <p className="mt-2 text-base font-medium text-white">{services.filter((service) => service.name.trim()).length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Total</p>
                  <p className="mt-2 text-base font-medium text-white">{formatCurrency(totalValue, currency)}</p>
                </div>
              </div>
            </div>

            <Tabs value={workspaceTab} onValueChange={setWorkspaceTab} className="mt-5">
              <TabsList className="grid w-full grid-cols-2 bg-white/5 text-white/50">
                <TabsTrigger value="edit" className="data-[state=active]:bg-white data-[state=active]:text-black">
                  Editor
                </TabsTrigger>
                <TabsTrigger value="preview" className="data-[state=active]:bg-white data-[state=active]:text-black">
                  Preview do cliente
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="mt-5 space-y-5">
                {templates.length > 0 && (
                  <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                      <div className="flex items-center gap-2 text-sm text-white/65">
                        <FolderOpen className="h-4 w-4 text-sky-200/70" />
                        Carregue um modelo pronto para acelerar a montagem.
                      </div>
                      <Select
                        onValueChange={(id) => {
                          const template = templates.find((item) => item.id === id);
                          if (template) loadTemplate(template);
                        }}
                      >
                        <SelectTrigger className="border-white/10 bg-white text-black md:ml-auto md:max-w-sm">
                          <SelectValue placeholder="Selecionar modelo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white">Nome do cliente *</Label>
                    <Input
                      value={clientName}
                      onChange={(event) => setClientName(event.target.value)}
                      placeholder="Ex: Empresa ABC"
                      className="h-14 rounded-2xl border-white/10 bg-white text-base text-black placeholder:text-black/35"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white">E-mail</Label>
                    <Input
                      value={clientEmail}
                      onChange={(event) => setClientEmail(event.target.value)}
                      placeholder="email@cliente.com"
                      className="h-14 rounded-2xl border-white/10 bg-white text-base text-black placeholder:text-black/35"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Idioma da proposta</Label>
                  <Select value={locale} onValueChange={(value) => setLocale(value as ProposalLocale)}>
                    <SelectTrigger className="h-14 rounded-2xl border-white/10 bg-white text-base text-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PROPOSAL_LOCALE_LABELS) as ProposalLocale[]).map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {PROPOSAL_LOCALE_FLAGS[loc]} {PROPOSAL_LOCALE_LABELS[loc]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-5 xl:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-white">Tipo de proposta</Label>
                    <Select value={proposalType} onValueChange={setProposalType}>
                      <SelectTrigger className="h-14 rounded-2xl border-white/10 bg-white text-base text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="project">Projeto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Plano</Label>
                    <Select value={plan} onValueChange={setPlan}>
                      <SelectTrigger className="h-14 rounded-2xl border-white/10 bg-white text-base text-black">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="essencial">Essencial</SelectItem>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Qtd. de peças</Label>
                    <Input
                      type="number"
                      min={0}
                      value={piecesQuantity || ""}
                      onChange={(event) => setPiecesQuantity(Number(event.target.value))}
                      placeholder="0"
                      className="h-14 rounded-2xl border-white/10 bg-white text-base text-black placeholder:text-black/35"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Escopo do projeto</Label>
                  <RichTextEditor
                    content={scopeDescription}
                    onChange={setScopeDescription}
                    placeholder="Descreva o escopo dos serviços... Use títulos, listas e negrito para organizar."
                    className="rounded-[28px] border-white/10 shadow-[0_24px_70px_-45px_rgba(255,255,255,0.35)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Descrição do investimento</Label>
                  <RichTextEditor
                    content={investmentDescription}
                    onChange={setInvestmentDescription}
                    placeholder="Condições de pagamento, observações, anexos ou próximos passos."
                    className="rounded-[28px] border-white/10 shadow-[0_24px_70px_-45px_rgba(255,255,255,0.35)]"
                  />
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white">Moeda</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="h-14 rounded-2xl border-white/10 bg-white text-base text-black">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white">Prazo de expiração (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={deadlineDays}
                      onChange={(event) => setDeadlineDays(Number(event.target.value))}
                      className="h-14 rounded-2xl border-white/10 bg-white text-base text-black"
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-[28px] border border-white/10 bg-black/15 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-base font-semibold text-white">Serviços</Label>
                      <p className="mt-1 text-sm text-white/50">Monte a proposta item por item e acompanhe o total no rodapé.</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-white/10 bg-white text-black hover:bg-white/90"
                      onClick={() => setServices([...services, emptyService()])}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {services.map((service, index) => (
                      <div key={index} className="rounded-[24px] border border-white/10 bg-transparent p-4">
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Input
                            placeholder="Nome do serviço"
                            value={service.name}
                            onChange={(event) => {
                              const nextServices = [...services];
                              nextServices[index] = { ...nextServices[index], name: event.target.value };
                              setServices(nextServices);
                            }}
                            className="h-14 flex-1 rounded-2xl border-white/10 bg-white text-base text-black placeholder:text-black/25"
                          />
                          <div className="flex gap-3 sm:w-[280px]">
                            <Input
                              type="number"
                              placeholder="Valor"
                              value={service.value || ""}
                              onChange={(event) => {
                                const nextServices = [...services];
                                nextServices[index] = { ...nextServices[index], value: Number(event.target.value) };
                                setServices(nextServices);
                              }}
                              className="h-14 rounded-2xl border-white/10 bg-white text-base text-black placeholder:text-black/25"
                            />
                            {services.length > 1 && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-14 w-14 shrink-0 rounded-2xl border-white/10 bg-white text-black hover:bg-white/90"
                                onClick={() => setServices(services.filter((_, serviceIndex) => serviceIndex !== index))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <Input
                          placeholder="Descrição (opcional)"
                          value={service.description}
                          onChange={(event) => {
                            const nextServices = [...services];
                            nextServices[index] = { ...nextServices[index], description: event.target.value };
                            setServices(nextServices);
                          }}
                          className="mt-3 h-14 rounded-2xl border-white/10 bg-white text-base text-black placeholder:text-black/25"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end border-t border-white/10 pt-4 text-right">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/45">Total</p>
                      <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totalValue, currency)}</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-5">
                <ProposalPreview
                  clientName={clientName}
                  scopeDescription={scopeDescription}
                  investmentDescription={investmentDescription}
                  currency={currency}
                  deadlineDays={deadlineDays}
                  locale={locale}
                  proposalType={proposalType}
                  plan={plan}
                  piecesQuantity={piecesQuantity}
                  services={services}
                />
              </TabsContent>
            </Tabs>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_30px_90px_-55px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <p className="text-[11px] uppercase tracking-[0.28em] text-sky-200/70">Ações</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Editar, revisar e enviar</h3>
            <p className="mt-2 text-sm text-white/55">
              Aqui você controla a proposta atual, abre a página final e gera o link temporário de 7 dias.
            </p>

            <div className="mt-5 space-y-3">
              <Button
                className="h-12 w-full justify-start rounded-2xl bg-gradient-to-r from-sky-400 via-blue-500 to-violet-500 text-white hover:opacity-95"
                onClick={handleSaveProposal}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {selectedProposal ? "Salvar alterações" : "Criar proposta"}
              </Button>

              <Button
                variant="outline"
                className="h-12 w-full justify-start rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => setWorkspaceTab("preview")}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver preview aqui
              </Button>

              <Button
                variant="outline"
                className="h-12 w-full justify-start rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={handleOpenPublicPreview}
              >
                <FileText className="mr-2 h-4 w-4" />
                Abrir página do cliente
              </Button>

              <Button
                variant="outline"
                className="h-12 w-full justify-start rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={handleCopyLink}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar link temporário
              </Button>

              <Button
                className="h-12 w-full justify-start rounded-2xl bg-white text-black hover:bg-white/90"
                onClick={handleSendProposal}
              >
                <Send className="mr-2 h-4 w-4" />
                {selectedProposal?.status === "sent" || selectedProposal?.status === "viewed" ? "Reenviar proposta" : "Enviar proposta"}
              </Button>

              <Button
                variant="outline"
                className="h-12 w-full justify-start rounded-2xl border-rose-400/20 bg-rose-400/10 text-rose-100 hover:bg-rose-400/15"
                onClick={handleDeleteProposal}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir proposta
              </Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
            <div className="flex items-center gap-2 text-sm text-white/75">
              <Clock className="h-4 w-4 text-amber-200/70" />
              Link temporário e proposta com a mesma validade
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Prazo atual</p>
              <p className="mt-2 text-2xl font-semibold text-white">{daysLeft} dia(s)</p>
              <p className="mt-2 text-sm text-white/55">
                Ao enviar, a proposta fica disponível por 7 dias para o cliente visualizar e aceitar.
              </p>
            </div>

            {selectedProposal && (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Status</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className={currentStatusBadge.className}>
                      {currentStatusBadge.label}
                    </Badge>
                    {selectedProposal.viewed_at && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Última atualização</p>
                  <p className="mt-2 text-sm font-medium text-white">
                    {format(new Date(selectedProposal.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>

                {currentPublicUrl && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Página pública</p>
                    <p className="mt-2 break-all text-xs text-white/60">{currentPublicUrl}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
            <div className="flex items-start gap-3">
              <Pencil className="mt-0.5 h-4 w-4 text-sky-200/80" />
              <div>
                <h4 className="text-sm font-semibold text-white">Layout inspirado no editor do kanban</h4>
                <p className="mt-2 text-sm text-white/55">
                  Mantive o editor rico claro sobre fundo escuro e trouxe o preview do lado do fluxo para você revisar sem perder contexto.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="border-white/10 bg-[#14151d] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Salvar como modelo</DialogTitle>
            <DialogDescription className="text-white/50">
              Guarde este conteúdo para reaproveitar escopo, investimento e serviços nas próximas propostas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white">Nome do modelo</Label>
              <Input
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                placeholder="Ex: Proposta mensal premium"
                className="h-12 rounded-2xl border-white/10 bg-white text-black placeholder:text-black/35"
              />
            </div>

            {templates.length > 0 && (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <FolderOpen className="h-4 w-4 text-sky-200/70" />
                  Modelos existentes
                </div>
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div key={template.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{template.name}</p>
                        <p className="truncate text-xs text-white/40">{template.services.length} serviço(s)</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-rose-200 hover:bg-rose-400/10 hover:text-rose-100"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-sky-400 via-blue-500 to-violet-500 text-white hover:opacity-95"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
            >
              <Save className="mr-2 h-4 w-4" />
              Salvar modelo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
