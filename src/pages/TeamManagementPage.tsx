import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n/I18nContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LanguageSelector } from "@/components/LanguageSelector";
import { MobileNav } from "@/components/MobileNav";
import { ArrowLeft, Plus, Users, Pencil, Trash2, Shield, UserCheck, Eye, Globe2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
}

interface Assignment {
  user_id: string;
  client_id: string;
}

interface UserRoleRow {
  user_id: string;
  role: string;
}

type AppRole = "super_admin" | "admin" | "colaborador" | "client";

const ROLE_CONFIG: Record<AppRole, { label: string; badgeClassName: string; icon: typeof Shield; description: string }> = {
  super_admin: {
    label: "Super Admin",
    badgeClassName: "border-red-200 bg-red-50 text-red-500",
    icon: Shield,
    description: "Acesso total ao sistema e gestão completa de permissões.",
  },
  admin: {
    label: "Admin",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-500",
    icon: UserCheck,
    description: "Gerencia sua carteira de clientes e acompanha a operação.",
  },
  colaborador: {
    label: "Colaborador",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-500",
    icon: Users,
    description: "Atua nos clientes atribuídos e colabora com a equipe.",
  },
  client: {
    label: "Cliente",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-500",
    icon: Eye,
    description: "Acessa apenas o portal do cliente vinculado.",
  },
};

const FILTERS: Array<{ value: "all" | AppRole; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "colaborador", label: "Colaborador" },
  { value: "client", label: "Cliente" },
];

