const text = value => typeof value === "string" ? value.trim() : "";
const numericWeight = value => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const candidate = text(value);
  return /^[+-]?\d+(?:[.,]\d+)?\s*%?$/.test(candidate)
    ? Number(candidate.replace(/\s*%$/, "").replace(",", ".")) : 0;
};
const clamp = value => Math.min(100, Math.max(0, value));

/** Recover only an explicit trailing percentage when the weight is missing or zero.
 * Returns new objects: reading legacy data never changes the stored record.
 */
export function normalizeBrandBrainPillar(pillar = {}) {
  const source = pillar && typeof pillar === "object" ? pillar : {};
  const name = text(source.name);
  let focus = text(source.focus);
  let weight = numericWeight(source.weight);
  if (weight === 0) {
    const suffix = /(?:^|\s*[—–]\s*|\s*-\s+|\s+)([+-]?\d+(?:[.,]\d+)?)\s*%$/.exec(focus);
    if (suffix) {
      weight = numericWeight(suffix[1]);
      focus = focus.slice(0, suffix.index).trim();
    }
  }
  return { name, focus, weight: clamp(weight) };
}

export function normalizeBrandBrainPillars(pillars) {
  return Array.isArray(pillars) ? pillars.map(normalizeBrandBrainPillar) : [];
}

export function parseBrandBrainPillars(value) {
  return text(value).split("\n").filter(line => line.trim()).map(line => {
    const [name = "", focus = "", weight = ""] = line.split("|");
    return normalizeBrandBrainPillar({ name, focus, weight });
  });
}

export function formatBrandBrainPillars(pillars) {
  return normalizeBrandBrainPillars(pillars).map(({ name, focus, weight }) => `${name} | ${focus} | ${weight}`).join("\n");
}
