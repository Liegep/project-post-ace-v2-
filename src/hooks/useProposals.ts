import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { ProposalLocale } from "@/i18n/proposalTranslations";

export interface ProposalService {
  name: string;
  description: string;
  value: number;
}

export interface Proposal {
  id: string;
  user_id: string;
  client_name: string;
  client_email: string;
  services: ProposalService[];
  total_value: number;
  currency: string;
  scope_description: string;
  investment_description: string;
  deadline_days: number;
  locale: ProposalLocale;
  proposal_type: string;
  plan: string;
  pieces_quantity: number;
  status: "draft" | "sent" | "viewed" | "accepted" | "expired";
  token: string;
  expires_at: string;
  viewed_at: string | null;
  accepted_at: string | null;
  accepted_name: string;
  accepted_signature: string;
  accepted_ip: string;
  accepted_email: string;
  created_at: string;
  updated_at: string;
}

export function useProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId, isSuperAdmin } = useUserRole();

  const fetchProposals = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    let query = supabase.from("proposals").select("*").order("created_at", { ascending: false });
    if (!isSuperAdmin) {
      query = query.eq("user_id", userId);
    }
    const { data, error } = await query;
    if (!error && data) {
      setProposals(
        data.map((p: any) => ({
          ...p,
          services: Array.isArray(p.services) ? p.services : JSON.parse(p.services || "[]"),
        }))
      );
    }
    setLoading(false);
  }, [userId, isSuperAdmin]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return { proposals, loading, refetch: fetchProposals };
}
