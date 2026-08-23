import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Invoice {
  id: string;
  client_id: string;
  invoice_number: number;
  title: string;
  currency_code: string;
  locale: string;
  period_start: string | null;
  period_end: string | null;
  issue_date: string;
  due_date: string;
  status: "open" | "paid" | "overdue" | "cancelled";
  discount: number;
  surcharge: number;
  notes: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  payment_method: string;
  payment_details: string;
  client_visible: boolean;
  recipient_name: string;
  recipient_email: string;
  recipient_address: string;
  recipient_country: string;
  recipient_tax_id: string;
  is_recurring: boolean;
  recurring_fixed_amount: boolean;
  clients?: {
    name: string;
    logo_url: string;
    slug: string;
    billing_currency: string;
    address?: string;
    country?: string;
    tax_id?: string;
    locale?: string;
  };
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  post_id: string | null;
  name: string;
  description: string;
  category: string;
  service_date: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string;
  created_at: string;
}

export interface InvoiceAttachment {
  id: string;
  invoice_id: string;
  file_name: string;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
}

export function useInvoices(clientId?: string) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("invoices")
      .select("*, clients(name, logo_url, slug, billing_currency, address, country, tax_id, locale)")
      .order("created_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data } = await query;
    setInvoices((data as any[]) || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  return { invoices, loading, refetch: fetchInvoices };
}

export function useInvoice(invoiceId?: string) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoice = useCallback(async () => {
    if (!invoiceId) {
      setInvoice(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from("invoices")
      .select("*, clients(name, logo_url, slug, billing_currency, address, country, tax_id, locale)")
      .eq("id", invoiceId)
      .maybeSingle();

    setInvoice((data as Invoice | null) || null);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  return { invoice, loading, refetch: fetchInvoice };
}

export function useInvoiceItems(invoiceId: string) {
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });
    setItems((data as any[]) || []);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return { items, loading, refetch: fetchItems };
}

export function useInvoiceAttachments(invoiceId: string) {
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("invoice_attachments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false });
    setAttachments((data as any[]) || []);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  return { attachments, loading, refetch: fetchAttachments };
}

export async function createInvoice(data: {
  client_id: string;
  title: string;
  currency_code?: string;
  locale?: string;
  period_start?: string;
  period_end?: string;
  issue_date: string;
  due_date: string;
  notes?: string;
  created_by?: string;
  client_visible?: boolean;
  recipient_name?: string;
  recipient_email?: string;
  recipient_address?: string;
  recipient_country?: string;
  recipient_tax_id?: string;
  is_recurring?: boolean;
  recurring_fixed_amount?: boolean;
}) {
  const { data: inv, error } = await supabase.from("invoices").insert(data as any).select().single();
  if (error) throw error;
  return inv;
}

export async function updateInvoice(id: string, data: Partial<Invoice>) {
  const { error } = await supabase.from("invoices").update(data as any).eq("id", id);
  if (error) throw error;
}

export async function deleteInvoice(id: string) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

export async function createInvoiceItem(data: {
  invoice_id: string;
  post_id?: string | null;
  name: string;
  description?: string;
  category?: string;
  service_date?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  notes?: string;
}) {
  const { error } = await supabase.from("invoice_items").insert(data as any);
  if (error) throw error;
}

export async function updateInvoiceItem(id: string, data: Partial<InvoiceItem>) {
  const { error } = await supabase.from("invoice_items").update(data as any).eq("id", id);
  if (error) throw error;
}

export async function deleteInvoiceItem(id: string) {
  const { error } = await supabase.from("invoice_items").delete().eq("id", id);
  if (error) throw error;
}

export async function createInvoiceAttachment(data: {
  invoice_id: string;
  file_name: string;
  file_url: string;
  uploaded_by?: string;
}) {
  const { error } = await supabase.from("invoice_attachments").insert(data as any);
  if (error) throw error;
}

export async function deleteInvoiceAttachment(id: string) {
  const { error } = await supabase.from("invoice_attachments").delete().eq("id", id);
  if (error) throw error;
}

// Check if a post is already invoiced
export async function isPostInvoiced(postId: string): Promise<boolean> {
  const { data } = await supabase
    .from("invoice_items")
    .select("id")
    .eq("post_id", postId)
    .limit(1);
  return (data || []).length > 0;
}

// Get the invoice item for a post (to allow un-invoicing)
export async function getPostInvoiceItem(postId: string): Promise<{ id: string; invoice_id: string } | null> {
  const { data } = await supabase
    .from("invoice_items")
    .select("id, invoice_id")
    .eq("post_id", postId)
    .limit(1);
  return (data || [])[0] || null;
}

// Auto-create or find open invoice for a client and add post
export async function invoicePostAuto(clientId: string, post: {
  id: string;
  title: string;
  caption?: string;
  mediaType?: string;
}) {
  // Check duplicate
  const already = await isPostInvoiced(post.id);
  if (already) throw new Error("ALREADY_INVOICED");

  // Find open invoice for this client
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, title, invoice_number")
    .eq("client_id", clientId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5);

  let invoiceId: string;
  let invoiceTitle: string;

  if (openInvoices && openInvoices.length > 0) {
    // Use the most recent open invoice
    invoiceId = openInvoices[0].id;
    invoiceTitle = openInvoices[0].title;
  } else {
    // Auto-create monthly invoice
    const now = new Date();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const title = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 10);

    const { data: inv, error } = await supabase.from("invoices").insert({
      client_id: clientId,
      title,
      period_start: firstDay.toISOString().split("T")[0],
      period_end: lastDay.toISOString().split("T")[0],
      issue_date: now.toISOString().split("T")[0],
      due_date: dueDate.toISOString().split("T")[0],
    } as any).select().single();
    if (error) throw error;
    invoiceId = (inv as any).id;
    invoiceTitle = title;
  }

  // Add item
  const category = post.mediaType === "video" ? "reels" : "post";
  await createInvoiceItem({
    invoice_id: invoiceId,
    post_id: post.id,
    name: post.title,
    description: post.caption?.substring(0, 200) || "",
    category,
    service_date: new Date().toISOString().split("T")[0],
    quantity: 1,
    unit_price: 0,
    total_price: 0,
  });

  return { invoiceId, invoiceTitle };
}

// Auto-create or find open invoice for a client and add a plain item (e.g. column name)
export async function invoiceColumnAuto(
  clientId: string,
  columnName: string,
  opts?: { quantity?: number; unit_price?: number; description?: string }
) {
  // Find open invoice for this client
  const { data: openInvoices } = await supabase
    .from("invoices")
    .select("id, title")
    .eq("client_id", clientId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1);

  let invoiceId: string;
  let invoiceTitle: string;

  if (openInvoices && openInvoices.length > 0) {
    invoiceId = (openInvoices[0] as any).id;
    invoiceTitle = (openInvoices[0] as any).title;
  } else {
    const now = new Date();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const title = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 10);

    const { data: inv, error } = await supabase.from("invoices").insert({
      client_id: clientId,
      title,
      period_start: firstDay.toISOString().split("T")[0],
      period_end: lastDay.toISOString().split("T")[0],
      issue_date: now.toISOString().split("T")[0],
      due_date: dueDate.toISOString().split("T")[0],
    } as any).select().single();
    if (error) throw error;
    invoiceId = (inv as any).id;
    invoiceTitle = title;
  }

  const quantity = opts?.quantity ?? 1;
  const unit_price = opts?.unit_price ?? 0;
  const total_price = Number((quantity * unit_price).toFixed(2));

  await createInvoiceItem({
    invoice_id: invoiceId,
    post_id: null,
    name: columnName,
    description: opts?.description || "",
    category: "post",
    service_date: new Date().toISOString().split("T")[0],
    quantity,
    unit_price,
    total_price,
  });

  return { invoiceId, invoiceTitle };
}
