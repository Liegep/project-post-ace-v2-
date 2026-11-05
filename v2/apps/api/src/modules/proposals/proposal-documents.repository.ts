import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import type { ProposalDocument } from "./proposals.schemas.js";
type DB = Pool | PoolConnection;
const decode = (value: any) =>
  typeof value === "string" ? JSON.parse(value) : value;
export async function documentData(db: DB, id: string) {
  try {
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT document_json,revision,acceptance_json FROM proposal_documents WHERE proposal_id=?",
      [id],
    );
    return rows[0]
      ? {
          document: decode(rows[0].document_json) as ProposalDocument,
          revision: Number(rows[0].revision),
          acceptance: decode(rows[0].acceptance_json),
        }
      : {};
  } catch (error: any) {
    if (error.code === "ER_NO_SUCH_TABLE") return {};
    throw error;
  }
}
export function proposalError(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}
export async function requireDocumentStorage(db: DB) {
  try {
    await db.query("SELECT proposal_id FROM proposal_documents LIMIT 0");
  } catch (error: any) {
    if (error.code === "ER_NO_SUCH_TABLE")
      proposalError(
        "A estrutura de propostas premium ainda não foi habilitada. Seus dados não foram salvos.",
        503,
      );
    throw error;
  }
}
export async function saveDocument(
  db: DB,
  id: string,
  document: ProposalDocument,
) {
  await db.query(
    "INSERT INTO proposal_documents (proposal_id,document_json,revision) VALUES (?,?,1) ON DUPLICATE KEY UPDATE document_json=VALUES(document_json),revision=revision+1",
    [id, JSON.stringify(document)],
  );
}
export async function inProposalTransaction<T>(
  db: Pool,
  action: (connection: PoolConnection) => Promise<T>,
) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
export function acceptanceSelection(
  proposal: any,
  optionId?: string,
  revision?: number,
) {
  if (
    !["sent", "viewed"].includes(proposal.status) ||
    new Date(proposal.expiresAt).getTime() < Date.now()
  )
    proposalError("Esta proposta não está disponível para aprovação.");
  if (proposal.document && revision !== proposal.revision)
    proposalError("A proposta foi atualizada. Recarregue antes de aprovar.");
  const alternatives = proposal.document?.mode === "alternatives";
  const option = alternatives
    ? proposal.document.options.find((item: any) => item.id === optionId)
    : null;
  if (alternatives && !option)
    proposalError("Selecione uma opção válida desta proposta.", 400);
  if (!alternatives && optionId)
    proposalError("Esta proposta não possui alternativas.", 400);
  return {
    optionId: option?.id ?? null,
    optionName: option?.name ?? null,
    value: option
      ? option.value
      : proposal.services.reduce(
          (sum: number, item: any) => sum + Number(item.value || 0),
          0,
        ),
    currency: proposal.currency || "BRL",
    revision: proposal.revision ?? 0,
    acceptedAt: new Date().toISOString(),
    snapshot: proposal,
  };
}
