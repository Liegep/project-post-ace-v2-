export type MetaConnectionStatusInput = {
  connected: boolean;
  expiresAt: string | null;
  accountName: string | null;
  metaUserId: string | null;
};

export type MetaConnectionState = "healthy" | "warning" | "expired" | "disconnected";

export type MetaConnectionPresentation = {
  state: MetaConnectionState;
  label: string;
  actionLabel: "Conectar Meta" | "Reconectar Meta" | "Atualizar conexão";
  daysRemaining: number | null;
  expiresAt: Date | null;
};

const DAY_MS = 86_400_000;

export function metaConnectionPresentation(status: MetaConnectionStatusInput, now = new Date()): MetaConnectionPresentation {
  const expiresAt = status.expiresAt ? new Date(status.expiresAt) : null;
  const validExpiry = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
  const hasConnection = Boolean(status.connected || status.accountName || status.metaUserId || status.expiresAt);

  if (!hasConnection) {
    return { state: "disconnected", label: "Meta não conectada", actionLabel: "Conectar Meta", daysRemaining: null, expiresAt: null };
  }

  if (!status.connected || (validExpiry && validExpiry.getTime() <= now.getTime())) {
    return { state: "expired", label: "Conexão expirada", actionLabel: "Reconectar Meta", daysRemaining: 0, expiresAt: validExpiry };
  }

  if (validExpiry) {
    const remainingMs = validExpiry.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / DAY_MS));
    if (remainingMs <= 7 * DAY_MS) {
      return {
        state: "warning",
        label: `Expira em ${daysRemaining} ${daysRemaining === 1 ? "dia" : "dias"}`,
        actionLabel: "Atualizar conexão",
        daysRemaining,
        expiresAt: validExpiry,
      };
    }
    return { state: "healthy", label: "Conectada", actionLabel: "Atualizar conexão", daysRemaining, expiresAt: validExpiry };
  }

  return { state: "healthy", label: "Conectada", actionLabel: "Atualizar conexão", daysRemaining: null, expiresAt: null };
}