const TeamManagementPage = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isSuperAdmin } = useUserRole();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [selectedNewRole, setSelectedNewRole] = useState<AppRole>("admin");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<AppRole>("admin");
  const [formClientIds, setFormClientIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);

    const [profilesRes, clientsRes, assignmentsRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name, slug, logo_url").order("name"),
      supabase.from("user_client_assignments").select("user_id, client_id"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    setMembers((profilesRes.data as TeamMember[]) || []);
    setClients((clientsRes.data as Client[]) || []);
    setAssignments((assignmentsRes.data as Assignment[]) || []);
    setUserRoles((rolesRes.data as UserRoleRow[]) || []);
    setLoading(false);
  };

  const getUserRole = (userId: string): AppRole | null => {
    const found = userRoles.find((row) => row.user_id === userId)?.role;
    if (!found) return null;
    if (found === "super_admin" || found === "admin" || found === "colaborador" || found === "client") {
      return found;
    }
    return null;
  };

  const memberCounts = useMemo(() => {
    return FILTERS.reduce<Record<string, number>>((acc, filter) => {
      if (filter.value === "all") {
        acc.all = members.length;
        return acc;
      }
      acc[filter.value] = members.filter((member) => getUserRole(member.id) === filter.value).length;
      return acc;
    }, { all: members.length });
  }, [members, userRoles]);

  const filteredMembers = useMemo(() => {
    if (roleFilter === "all") return members;
    return members.filter((member) => getUserRole(member.id) === roleFilter);
  }, [members, roleFilter, userRoles]);

  const createRoleOptions = useMemo<AppRole[]>(
    () => (isSuperAdmin ? ["super_admin", "admin", "colaborador", "client"] : ["admin", "colaborador", "client"]),
    [isSuperAdmin]
  );

  const roleOptions = useMemo<AppRole[]>(
    () => (isSuperAdmin ? ["super_admin", "admin", "colaborador", "client"] : ["admin", "colaborador", "client"]),
    [isSuperAdmin]
  );

  const resetCreateForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormRole("admin");
    setFormClientIds(new Set());
  };

  useEffect(() => {
    resetCreateForm();
  }, [isSuperAdmin]);

  const getMemberClients = (memberId: string) => {
    const memberAssignments = assignments.filter((assignment) => assignment.user_id === memberId);
    return clients.filter((client) => memberAssignments.some((assignment) => assignment.client_id === client.id));
  };

  const toggleClientSelection = (
    clientId: string,
    setState: Dispatch<SetStateAction<Set<string>>>,
    singleSelection = false
  ) => {
    setState((previous) => {
      if (singleSelection) {
        return previous.has(clientId) ? new Set() : new Set([clientId]);
      }

      const next = new Set(previous);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const openAssign = (member: TeamMember) => {
    setSelectedMember(member);
    setSelectedClientIds(new Set(getMemberClients(member.id).map((client) => client.id)));
    setAssignOpen(true);
  };

  const openRoleDialog = (member: TeamMember) => {
    const currentRole = getUserRole(member.id) || "admin";
    setSelectedMember(member);
    setSelectedNewRole(currentRole);
    setRoleDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formName || !formEmail || !formPassword) return;

    setSaving(true);

    try {
      const clientIds = formRole === "super_admin" ? [] : Array.from(formClientIds);
      const normalizedClientIds = formRole === "client" ? clientIds.slice(0, 1) : clientIds;

      const { data, error } = await supabase.functions.invoke("create-team-member", {
        body: {
          email: formEmail,
          password: formPassword,
          full_name: formName,
          role: formRole,
          client_ids: normalizedClientIds,
        },
      });

      if (error || data?.error) {
        toast({
          title: "Erro",
          description: data?.error || "Erro ao criar membro",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: t("teamMemberCreated"),
        description: `${formName} foi criado como ${ROLE_CONFIG[formRole].label}.`,
      });

      setCreateOpen(false);
      resetCreateForm();
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (!selectedMember || !selectedNewRole) return;

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke("update-user-role", {
        body: {
          target_user_id: selectedMember.id,
          new_role: selectedNewRole,
        },
      });

      if (error || data?.error) {
        toast({
          title: "Erro",
          description: data?.error || error?.message,
          variant: "destructive",
        });
        return;
      }

      if (selectedNewRole === "super_admin") {
        await supabase.from("user_client_assignments").delete().eq("user_id", selectedMember.id);
      }

      toast({
        title: "Papel atualizado",
        description: `${selectedMember.full_name} agora é ${ROLE_CONFIG[selectedNewRole].label}.`,
      });

      setRoleDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAssignments = async () => {
    if (!selectedMember) return;

    setSaving(true);

    try {
      const selectedRole = getUserRole(selectedMember.id);
      const normalizedClientIds =
        selectedRole === "super_admin" ? [] : selectedRole === "client" ? Array.from(selectedClientIds).slice(0, 1) : Array.from(selectedClientIds);

      await supabase.from("user_client_assignments").delete().eq("user_id", selectedMember.id);

      if (normalizedClientIds.length > 0) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const rows = normalizedClientIds.map((clientId) => ({
          user_id: selectedMember.id,
          client_id: clientId,
          assigned_by: session?.user?.id || null,
        }));

        await supabase.from("user_client_assignments").insert(rows as never[]);
      }

      toast({ title: t("assignmentsUpdated") });
      setAssignOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (member: TeamMember) => {
    if (!confirm(t("confirmDeleteMember"))) return;

    try {
      const { data, error } = await supabase.functions.invoke("delete-auth-user", {
        body: { user_id: member.id },
      });

      if (error || data?.error) {
        toast({
          title: "Erro",
          description: data?.error || error?.message,
          variant: "destructive",
        });
        return;
      }

      fetchAll();
      toast({ title: t("memberDeleted") });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const RoleBadge = ({ role }: { role: AppRole | null }) => {
    if (!role) {
      return <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">Sem papel</span>;
    }

    const config = ROLE_CONFIG[role];
    const Icon = config.icon;

    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", config.badgeClassName)}>
        <Icon className="h-3.5 w-3.5" />
        {config.label}
      </span>
    );
  };

  const renderClientSelector = (
    selectedIds: Set<string>,
    setState: Dispatch<SetStateAction<Set<string>>>,
    role: AppRole,
    emptyLabel: string
  ) => {
    if (role === "super_admin") {
      return <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Super Admin não precisa de clientes vinculados.</p>;
    }

    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-900">
            {role === "client" ? "Selecione 1 cliente" : "Selecione os clientes"}
          </p>
          <span className="text-xs text-slate-400">
            {selectedIds.size} {selectedIds.size === 1 ? "selecionado" : "selecionados"}
          </span>
        </div>

        <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
          {clients.map((client) => (
            <label
              key={client.id}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-3 py-2.5 transition-colors hover:border-sky-200 hover:bg-sky-50/60"
            >
              <Checkbox
                checked={selectedIds.has(client.id)}
                onCheckedChange={() => toggleClientSelection(client.id, setState, role === "client")}
              />
              <div className="flex min-w-0 items-center gap-2">
                {client.logo_url ? (
                  <img src={client.logo_url} alt="" className="h-6 w-6 rounded-full border border-slate-200 object-contain bg-white" />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Globe2 className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="truncate text-sm text-slate-700">{client.name}</span>
              </div>
            </label>
          ))}

          {clients.length === 0 && <p className="px-1 py-2 text-sm text-slate-500">{emptyLabel}</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#eef6ff_0%,#f8f5ff_48%,#fffdfb_100%)] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/88 px-4 py-5 shadow-[0_20px_50px_-38px_rgba(76,102,186,0.45)] backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 md:gap-4">
            <MobileNav title="Equipe" />
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-14 w-14 rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_-22px_rgba(15,23,42,0.7)] transition-colors hover:bg-slate-900 md:inline-flex"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-5 w-5 text-slate-900 transition-colors group-hover:text-white" strokeWidth={2.4} />
            </Button>
            <div className="min-w-0">
              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 md:text-4xl">
                <Users className="h-7 w-7 shrink-0 text-slate-900 md:h-9 md:w-9" />
                <span className="truncate">Gestão da Equipe</span>
              </h1>
              <p className="mt-1 text-sm text-slate-500 md:text-xl">Gerencie os membros da equipe e atribuições</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden md:block">
              <LanguageSelector />
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="h-12 rounded-2xl bg-gradient-to-r from-sky-500 via-sky-500 to-violet-600 px-5 text-sm font-semibold text-white shadow-[0_20px_40px_-22px_rgba(95,78,255,0.95)] hover:from-sky-600 hover:to-violet-700 md:h-14 md:px-7 md:text-base"
            >
              <Plus className="mr-2 h-4 w-4 md:h-5 md:w-5" />
              Novo Membro
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <div className="mb-8 flex flex-wrap gap-3">
          {FILTERS.map((filter) => {
            const active = roleFilter === filter.value;
            const count = memberCounts[filter.value];
            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => setRoleFilter(filter.value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold shadow-sm transition-all md:text-base",
                  active
                    ? "border-indigo-400 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 bg-white/80 text-slate-500 hover:border-slate-300 hover:bg-white"
                )}
              >
                <span>{filter.label}</span>
                <span className={cn("text-sm", active ? "text-indigo-400" : "text-slate-400")}>({count || 0})</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-[32px] border border-white/80 bg-white/85 px-8 py-16 text-center shadow-[0_25px_70px_-45px_rgba(99,102,241,0.35)]">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Users className="h-8 w-8 text-slate-400" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">{t("noTeamMembers")}</h2>
            <p className="mt-2 text-sm text-slate-500">{t("createFirstMember")}</p>
            <Button
              onClick={() => setCreateOpen(true)}
              className="mt-6 rounded-2xl bg-gradient-to-r from-sky-500 to-violet-600 px-6 text-white hover:from-sky-600 hover:to-violet-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Membro
            </Button>
          </div>
        ) : (
          <div className="space-y-7">
            {filteredMembers.map((member) => {
              const role = getUserRole(member.id);
              const memberClients = getMemberClients(member.id);

              return (
                <section
                  key={member.id}
                  className="rounded-[30px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_25px_70px_-48px_rgba(71,85,105,0.45)] backdrop-blur md:p-8"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <h2 className="truncate text-2xl font-semibold text-slate-900">{member.full_name}</h2>
                        <RoleBadge role={role} />
                      </div>
                      <p className="text-xl text-slate-500">{member.email}</p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {memberClients.map((client) => (
                          <span
                            key={client.id}
                            className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-500"
                          >
                            {client.logo_url ? (
                              <img src={client.logo_url} alt="" className="h-5 w-5 rounded-full border border-white object-contain bg-white" />
                            ) : (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400">
                                <Globe2 className="h-3 w-3" />
                              </span>
                            )}
                            <span>{client.name}</span>
                          </span>
                        ))}
                      </div>

                      {memberClients.length === 0 && role !== "super_admin" && (
                        <p className="mt-4 text-sm text-slate-400">Nenhum cliente atribuído ainda.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                      {isSuperAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRoleDialog(member)}
                          className="h-14 rounded-2xl border-slate-200 bg-white px-5 text-lg font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                        >
                          <Shield className="mr-2 h-5 w-5" />
                          Papel
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAssign(member)}
                        className="h-14 rounded-2xl border-slate-200 bg-white px-5 text-lg font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                      >
                        <Pencil className="mr-2 h-5 w-5" />
                        Atribuir Clientes
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeleteMember(member)}
                          className="h-14 w-14 rounded-2xl border-slate-200 bg-white text-red-500 shadow-sm hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-2xl rounded-[28px] border-slate-200 bg-[#fcfdff] p-0 shadow-[0_30px_90px_-40px_rgba(76,102,186,0.45)]">
          <div className="border-b border-slate-100 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-slate-900">Novo Membro</DialogTitle>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 py-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="Nome do membro" className="h-12 rounded-2xl" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(event) => setFormEmail(event.target.value)}
                  placeholder="membro@empresa.com"
                  className="h-12 rounded-2xl"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-2">
                <Label>{t("password")}</Label>
                <Input
                  type="password"
                  value={formPassword}
                  onChange={(event) => setFormPassword(event.target.value)}
                  placeholder={t("minChars")}
                  className="h-12 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select
                  value={formRole}
                  onValueChange={(value) => {
                    const nextRole = value as AppRole;
                    setFormRole(nextRole);
                    if (nextRole === "super_admin") {
                      setFormClientIds(new Set());
                    }
                    if (nextRole === "client" && formClientIds.size > 1) {
                      setFormClientIds(new Set([Array.from(formClientIds)[0]]));
                    }
                  }}
                >
                  <SelectTrigger className="h-12 rounded-2xl">
                    <SelectValue placeholder="Selecione um papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {createRoleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_CONFIG[role].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">{ROLE_CONFIG[formRole].label}</p>
              <p className="mt-1 text-sm text-slate-500">{ROLE_CONFIG[formRole].description}</p>
            </div>

            {renderClientSelector(formClientIds, setFormClientIds, formRole, "Nenhum cliente disponível para vincular.")}

            <Button
              onClick={handleCreate}
              disabled={saving || !formName || !formEmail || !formPassword}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-violet-600 text-base font-semibold text-white hover:from-sky-600 hover:to-violet-700"
            >
              {saving ? t("saving") : "Criar membro"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px] border-slate-200 bg-[#fcfdff] p-0 shadow-[0_30px_90px_-40px_rgba(76,102,186,0.45)]">
          <div className="border-b border-slate-100 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                <Shield className="h-5 w-5" />
                Alterar Papel
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <p className="text-sm text-slate-400">Membro selecionado</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{selectedMember?.full_name}</p>
              <p className="text-sm text-slate-500">{selectedMember?.email}</p>
            </div>

            <div className="space-y-3">
              {roleOptions.map((role) => {
                const config = ROLE_CONFIG[role];
                const Icon = config.icon;
                const active = selectedNewRole === role;

                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedNewRole(role)}
                    className={cn(
                      "w-full rounded-[24px] border px-4 py-4 text-left transition-colors",
                      active ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl", active ? "bg-white text-sky-500" : "bg-slate-100 text-slate-500")}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{config.label}</p>
                        <p className="mt-1 text-sm text-slate-500">{config.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <Button onClick={handleSaveRole} disabled={saving} className="h-12 w-full rounded-2xl text-base font-semibold">
              {saving ? "Salvando..." : "Salvar papel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl rounded-[28px] border-slate-200 bg-[#fcfdff] p-0 shadow-[0_30px_90px_-40px_rgba(76,102,186,0.45)]">
          <div className="border-b border-slate-100 px-6 py-5">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-slate-900">
                {selectedMember ? `Atribuir Clientes para ${selectedMember.full_name}` : "Atribuir Clientes"}
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="space-y-6 px-6 py-6">
            {selectedMember && renderClientSelector(
              selectedClientIds,
              setSelectedClientIds,
              getUserRole(selectedMember.id) || "admin",
              "Nenhum cliente cadastrado."
            )}

            <Button
              onClick={handleSaveAssignments}
              disabled={saving}
              className="h-12 w-full rounded-2xl bg-gradient-to-r from-sky-500 to-violet-600 text-base font-semibold text-white hover:from-sky-600 hover:to-violet-700"
            >
              {saving ? t("saving") : t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamManagementPage;
