import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find clients with active recurring billing
    const { data: clients, error: cErr } = await supabase
      .from("clients")
      .select("id, name, address, country, tax_id, locale, billing_currency, billing_type, billing_monthly_amount, billing_description, billing_due_day, billing_start_date")
      .eq("billing_type", "recurring")
      .eq("billing_recurrence_active", true);

    if (cErr) throw cErr;
    if (!clients || clients.length === 0) {
      return new Response(JSON.stringify({ message: "No recurring clients", generated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];

    let generated = 0;

    for (const client of clients) {
      // Check if start_date has been reached
      if (client.billing_start_date) {
        const startDate = new Date(client.billing_start_date);
        if (startDate > now) continue;
      }

      // Check if invoice already exists for this month
      const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
      const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("client_id", client.id)
        .gte("period_start", monthStart)
        .lte("period_start", monthEnd)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Create invoice
      const dueDay = client.billing_due_day || 10;
      const dueDate = new Date(currentYear, currentMonth, Math.min(dueDay, 28));
      // If due day already passed, keep it (invoice is for current month)

      const title = `${monthNames[currentMonth]} ${currentYear}`;
      const amount = Number(client.billing_monthly_amount || 0);

      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          client_id: client.id,
          title,
          currency_code: client.billing_currency || "BRL",
          locale: client.locale || "pt",
          recipient_name: client.name || "",
          recipient_address: client.address || "",
          recipient_country: client.country || "",
          recipient_tax_id: client.tax_id || "",
          is_recurring: true,
          recurring_fixed_amount: amount > 0,
          period_start: monthStart,
          period_end: monthEnd,
          issue_date: now.toISOString().split("T")[0],
          due_date: dueDate.toISOString().split("T")[0],
          status: "open",
        })
        .select("id")
        .single();

      if (invErr) {
        console.error(`Error creating invoice for ${client.name}:`, invErr);
        continue;
      }

      // Add recurring item
      if (amount > 0) {
        await supabase.from("invoice_items").insert({
          invoice_id: inv.id,
          name: client.billing_description || "Mensalidade",
          description: `Recorrência mensal - ${title}`,
          category: "mensalidade",
          service_date: now.toISOString().split("T")[0],
          quantity: 1,
          unit_price: amount,
          total_price: amount,
        });
      }

      generated++;
      console.log(`Generated invoice for ${client.name}: ${title}`);
    }

    return new Response(
      JSON.stringify({ message: "Recurring invoices processed", generated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
