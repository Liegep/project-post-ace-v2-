import { createHash } from "node:crypto";
import { z } from "zod";
import { dateSchema, countryCodeSchema } from "./seasonal.schemas.js";
import { yearsInPeriod } from "./seasonal.dates.js";
import type { RadarOccurrence, ExternalWarning } from "./seasonal.types.js";

const holidaySchema = z.object({
  date: dateSchema, name: z.string(), localName: z.string(), countryCode: countryCodeSchema,
  global: z.boolean(), counties: z.array(z.string()).nullable().optional(), types: z.array(z.string()).optional(),
}).passthrough();
export type NagerHoliday = z.infer<typeof holidaySchema>;
export function normalizeNagerHoliday(holiday: NagerHoliday): RadarOccurrence {
  // The provider has no canonical event ID. This is a transient payload fingerprint, not an opportunity identity.
  // Persisted opportunities and occurrences always use independently generated UUIDs.
  const reference = createHash("sha256").update(JSON.stringify(holiday)).digest("hex");
  return { id: `nager:${reference}`, opportunityId: null, occurrenceId: null, title: holiday.localName || holiday.name,
    description: holiday.name, categoryCode: "feriado", origin: "nager", scope: "countries", countryCodes: [holiday.countryCode],
    date: holiday.date, year: Number(holiday.date.slice(0, 4)), externalSource: "nager", externalReference: reference,
    regionalScope: { nationwide: holiday.global, subdivisions: holiday.counties ?? [] } };
}
export type ExternalLoader = (from: string, to: string, codes: string[]) => Promise<{ items: RadarOccurrence[]; warnings: ExternalWarning[] }>;
export function createNagerLoader(fetcher: typeof fetch = fetch): ExternalLoader {
  // TTL cache limits repeat calls during pagination. Never used as historical storage.
  const cache = new Map<string, { expires: number; items: RadarOccurrence[] }>();
  const inflight = new Map<string, Promise<RadarOccurrence[]>>();
  const load = (year: number, code: string) => {
    const key = `${year}/${code}`;
    const saved = cache.get(key);
    if (saved && saved.expires > Date.now()) return Promise.resolve(saved.items);
    const pending = inflight.get(key); if (pending) return pending;
    const request = (async () => {
      const response = await fetcher(`https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Feriados externos indisponíveis (${response.status}).`);
      const payload: unknown = await response.json();
      const rows = z.array(holidaySchema).parse(payload);
      if (rows.some((row) => row.countryCode !== code || Number(row.date.slice(0, 4)) !== year)) throw new Error("Resposta externa inconsistente.");
      const items = [...new Map(rows.map((row) => { const item = normalizeNagerHoliday(row); return [item.id, item] as const; })).values()];
      if (cache.size >= 500) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 3600000, items }); return items;
    })().finally(() => inflight.delete(key));
    inflight.set(key, request); return request;
  };
  return async (from, to, codes) => {
    const tasks = yearsInPeriod(from, to).flatMap((year) => [...new Set(codes)].map((countryCode) => ({ year, countryCode })));
    const items: RadarOccurrence[] = [], warnings: ExternalWarning[] = [];
    // Bounded concurrency; each country/year succeeds or fails independently.
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(6, tasks.length) }, async () => {
      while (cursor < tasks.length) {
        const { year, countryCode } = tasks[cursor++];
        try { items.push(...await load(year, countryCode)); }
        catch { warnings.push({ countryCode, year, message: "Feriados externos indisponíveis neste país/ano. As datas próprias continuam disponíveis." }); }
      }
    }));
    return { items: items.filter((item) => item.date >= from && item.date <= to), warnings };
  };
}
