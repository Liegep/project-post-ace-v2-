import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { checkMetaDestination, type MetaPreflightResult, type MetaPublishDestination } from "./api";

const issueLabels: Record<string, string> = {
  destination_not_owned_or_missing: "O destino não existe ou não pertence a este cliente.",
  card_not_owned_or_missing: "O card não existe ou não pertence a este cliente.",
  no_assets_configured: "Nenhuma conta configurada neste destino.",
  connection_unavailable: "A conexão Meta está indisponível. Atualize a conexão.",
  access_denied: "A Meta não autorizou a consulta. Confira a conexão e as permissões.",
  asset_unavailable: "A Meta não retornou o asset. Ele pode ter sido removido ou estar sem acesso.",
  invalid_asset_id: "O identificador da conta configurada é inválido.",
  meta_read_failed: "Não foi possível concluir a consulta à Meta. Tente novamente.",
  access_list_incomplete: "Não foi possível conferir toda a lista de contas acessíveis.",
  asset_access_not_confirmed: "A conta não foi confirmada entre os assets acessíveis ao usuário conectado.",
  asset_name_changed: "O nome atual do Facebook difere do nome salvo. Confira a configuração.",
  asset_username_changed: "O username atual do Instagram difere do username salvo. Confira a configuração.",
  instagram_page_link_mismatch: "O Instagram não foi confirmado como vinculado à Página deste destino.",
  asset_linked_to_multiple_clients: "Esta conta também está vinculada a outro cliente. Confira se o compartilhamento é intencional.",
};

function Check({ value, children }: { value: boolean | null; children: ReactNode }) {
  return <li><span aria-label={value === true ? "Confirmado" : value === false ? "Não confirmado" : "Não verificado"}>{value === true ? "✓" : value === false ? "⚠" : "—"}</span> {children}</li>;
}

export function MetaPreflightSummary({ result }: { result: MetaPreflightResult }) {
  const { checks } = result;
  return <div className={`meta-preflight-result ${result.status}`} role="status">
    <strong>{result.status === "safe" ? "Roteamento confirmado" : result.status === "warning" ? "Verificação com ressalvas" : "Não foi possível confirmar este destino"}</strong>
    <ul>
      <Check value={checks.destinationBelongsToClient}>Destino pertence ao cliente</Check>
      {result.cardId ? <Check value={checks.cardBelongsToClient}>Card pertence ao cliente</Check> : null}
      {result.facebook.savedId ? <><Check value={checks.facebookAssetMatches}>Facebook: {result.facebook.liveName ?? result.facebook.savedName ?? "Não confirmado"}</Check><Check value={checks.facebookAccessOk}>Acesso ao Facebook</Check></> : null}
      {result.instagram.savedId ? <><Check value={checks.instagramAssetMatches}>Instagram: @{result.instagram.liveUsername ?? result.instagram.savedUsername ?? "não confirmado"}</Check><Check value={checks.instagramAccessOk}>Acesso ao Instagram</Check></> : null}
      {result.facebook.savedId && result.instagram.savedId ? <Check value={checks.instagramLinkedToFacebook}>Instagram vinculado à Página selecionada</Check> : null}
      <Check value={checks.noCrossClientCollision}>Nenhum vínculo com outro cliente</Check>
    </ul>
    {result.issues.length ? <ul className="meta-preflight-issues">{result.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issueLabels[issue.code] ?? "Confira a configuração deste destino."}</li>)}</ul> : null}
    {result.collisions.length ? <ul>{result.collisions.map((link, index) => <li key={index}>{link.platform === "instagram" ? "Instagram" : "Facebook"}: {link.clientName}{link.destinationName ? ` · ${link.destinationName}` : " · configuração anterior"}</li>)}</ul> : null}
    <small>Verificação somente de leitura. Confirma o roteamento e o acesso aos assets no momento da consulta; as permissões de publicação não são testadas.</small>
  </div>;
}

export function MetaPreflightPanel({ destination }: { destination: MetaPublishDestination }) {
  const [result, setResult] = useState<MetaPreflightResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; setResult(null); setBusy(false); setError("");
    return () => { generation.current++; };
  }, [destination.id, destination.clientAccountId, destination.name, destination.facebookPageId, destination.facebookPageName, destination.instagramAccountId, destination.instagramUsername]);
  const verify = async () => {
    const current = ++generation.current;
    setBusy(true); setError(""); setResult(null);
    try {
      const next = await checkMetaDestination(destination.clientAccountId, destination.id);
      if (current === generation.current) setResult(next);
    } catch {
      if (current === generation.current) setError("Não foi possível verificar as contas Meta. Tente novamente.");
    } finally { if (current === generation.current) setBusy(false); }
  };
  return <article className="meta-preflight-panel">
    <div className="meta-preflight-heading"><strong>{destination.name}</strong><button type="button" className="drawer-secondary-action" disabled={busy} onClick={() => void verify()}>{busy ? "Verificando contas..." : "Verificar contas Meta"}</button></div>
    {error ? <p className="tracker-error" role="alert">{error}</p> : null}
    {result ? <MetaPreflightSummary result={result} /> : null}
  </article>;
}
