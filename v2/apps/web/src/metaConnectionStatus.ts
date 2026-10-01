export type MetaConnectionStatusInput = {
  connected: boolean;
  expiresAt: string | null;
  dataAccessExpiresAt: string | null;
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
  expiryKind: "token" | "data_access" | null;
};

const DAY_MS = 86_400_000;

export function metaConnectionPresentation(status: MetaConnectionStatusInput, now = new Date()): MetaConnectionPresentation {
  const tokenExpiry = status.expiresAt ? new Date(status.expiresAt) : null;
  const dataAccessExpiry = status.dataAccessExpiresAt ? new Date(status.dataAccessExpiresAt) : null;
  const validTokenExpiry = tokenExpiry && !Number.isNaN(tokenExpiry.getTime()) ? tokenExpiry : null;
  const validDataAccessExpiry = dataAccessExpiry && !Number.isNaN(dataAccessExpiry.getTime()) ? dataAccessExpiry : null;
  const validExpiry = validTokenExpiry ?? validDataAccessExpiry;
  const expiryKind = validTokenExpiry ? "token" : validDataAccessExpiry ? "data_access" : null;
  const hasConnection = Boolean(status.connected || status.accountName || status.metaUserId || validExpiry);

  if (!hasConnection) {
    return { state: "disconnected", label: "Meta não conectada", actionLabel: "Conectar Meta", daysRemaining: null, expiresAt: null, expiryKind: null };
  }

  if (!status.connected || (validExpiry && validExpiry.getTime() <= now.getTime())) {
    return { state: "expired", label: "Conexão expirada", actionLabel: "Reconectar Meta", daysRemaining: 0, expiresAt: validExpiry, expiryKind };
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
        expiryKind,
      };
    }
    return { state: "healthy", label: "Conectada", actionLabel: "Atualizar conexão", daysRemaining, expiresAt: validExpiry, expiryKind };
  }

  return { state: "healthy", label: "Conectada", actionLabel: "Atualizar conexão", daysRemaining: null, expiresAt: null, expiryKind: null };
}
