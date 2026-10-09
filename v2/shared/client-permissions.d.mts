type BrandBrainPermissions = { allowClientEditBrandBrain: boolean; allowClientViewBrandBrain: boolean };
export function normalizeClientPermissions<T extends BrandBrainPermissions>(permissions: T): T;
export function toggleClientPermission<T extends BrandBrainPermissions>(permissions: T, key: keyof T): T;
