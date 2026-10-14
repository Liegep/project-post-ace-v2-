-- Exclusivamente leitura. Preparado para o operador; não executado em produção pelo Codex.
-- Não retorna textos editoriais, tokens de links, contatos ou autores.
-- Revisão 0 e editorial_brief_json NULL NÃO comprovam elegibilidade.

-- 1. Flag de pauta, indicadores completos e coluna (inclusive pertencimento ao cliente).
SELECT c.id,c.is_brief_approval,c.approval_revision,c.approval_state,
       c.status_json,c.tags_json,c.client_label,
       c.column_id,k.name AS column_name,
       k.client_account_id=c.client_account_id AS column_same_client,
       c.archived,c.archived_at,c.published_at,c.scheduled_at,
       c.editorial_brief_json IS NULL AS brief_is_null
FROM kanban_cards c
LEFT JOIN kanban_columns k ON k.id=c.column_id
WHERE c.id='37e38483-de04-4f33-84cb-5f1baf250d25'
  AND c.client_account_id='9234cff8-7337-41f7-b4ac-62664d61eb7d';

-- 2. Vínculos/status da pauta específica e quantidade de pautas que apontam ao card.
WITH pautas AS (
 SELECT p.* FROM client_accounts a
 CROSS JOIN JSON_TABLE(a.workspace_drawer_json,'$.pautaIdeas[*]' COLUMNS (
   idea_id VARCHAR(36) PATH '$.id',card_id VARCHAR(36) PATH '$.cardId',
   suggestion_id VARCHAR(36) PATH '$.radarSuggestionId',status VARCHAR(32) PATH '$.status'
 )) p
 WHERE a.id='9234cff8-7337-41f7-b4ac-62664d61eb7d'
)
SELECT idea_id,card_id,suggestion_id,status,
 (SELECT COUNT(*) FROM pautas WHERE card_id='37e38483-de04-4f33-84cb-5f1baf250d25') AS card_pauta_matches
FROM pautas WHERE idea_id='75504c8c-0108-4258-9c94-f995cc9432bf';

-- 3. Sugestão aceita pelo mesmo cliente e vínculo da aceitação.
SELECT id,status,accepted_pauta_id,accepted_at,
       source_summary IS NULL AS summary_is_null,
       CHAR_LENGTH(concept) AS concept_chars,CHAR_LENGTH(hook) AS hook_chars,
       CHAR_LENGTH(rationale) AS rationale_chars,CHAR_LENGTH(cta) AS cta_chars,
       source_date IS NULL AS date_is_null
FROM radar_suggestions
WHERE id='3e1b66a0-5474-494c-97b1-dc7758f9b58b'
  AND client_account_id='9234cff8-7337-41f7-b4ac-62664d61eb7d';

-- 4. Histórico completo de decisões do card: nenhuma aprovação pode ser presumida ausente.
SELECT e.revision,e.action,e.decision,e.source,e.created_at
FROM card_approval_events e
JOIN kanban_cards c ON c.id=e.card_id
WHERE c.id='37e38483-de04-4f33-84cb-5f1baf250d25'
  AND c.client_account_id='9234cff8-7337-41f7-b4ac-62664d61eb7d'
ORDER BY e.revision;

-- 5. Links existentes, inclusive inativos/expirados com aprovação anterior. Sem token.
SELECT l.id,l.is_active,l.expires_at,l.approved_at,l.created_at,
       l.client_account_id=c.client_account_id AS link_same_client
FROM approval_links l
JOIN kanban_cards c ON c.id=l.card_id
WHERE c.id='37e38483-de04-4f33-84cb-5f1baf250d25'
  AND c.client_account_id='9234cff8-7337-41f7-b4ac-62664d61eb7d'
ORDER BY l.created_at;

-- Para conferir divergências de textos sem expô-los, usar também as comparações por hash
-- do diagnóstico anterior. Comprimentos iguais não garantem conteúdo igual.
-- A elegibilidade definitiva é recalculada na prévia e novamente sob bloqueio na aplicação.

-- 6. Igualdade exata dos textos preservados, sem retornar os textos.
-- Hash evita confundir igualdade por collation ou por quantidade de caracteres.
WITH pauta AS (
 SELECT p.* FROM client_accounts a
 CROSS JOIN JSON_TABLE(a.workspace_drawer_json,'$.pautaIdeas[*]' COLUMNS (
  idea_id VARCHAR(36) PATH '$.id',description LONGTEXT PATH '$.description',
  caption LONGTEXT PATH '$.caption',source_url LONGTEXT PATH '$.sourceUrl'
 )) p WHERE a.id='9234cff8-7337-41f7-b4ac-62664d61eb7d'
 AND p.idea_id='75504c8c-0108-4258-9c94-f995cc9432bf'
)
SELECT SHA2(p.description,256)=SHA2(s.description,256) AS description_exact_match,
 SHA2(p.caption,256)=SHA2(s.caption_suggestion,256) AS pauta_caption_original_match,
 SHA2(p.source_url,256)=SHA2(s.source_url,256) AS source_url_exact_match,
 SHA2(c.caption,256)=SHA2(p.caption,256) AS card_caption_matches_pauta
FROM pauta p
JOIN radar_suggestions s ON s.id='3e1b66a0-5474-494c-97b1-dc7758f9b58b'
 AND s.client_account_id='9234cff8-7337-41f7-b4ac-62664d61eb7d'
JOIN kanban_cards c ON c.id='37e38483-de04-4f33-84cb-5f1baf250d25'
 AND c.client_account_id=s.client_account_id;
