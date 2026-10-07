const hasText = value => typeof value === "string" && !!value.trim();
const hasList = value => Array.isArray(value) && value.some(item => hasText(item));
export function brandBrainCompletion(brain = {}) {
  const values = [brain.mission, brain.vision, brain.positioning, brain.brandPromise, brain.audience, brain.voice, brain.visualNotes].map(hasText);
  values.push(Array.isArray(brain.pillars) && brain.pillars.some(item => item && hasText(item.name)), hasList(brain.approvedWords), hasList(brain.differentiators));
  return Math.round(values.filter(Boolean).length / values.length * 100);
}
