export type BrandBrainPillar = { name: string; focus: string; weight: number };
export function normalizeBrandBrainPillar(pillar?: unknown): BrandBrainPillar;
export function normalizeBrandBrainPillars(pillars: unknown): BrandBrainPillar[];
export function parseBrandBrainPillars(value: string): BrandBrainPillar[];
export function formatBrandBrainPillars(pillars: unknown): string;
