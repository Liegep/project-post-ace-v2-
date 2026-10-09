// Editing Brand Brain always includes permission to open it.
export function normalizeClientPermissions(permissions) {
  return { ...permissions, allowClientViewBrandBrain: permissions.allowClientViewBrandBrain || permissions.allowClientEditBrandBrain };
}
export function toggleClientPermission(permissions, key) {
  const next = { ...permissions, [key]: !permissions[key] };
  if (key === "allowClientViewBrandBrain" && !next.allowClientViewBrandBrain) next.allowClientEditBrandBrain = false;
  return normalizeClientPermissions(next);
}
