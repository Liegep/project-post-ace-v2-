import { summaryCurrencies, type CurrencyTotals } from "./billingStatistics";

type Props = {
  totals: { all: CurrencyTotals; paid: CurrencyTotals; open: CurrencyTotals; overdue: CurrencyTotals };
  onCreate: () => void;
  onSettings: () => void;
  settingsOpen: boolean;
};

export function BillingPageHeader({ totals, onCreate, onSettings, settingsOpen }: Props) {
  const metrics = [
    { label: "Total faturado", values: totals.all, tone: "violet" },
    { label: "Total recebido", values: totals.paid, tone: "green" },
    { label: "Pendente", values: totals.open, tone: "orange" },
    { label: "Atrasado", values: totals.overdue, tone: "red" },
  ];
  return <header className="billing-summary-banner">
    <div className="billing-summary-heading">
      <div className="page-context-copy"><p className="eyebrow">Área da operação</p><h1 className="billing-banner-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 7h6M9 11h6M9 15h4" /></svg>Faturamento</h1><p>Organize os lançamentos e cobranças da operação.</p></div>
      <div className="billing-summary-actions">
        <button type="button" className="gradient-button" onClick={onCreate}>+ Nova fatura</button>
        <button type="button" className="ghost-button" aria-haspopup="dialog" aria-expanded={settingsOpen} aria-controls="billing-settings-drawer" onClick={onSettings}>Ajustes do faturamento</button>
      </div>
    </div>
    <section className="billing-summary-metrics" aria-label="Resumo financeiro">
      {metrics.map(({ label, values, tone }) => <article className={`billing-summary-metric ${tone}`} key={label}>
        <span>{label}</span><div>{summaryCurrencies.map((currency) => <strong key={currency}>{new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(values[currency])}</strong>)}</div>
      </article>)}
    </section>
  </header>;
}
