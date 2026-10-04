import { daysBetween } from "./seasonal.dates.js";
import type { RadarQuery } from "./seasonal.schemas.js";
import type { EditorialClient, RadarOccurrence } from "./seasonal.types.js";
import type { SeasonalStore } from "./seasonal.repository.js";
import type { ExternalLoader } from "./seasonal.nager.js";

export function matchesCountries(item: RadarOccurrence, codes: string[]) {
  return item.scope === "global" || item.countryCodes.some((code) => codes.includes(code));
}
export function relatedClients(item: RadarOccurrence, clients: EditorialClient[]) {
  // Geographic candidates only. Regional events cannot be asserted to impact a client without subdivision data.
  if (item.regionalScope && !item.regionalScope.nationwide) return [];
  return clients.filter((client) => client.countryCodes.length > 0 && matchesCountries(item, client.countryCodes));
}
export async function loadRadar(store: SeasonalStore, external: ExternalLoader, query: RadarQuery, allowedClientIds: string[] | null, today: string) {
  const [monitored, own, clients] = await Promise.all([store.monitoredCountries(), store.occurrences(query.from, query.to), store.editorialClients(allowedClientIds)]);
  const activeCodes = monitored.filter((country) => country.active).map((country) => country.countryCode);
  const codes = query.countryCode ? activeCodes.filter((code) => code === query.countryCode) : activeCodes;
  const selectedClient = query.clientId ? clients.find((client) => client.id === query.clientId) : undefined;
  const providerCodes = query.clientId ? codes.filter((code) => selectedClient?.countryCodes.includes(code)) : codes;
  const result = query.includeExternal === "true" ? await external(query.from, query.to, providerCodes) : { items: [], warnings: [] };
  const items = [...own, ...result.items].filter((item) => matchesCountries(item, codes)
    && (!query.categoryCode || item.categoryCode === query.categoryCode)
    && (!query.clientId || !!selectedClient && relatedClients(item, [selectedClient]).length > 0))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { items: items.slice(query.offset, query.offset + query.limit).map((item) => ({ ...item, daysUntil: daysBetween(today, item.date),
    relatedClients: relatedClients(item, clients).map(({ id, name, slug }) => ({ id, name, slug })) })),
    total: items.length, offset: query.offset, limit: query.limit, hasMore: query.offset + query.limit < items.length,
    warnings: result.warnings, today };
}
