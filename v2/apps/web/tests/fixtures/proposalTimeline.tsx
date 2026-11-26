import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ProposalPremiumEditor } from "../../src/ProposalPremiumEditor";
import { ProposalClientPreview } from "../../src/proposalPresentation";
import { emptyProposalDocument } from "../../src/proposalDocument";
import type { ProposalRecord } from "../../src/api";
import "../../src/styles.css";

// Synthetic browser fixture only. No backend or customer data is accessed.
const initial = {
  id: "timeline-test",
  token: "synthetic",
  clientName: "Atelier Studio",
  email: "",
  locale: "Português",
  proposalType: "Projeto",
  plan: "",
  pieces: 0,
  scope: "Identidade visual e direção criativa para uma nova fase.",
  investment: "",
  currency: "BRL",
  expiresAt: "2099-12-31T23:59:59.000Z",
  status: "draft",
  services: [
    { name: "Identidade visual", description: "Projeto completo", value: 5000 },
  ],
  revision: 1,
  document: {
    ...emptyProposalDocument(),
    title: "Uma nova expressão para sua marca",
    timelineTitle: "Etapas do projeto",
    timelineValue: "10",
    timelineUnit: "business",
    timelineStart:
      "Início após o recebimento do briefing e confirmação da entrada.",
    timelineNotes:
      "Os prazos consideram o retorno do cliente em até dois dias úteis.",
    approvalText: "Aprovo o escopo e as condições comerciais apresentados.",
  },
} as ProposalRecord;
function Fixture() {
  const [proposal, setProposal] = useState<ProposalRecord>(
    () =>
      JSON.parse(localStorage.getItem("timeline-fixture") || "null") || initial,
  );
  const [preview, setPreview] = useState(false);
  return (
    <main style={{ maxWidth: 1100, margin: "auto", padding: 16 }}>
      <nav style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button onClick={() => setPreview(!preview)}>
          {preview ? "Editar" : "Visualizar"}
        </button>
        <button
          onClick={() =>
            localStorage.setItem("timeline-fixture", JSON.stringify(proposal))
          }
        >
          Salvar teste
        </button>
      </nav>
      {preview ? (
        <ProposalClientPreview proposal={proposal} showApproval={false} />
      ) : (
        <div className="commercial-proposals proposal-editor">
          <ProposalPremiumEditor
            draft={proposal}
            update={(patch) =>
              setProposal((current) => ({ ...current, ...patch }))
            }
          />
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
