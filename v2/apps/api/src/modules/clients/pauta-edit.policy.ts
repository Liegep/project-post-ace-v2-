/** Status/link maintenance may not erase an approval or replace reviewed content. */
export function preservesApprovedPauta(existing: Record<string, unknown>, patch: Record<string, unknown>) {
  if (existing.status !== "approved") return true;
  if (patch.status !== undefined && patch.status !== "approved") return false;
  return Object.keys(patch).every(key => ["status", "cardId", "updatedAt", "id"].includes(key) || JSON.stringify(patch[key]) === JSON.stringify(existing[key]));
}
