-- PROPOSTA PARA REVISÃO. Não executar automaticamente.
-- Somente tabela complementar; nenhum UPDATE/backfill nas propostas históricas.
CREATE TABLE proposal_documents (
  proposal_id CHAR(36) NOT NULL PRIMARY KEY,
  document_json JSON NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  acceptance_json JSON NULL,
  CONSTRAINT fk_proposal_document FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Rollback: primeiro reverter a aplicação; exportar esta tabela para preservar
-- documentos e evidências de aceite. Só então, mediante aprovação: DROP TABLE proposal_documents;
