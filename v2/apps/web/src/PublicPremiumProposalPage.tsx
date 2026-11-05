import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  decidePublicProposal,
  loadPublicProposal,
  type ProposalRecord,
} from "./api";
import {
  getProposalLocale,
  ProposalClientPreview,
} from "./proposalPresentation";
import { premiumCopy } from "./proposalPremiumCopy";
export function PublicPremiumProposalPage({
  brandLogo,
}: {
  brandLogo: string;
}) {
  const { token = "" } = useParams();
  const decisionLock = useRef(false);
  const currentToken = useRef(token);
  currentToken.current = token;
  const [proposal, setProposal] = useState<ProposalRecord | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [option, setOption] = useState<string>();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setOption(undefined);
    setProposal(null);
    void loadPublicProposal(token)
      .then((result) => {
        if (active) setProposal(result.proposal);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);
  const locale = proposal?.locale ?? "English",
    copy = getProposalLocale(locale),
    extra = premiumCopy(locale);
  if (loading)
    return (
      <main className="public-proposal-page proposal-premium-page">
        <p>{extra.loading}</p>
      </main>
    );
  if (!proposal)
    return (
      <main className="public-proposal-page proposal-premium-page">
        <h1>{extra.unavailable}</h1>
      </main>
    );
  const expired =
    proposal.status === "expired" ||
    (proposal.status !== "accepted" &&
      new Date(proposal.expiresAt).getTime() < Date.now());
  const terminal =
    proposal.status === "accepted" || proposal.status === "refused";
  const canAccept =
    !expired &&
    !terminal &&
    ["sent", "viewed"].includes(proposal.status) &&
    (!proposal.document ||
      proposal.document.mode !== "alternatives" ||
      !!option);
  const decide = async (status: "accepted" | "refused") => {
    if (decisionLock.current) return;
    decisionLock.current = true;
    setBusy(true);
    setError(false);
    try {
      const result = await decidePublicProposal(
        token,
        status,
        status === "accepted" ? option : undefined,
        proposal.revision,
      );
      if (currentToken.current === token) setProposal(result.proposal);
    } catch {
      if (currentToken.current === token) setError(true);
    } finally {
      decisionLock.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="public-proposal-page proposal-premium-page">
      <ProposalClientPreview
        proposal={proposal}
        brandLogo={brandLogo}
        selectedOptionId={option}
        onSelectOption={
          !terminal && !expired ? (id) => setOption(id) : undefined
        }
      />
      <section className="public-proposal-decision">
        <h2>
          {terminal
            ? proposal.status === "accepted"
              ? copy.accepted
              : copy.refused
            : expired
              ? extra.expired
              : extra.approval}
        </h2>
        {terminal ? (
          <p>{copy.answer}</p>
        ) : expired ? null : (
          <>
            <p>{proposal.document?.approvalText || copy.continueTogether}</p>
            {proposal.document?.mode === "alternatives" && !option && (
              <p>{extra.select}</p>
            )}
            <div>
              <button
                className="gradient-button"
                disabled={busy || !canAccept}
                onClick={() => void decide("accepted")}
              >
                {busy ? extra.saving : copy.accept}
              </button>
              <button
                className="public-proposal-refuse"
                disabled={busy || !["sent", "viewed"].includes(proposal.status)}
                onClick={() => void decide("refused")}
              >
                {copy.refuse}
              </button>
            </div>
          </>
        )}
        {error && <p role="alert">{extra.reload}</p>}
      </section>
    </main>
  );
}
