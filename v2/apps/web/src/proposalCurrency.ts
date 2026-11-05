export const proposalCurrencies = { BRL: "Real brasileiro (R$)", USD: "Dólar americano (US$)", EUR: "Euro (€)", SEK: "Coroa sueca (kr)" } as const;
export function proposalCurrency(value?: string | null): string {
  return ({ "R$": "BRL", "$": "USD", "US$": "USD", "€": "EUR", "kr": "SEK" } as Record<string, string>)[value || ""] || value || "BRL";
}
export function formatProposalMoney(value: number, currency?: string | null): string {
  const code = proposalCurrency(currency);
  const locale = ({ BRL: "pt-BR", USD: "en-US", EUR: "de-DE", SEK: "sv-SE" } as Record<string, string>)[code];
  if (!locale) return `${code} ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(value).replace(/^\$/, "US$");
}
