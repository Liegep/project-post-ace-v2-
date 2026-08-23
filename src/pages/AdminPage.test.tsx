import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  class DOMMatrixMock {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
  }

  Object.assign(globalThis, {
    DOMMatrix: DOMMatrixMock,
    PointerEvent: MouseEvent,
  });
});
import { KanbanBoard } from "./AdminPage";

vi.mock("@/components/PostCard", () => ({
  PostCard: () => <div data-testid="post-card" />,
}));

vi.mock("@/components/QuickAddCard", () => ({
  QuickAddCard: () => <div data-testid="quick-add-card" />,
}));

vi.mock("@/components/billing/InvoiceColumnDialog", () => ({
  InvoiceColumnDialog: () => null,
}));

vi.mock("@/components/KanbanScrollWrapper", () => ({
  KanbanScrollWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/pdfExtract", () => ({
  extractPdfText: vi.fn(),
}));

const baseProps = {
  posts: [],
  columns: [
    { id: "col-1", name: "Planejamento", position: 0, visibleToClient: true, color: "#1d4ed8" },
  ],
  unassignedPosts: [],
  editingColumnId: null,
  editingColumnName: "",
  setEditingColumnId: vi.fn(),
  setEditingColumnName: vi.fn(),
  editColumnInputRef: { current: null },
  handleRenameColumn: vi.fn(),
  handleDeleteColumn: vi.fn(),
  updatePostStatus: vi.fn(),
  deletePost: vi.fn(),
  updatePost: vi.fn(),
  setDetailPost: vi.fn(),
  setCreateInColumnId: vi.fn(),
  setCreateOpen: vi.fn(),
  addingColumn: false,
  setAddingColumn: vi.fn(),
  newColumnName: "",
  setNewColumnName: vi.fn(),
  newColumnInputRef: { current: null },
  handleAddColumn: vi.fn(),
  movePostToColumn: vi.fn(),
  reorderPostsInColumn: vi.fn(),
  t: (key: string) => {
    const map: Record<string, string> = {
      addPost: "Adicionar post",
      color: "Cor",
      deleteAction: "Excluir",
      noPosts: "Sem posts",
      noColumn: "Sem coluna",
      newColumn: "Nova coluna",
      columnName: "Nome da coluna",
      create: "Criar",
      cancel: "Cancelar",
      visibleToClient: "Visível para o cliente",
      hiddenFromClient: "Oculto para o cliente",
    };
    return map[key] || key;
  },
  toggleColumnVisibility: vi.fn(),
  setColumnColor: vi.fn(),
  selectionMode: false,
  selectedPostIds: new Set<string>(),
  onToggleSelect: vi.fn(),
  reorderColumns: vi.fn(),
  clientId: "client-1",
  billingCurrency: "BRL",
};

describe("KanbanBoard column menu", () => {
  it("opens the menu and the color submenu with palette and hex input", async () => {
    render(<KanbanBoard {...baseProps} />);

    fireEvent.pointerDown(screen.getByLabelText("Mais ações da coluna Planejamento"), { button: 0 });
    fireEvent.click(screen.getByLabelText("Mais ações da coluna Planejamento"));

    expect(await screen.findByText("Adicionar post")).toBeInTheDocument();
    expect(screen.getByText("Editar")).toBeInTheDocument();
    expect(screen.getByText("Faturar")).toBeInTheDocument();
    expect(screen.getByText("Cor")).toBeInTheDocument();
    expect(screen.getByText("Excluir")).toBeInTheDocument();

    const colorTrigger = screen.getByText("Cor");
    fireEvent.pointerMove(colorTrigger);
    fireEvent.keyDown(colorTrigger, { key: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByDisplayValue("#1d4ed8")).toBeInTheDocument();
    });

    expect(screen.getAllByRole("button").length).toBeGreaterThan(6);
  });
});
