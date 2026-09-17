import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { listAdminClients } from "./api";
import { ACCESS_TOKEN_KEY } from "./authApi";

type SearchResult = {
  id: string;
  title: string;
  columnName: string;
  archived: boolean;
};

type ApiCard = { id: string; title: string };
type ApiColumn = { id: string; name: string; cards: ApiCard[] };
type ApiBoardResponse = {
  board: {
    columns: ApiColumn[];
    withoutColumn: { cards: ApiCard[] };
  };
};

const shellStyle: CSSProperties = {
  position: "relative",
  minWidth: 260,
  maxWidth: 360,
  flex: "1 1 320px",
  marginLeft: 2,
};

const inputStyle: CSSProperties = {
  width: "100%",
  height: 44,
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid rgba(125, 112, 180, 0.22)",
  background: "rgba(255, 255, 255, 0.92)",
  color: "#2c2740",
  padding: "0 40px 0 38px",
  font: "inherit",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  boxShadow: "0 2px 8px rgba(67, 73, 111, 0.03)",
};

const toolbarPolish = `
  .kanban-header-actions {
    gap: 10px !important;
  }
  .kanban-header-actions .board-actions {
    gap: 8px !important;
  }
  .kanban-header-actions .board-actions > button {
    box-sizing: border-box !important;
    height: 44px !important;
    min-height: 44px !important;
    padding: 0 16px !important;
    border-radius: 14px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    white-space: nowrap !important;
    font-size: .78rem !important;
    line-height: 1 !important;
  }
`;

const resultsStyle: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  left: 0,
  right: 0,
  zIndex: 1000,
  maxHeight: 360,
  overflowY: "auto",
  padding: 8,
  borderRadius: 14,
  border: "1px solid rgba(125, 112, 180, 0.18)",
  background: "rgba(255, 255, 255, 0.98)",
  boxShadow: "0 18px 50px rgba(42, 32, 78, 0.18)",
};

export function AdminKanbanSearch() {
  const location = useLocation();
  const adminMatch = location.pathname.match(/^\/admin\/([^/]+)$/);
  const slug = adminMatch ? decodeURIComponent(adminMatch[1]) : "";
  const [target, setTarget] = useState<Element | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!slug) {
      setTarget(null);
      return;
    }
    const findTarget = () => setTarget(document.querySelector(".kanban-header-actions"));
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [slug]);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setError("");
    setOpen(false);
  }, [slug]);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!slug || trimmedQuery.length < 2) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError("");

      void (async () => {
        const clientsResponse = await listAdminClients();
        const client = clientsResponse.items.find((item) => item.slug === slug);
        if (!client) throw new Error("Cliente não encontrado.");

        const token = window.localStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const load = async (archived: boolean) => {
          const params = new URLSearchParams({ search: trimmedQuery });
          if (archived) params.set("archived", "true");
          const response = await fetch(`/api/clients/${client.id}/board?${params.toString()}`, { headers });
          if (!response.ok) throw new Error("Não foi possível pesquisar os cards.");
          const data = await response.json() as ApiBoardResponse;
          const grouped = data.board.columns.flatMap((column) => column.cards.map((card) => ({
            id: card.id,
            title: card.title,
            columnName: column.name,
            archived,
          })));
          const withoutColumn = data.board.withoutColumn.cards.map((card) => ({
            id: card.id,
            title: card.title,
            columnName: "Sem coluna",
            archived,
          }));
          return [...grouped, ...withoutColumn];
        };

        const [activeCards, archivedCards] = await Promise.all([load(false), load(true)]);
        return [...activeCards, ...archivedCards];
      })()
        .then((items) => {
          if (!active) return;
          setResults(items);
          setOpen(true);
        })
        .catch((caught) => {
          if (!active) return;
          setResults([]);
          setError(caught instanceof Error ? caught.message : "Não foi possível pesquisar os cards.");
          setOpen(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 320);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [slug, trimmedQuery]);

  if (!slug || !target) return null;

  const openCard = (result: SearchResult) => {
    if (result.archived) return;
    const nextHash = `#/admin/${encodeURIComponent(slug)}?card=${encodeURIComponent(result.id)}`;
    window.location.hash = nextHash;
    window.setTimeout(() => window.location.reload(), 0);
  };

  return createPortal(
    <>
      <style>{toolbarPolish}</style>
      <div style={shellStyle} onFocus={() => { if (trimmedQuery.length >= 2) setOpen(true); }}>
        <span aria-hidden="true" style={{ position: "absolute", left: 13, top: 12, zIndex: 2, opacity: 0.62 }}>⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder="Buscar card no Kanban..."
          aria-label="Buscar card no Kanban administrativo"
          style={inputStyle}
        />
        {query ? <button type="button" onClick={() => { setQuery(""); setResults([]); setOpen(false); }} aria-label="Limpar busca" style={{ position: "absolute", right: 11, top: 9, zIndex: 2, border: 0, background: "transparent", fontSize: 20, cursor: "pointer", color: "#6d6488" }}>×</button> : null}
        {open && trimmedQuery.length >= 2 ? <div style={resultsStyle}>
          {loading ? <p style={{ margin: 8, color: "#6d6488" }}>Pesquisando...</p> : null}
          {!loading && error ? <p style={{ margin: 8, color: "#b42318" }}>{error}</p> : null}
          {!loading && !error && results.length === 0 ? <p style={{ margin: 8, color: "#6d6488" }}>Nenhum card encontrado.</p> : null}
          {!loading && !error ? results.map((result) => (
            <button
              type="button"
              key={`${result.archived ? "archived" : "active"}-${result.id}`}
              onClick={() => openCard(result)}
              disabled={result.archived}
              title={result.archived ? "Este card está em Arquivados." : "Abrir card"}
              style={{
                width: "100%",
                textAlign: "left",
                border: 0,
                borderRadius: 10,
                padding: "10px 12px",
                marginBottom: 4,
                background: result.archived ? "rgba(243, 240, 249, 0.72)" : "transparent",
                color: "#2c2740",
                cursor: result.archived ? "default" : "pointer",
                opacity: result.archived ? 0.78 : 1,
              }}
            >
              <strong style={{ display: "block", fontSize: 14 }}>{result.title}</strong>
              <small style={{ display: "block", marginTop: 3, color: "#756b8e" }}>{result.archived ? `Arquivado • ${result.columnName}` : result.columnName}</small>
            </button>
          )) : null}
        </div> : null}
      </div>
    </>,
    target,
  );
}
